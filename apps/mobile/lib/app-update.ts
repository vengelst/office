/**
 * In-App-Update für Sideload-APKs (ohne Play Store).
 * Manifest: https://office.vivahome.de/kiosk-version.json
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { API_BASE_URL } from './api';
import { isVersionNewer } from './version-compare';

export { isVersionNewer } from './version-compare';

export type AppUpdateManifest = {
  version: string;
  /** Android versionCode – bevorzugter Vergleich, falls gesetzt. */
  versionCode?: number;
  apkUrl: string;
  notes?: string;
  releasedAt?: string;
  /** Wenn true: Update-Dialog ohne „Später“. */
  mandatory?: boolean;
};

export type AppUpdateCheckResult =
  | { updateAvailable: false }
  | {
      updateAvailable: true;
      currentVersion: string;
      currentVersionCode: number;
      manifest: AppUpdateManifest;
    };

export type DownloadProgressInfo = {
  ratio: number;
  bytesWritten: number;
  totalBytes: number;
};

const DISMISS_KEY = 'vh_kiosk_update_dismiss';
const ATTEMPT_KEY = 'vh_kiosk_update_attempt';
/** „Später“: so lange nicht erneut fragen (nicht-mandatory). */
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Nach Installer ohne Versionswechsel: kurze Pause gegen Schleife. */
const ATTEMPT_TTL_MS = 6 * 60 * 60 * 1000;

type StoredSnooze = {
  versionCode: number;
  at: number;
};

function officeOrigin(): string {
  try {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    if (base.startsWith('http')) return base;
  } catch {
    // fallback below
  }
  return 'https://office.vivahome.de';
}

export function getUpdateManifestUrl(): string {
  return (
    process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL ??
    `${officeOrigin()}/kiosk-version.json`
  );
}

export function getInstalledVersion(): string {
  return (
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    '0.0.0'
  );
}

/**
 * Maßgeblich ist der vom System installierte versionCode.
 * expoConfig ist nur Fallback (kann von der APK abweichen).
 */
export function getInstalledVersionCode(): number {
  const raw =
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.android?.versionCode;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function readSnooze(key: string): Promise<StoredSnooze | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSnooze;
    if (
      typeof parsed?.versionCode !== 'number' ||
      typeof parsed?.at !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeSnooze(key: string, versionCode: number): Promise<void> {
  const payload: StoredSnooze = { versionCode, at: Date.now() };
  await SecureStore.setItemAsync(key, JSON.stringify(payload));
}

/** Nutzer hat „Später“ gewählt – für denselben versionCode eine Zeit lang ruhig. */
export async function dismissUpdateForNow(versionCode: number): Promise<void> {
  await writeSnooze(DISMISS_KEY, versionCode);
}

/** Installer wurde geöffnet – bei unverändertem Stand kurz nicht erneut nerven. */
export async function markUpdateAttempted(versionCode: number): Promise<void> {
  await writeSnooze(ATTEMPT_KEY, versionCode);
}

function isSnoozed(
  snooze: StoredSnooze | null,
  targetVersionCode: number,
  ttlMs: number,
): boolean {
  if (!snooze) return false;
  if (snooze.versionCode !== targetVersionCode) return false;
  return Date.now() - snooze.at < ttlMs;
}

export async function fetchUpdateManifest(
  url = getUpdateManifestUrl(),
): Promise<AppUpdateManifest> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Update-Manifest nicht erreichbar (${res.status})`);
  }
  const data = (await res.json()) as AppUpdateManifest;
  if (!data?.version || !data?.apkUrl) {
    throw new Error('Update-Manifest ungültig');
  }
  return data;
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (Platform.OS !== 'android') {
    return { updateAvailable: false };
  }
  const manifest = await fetchUpdateManifest();
  const currentVersion = getInstalledVersion();
  const currentVersionCode = getInstalledVersionCode();

  const byCode =
    typeof manifest.versionCode === 'number' &&
    Number.isFinite(manifest.versionCode) &&
    currentVersionCode > 0
      ? manifest.versionCode > currentVersionCode
      : false;
  const byName = isVersionNewer(manifest.version, currentVersion);

  if (!byCode && !byName) {
    return { updateAvailable: false };
  }

  const targetCode =
    typeof manifest.versionCode === 'number' &&
    Number.isFinite(manifest.versionCode)
      ? manifest.versionCode
      : -1;

  if (!manifest.mandatory && targetCode > 0) {
    const dismissed = await readSnooze(DISMISS_KEY);
    if (isSnoozed(dismissed, targetCode, DISMISS_TTL_MS)) {
      return { updateAvailable: false };
    }
    const attempted = await readSnooze(ATTEMPT_KEY);
    if (isSnoozed(attempted, targetCode, ATTEMPT_TTL_MS)) {
      return { updateAvailable: false };
    }
  }

  return {
    updateAvailable: true,
    currentVersion,
    currentVersionCode,
    manifest,
  };
}

/**
 * Lädt die APK und öffnet den System-Installer.
 * Gleicher Package-Name + gleiche Signatur → Update, keine zweite App.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (info: DownloadProgressInfo) => void,
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Updates nur unter Android');
  }

  onProgress?.({ ratio: 0, bytesWritten: 0, totalBytes: 0 });
  const target = new File(Paths.cache, 'vh-kiosk-update.apk');
  if (target.exists) target.delete();

  await File.downloadFileAsync(apkUrl, target, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const ratio =
        totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0;
      onProgress?.({ ratio, bytesWritten, totalBytes });
    },
  });
  onProgress?.({
    ratio: 0.95,
    bytesWritten: target.size ?? 0,
    totalBytes: target.size ?? 0,
  });

  const contentUri = await getContentUriAsync(target.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
  onProgress?.({
    ratio: 1,
    bytesWritten: target.size ?? 0,
    totalBytes: target.size ?? 0,
  });
}
