/**
 * In-App-Update für Sideload-APKs (ohne Play Store).
 * Manifest: https://office.vivahome.de/kiosk-version.json
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { API_BASE_URL } from './api';

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
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    '0.0.0'
  );
}

export function getInstalledVersionCode(): number {
  const raw =
    Constants.expoConfig?.android?.versionCode ??
    Constants.nativeBuildVersion;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** SemVer a > b ? */
export function isVersionNewer(remote: string, local: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((p) => Number.parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const a = parse(remote);
  const b = parse(local);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
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
  onProgress?: (ratio: number) => void,
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Updates nur unter Android');
  }

  onProgress?.(0.05);
  const target = new File(Paths.cache, 'vh-kiosk-update.apk');
  if (target.exists) target.delete();

  await File.downloadFileAsync(apkUrl, target, { idempotent: true });
  onProgress?.(0.9);

  const contentUri = await getContentUriAsync(target.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
  onProgress?.(1);
}
