/**
 * Stundenzettel-Detail: Tagesübersicht (read-only) + Touch-Signatur WORKER.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import {
  workerApi,
  ApiError,
  type TimesheetDetail,
} from '../../../lib/api';
import {
  formatDate,
  formatHours,
  formatMinutes,
  formatTime,
  timesheetStatusLabel,
  weekdayShort,
} from '../../../lib/utils';
import {
  SignaturePad,
  type SignaturePadHandle,
} from '../../../components/signature-pad';

function canSign(sheet: TimesheetDetail): boolean {
  return sheet.status === 'DRAFT' || sheet.status === 'REJECTED';
}

export default function TimesheetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { worker } = useAuth();
  const padRef = useRef<SignaturePadHandle>(null);

  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const detail = await workerApi.getTimesheet(id);
      setSheet(detail);
      setSignerName(
        `${detail.worker.firstName} ${detail.worker.lastName}`.trim(),
      );
    } catch (err) {
      setSheet(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Stundenzettel nicht gefunden.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!worker) return;
    void load();
  }, [worker, load]);

  const handleSign = async () => {
    if (!id) return;
    if (!signerName.trim()) {
      Alert.alert('Hinweis', 'Bitte Namen eingeben.');
      return;
    }
    const dataUrl = await padRef.current?.toDataURL();
    if (!dataUrl) {
      Alert.alert('Hinweis', 'Bitte zuerst unterschreiben.');
      return;
    }
    setBusy(true);
    try {
      const updated = await workerApi.signTimesheet(id, {
        signerType: 'WORKER',
        signerName: signerName.trim(),
        signatureBase64: dataUrl,
      });
      setSheet(updated);
      padRef.current?.clear();
      Alert.alert('Erfolg', 'Stundenzettel unterschrieben.');
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!worker) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!sheet) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#9ca3af" />
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.error}>{error || 'Stundenzettel nicht gefunden.'}</Text>
      </SafeAreaView>
    );
  }

  const signable = canSign(sheet);
  const hasWorkerSig = sheet.signatures.some((s) => s.signerType === 'WORKER');
  const locked =
    sheet.status === 'WORKER_SIGNED' ||
    sheet.status === 'SUBMITTED' ||
    sheet.status === 'APPROVED' ||
    sheet.status === 'ARCHIVED';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#9ca3af" />
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>
            KW {sheet.weekNumber}/{sheet.weekYear}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {timesheetStatusLabel(sheet.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.project}>{sheet.project.title}</Text>
        <Text style={styles.net}>
          Netto: {formatHours(sheet.totalMinutesNet)}
        </Text>

        {locked && (
          <View style={styles.lockBox}>
            <Text style={styles.lockText}>
              Dieser Zettel ist geschlossen – Stempelungen für diese Projekt-KW
              sind gesperrt.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Tage dieser Woche</Text>
        {sheet.days.length === 0 ? (
          <Text style={styles.muted}>Keine Tageseinträge.</Text>
        ) : (
          <View style={styles.card}>
            {sheet.days.map((day, idx) => (
              <View
                key={day.id}
                style={[
                  styles.dayRow,
                  idx < sheet.days.length - 1 && styles.dayBorder,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>
                    {weekdayShort(day.workDate)} · {formatDate(day.workDate)}
                  </Text>
                  <Text style={styles.dayTime}>
                    {day.firstClockInAt
                      ? formatTime(day.firstClockInAt)
                      : '–'}{' '}
                    –{' '}
                    {day.lastClockOutAt
                      ? formatTime(day.lastClockOutAt)
                      : '–'}
                  </Text>
                </View>
                <Text style={styles.dayMinutes}>
                  {formatMinutes(day.netMinutes)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {hasWorkerSig && (
          <Text style={styles.signedHint}>
            Bereits als Monteur unterschrieben.
          </Text>
        )}

        {signable && (
          <View style={styles.signSection}>
            <Text style={styles.sectionTitle}>Als Monteur unterschreiben</Text>
            <Text style={styles.signHint}>
              Bitte mit Finger unterschreiben. Danach sind keine weiteren
              Stunden für diese Projekt-Woche möglich.
            </Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={signerName}
              onChangeText={setSignerName}
              placeholderTextColor="#6b7280"
              placeholder="Name"
            />
            <SignaturePad ref={padRef} height={180} />
            <View style={styles.signActions}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => padRef.current?.clear()}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.clearText}>Löschen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, busy && { opacity: 0.5 }]}
                onPress={() => void handleSign()}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.saveText}>
                  {busy ? 'Wird gespeichert …' : 'Unterschrift speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
  },
  backText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3b82f6',
  },
  project: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  net: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 16,
  },
  lockBox: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  lockText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 10,
  },
  muted: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  dayBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f9fafb',
  },
  dayTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dayMinutes: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#e5e7eb',
  },
  signedHint: {
    color: '#22c55e',
    fontSize: 14,
    marginBottom: 16,
  },
  signSection: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    backgroundColor: '#111827',
  },
  signHint: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 4,
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 15,
    minHeight: 44,
  },
  signActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  clearBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  clearText: {
    color: '#9ca3af',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});
