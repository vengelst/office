/**
 * Prüft beim Start auf eine neuere APK und bietet Download/Installation an.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  checkForAppUpdate,
  downloadAndInstallApk,
  type AppUpdateManifest,
} from '../lib/app-update';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'error';

export function AppUpdateGate(): React.ReactElement | null {
  const [phase, setPhase] = useState<Phase>('checking');
  const [manifest, setManifest] = useState<AppUpdateManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await checkForAppUpdate();
        if (cancelled) return;
        if (!result.updateAvailable) {
          setPhase('idle');
          return;
        }
        setManifest(result.manifest);
        setCurrentVersion(result.currentVersion);
        setPhase('available');
      } catch {
        if (!cancelled) setPhase('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (manifest?.mandatory) return;
    setPhase('idle');
  }, [manifest?.mandatory]);

  const startUpdate = useCallback(async () => {
    if (!manifest?.apkUrl) return;
    setPhase('downloading');
    setProgress(0);
    setError(null);
    try {
      await downloadAndInstallApk(manifest.apkUrl, setProgress);
      // Nach dem Installer-Dialog bleibt die alte App kurz sichtbar –
      // User bestätigt „Aktualisieren“ im System-Dialog.
      setPhase('available');
      Alert.alert(
        'Installation',
        'Bitte im System-Dialog „Aktualisieren“ bzw. „Installieren“ bestätigen.',
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Update fehlgeschlagen.';
      setError(message);
      setPhase('error');
    }
  }, [manifest?.apkUrl]);

  if (phase === 'idle' || phase === 'checking') return null;
  if (!manifest) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Update verfügbar</Text>
          <Text style={styles.body}>
            Installiert: {currentVersion}
            {'\n'}
            Neu: {manifest.version}
          </Text>
          {manifest.notes ? (
            <Text style={styles.notes}>{manifest.notes}</Text>
          ) : null}

          {phase === 'downloading' && (
            <View style={styles.progressBlock}>
              <ActivityIndicator color="#60a5fa" />
              <Text style={styles.progressText}>
                Lade Update… {Math.round(progress * 100)}%
              </Text>
            </View>
          )}

          {phase === 'error' && error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            {!manifest.mandatory && phase !== 'downloading' && (
              <TouchableOpacity
                style={styles.secondary}
                onPress={dismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>Später</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primary,
                phase === 'downloading' && styles.primaryDisabled,
              ]}
              onPress={startUpdate}
              disabled={phase === 'downloading'}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryText}>
                {phase === 'error' ? 'Erneut versuchen' : 'Jetzt aktualisieren'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 12,
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 22,
  },
  notes: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  progressBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressText: {
    color: '#93c5fd',
    fontSize: 14,
  },
  error: {
    color: '#fca5a5',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#d1d5db',
    fontWeight: '600',
  },
  primary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
