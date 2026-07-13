import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Vibration,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/auth-context';
import {
  workerApi,
  type ClockStatus,
  type TodayEntry,
  type WorkerMeAssignment,
  ApiError,
} from '../../lib/api';
import { formatDuration, formatTime, initials, dayStart } from '../../lib/utils';
import { getCurrentPosition } from '../../lib/location';

export default function DashboardScreen() {
  const { worker, logout } = useAuth();

  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [, setTick] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoComment, setPhotoComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(
    async (workerId: string) => {
      try {
        const [st, td] = await Promise.all([
          workerApi.status(workerId),
          workerApi.today(workerId),
        ]);
        setStatus(st);
        setTodayEntries(td);
      } catch (err) {
        Alert.alert(
          'Fehler',
          err instanceof ApiError ? err.message : 'Daten konnten nicht geladen werden.',
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!worker) return;
    (async () => {
      const geo = await getCurrentPosition();
      setGpsOk(geo !== null);
      await refresh(worker.id);
      setInitialLoading(false);
    })();
  }, [worker, refresh]);

  // Live-Timer
  useEffect(() => {
    if (!status?.clockedIn) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status?.clockedIn]);

  const { current, future } = useMemo(() => {
    const todayMs = dayStart(new Date());
    const cur: WorkerMeAssignment[] = [];
    const fut: WorkerMeAssignment[] = [];
    for (const a of worker?.assignments ?? []) {
      const start = dayStart(new Date(a.startDate));
      const end = a.endDate ? dayStart(new Date(a.endDate)) : null;
      if (start > todayMs) fut.push(a);
      else if (end === null || end >= todayMs) cur.push(a);
    }
    return { current: cur, future: fut };
  }, [worker]);

  useEffect(() => {
    if (!selectedProjectId && current.length > 0) {
      setSelectedProjectId(current[0].project.id);
    }
  }, [current, selectedProjectId]);

  const clockedIn = status?.clockedIn ?? false;
  const activeProject = clockedIn ? status?.project : null;

  const elapsedSeconds =
    status?.clockedIn && status.since
      ? Math.floor((Date.now() - new Date(status.since).getTime()) / 1000)
      : 0;

  const handleClockIn = async () => {
    if (!worker) return;
    const projectId = clockedIn ? status?.project?.id : selectedProjectId;
    if (!projectId) {
      Alert.alert('Hinweis', 'Bitte wähle ein Projekt aus.');
      return;
    }
    setBusy(true);
    try {
      const geo = await getCurrentPosition();
      setGpsOk(geo !== null);
      await workerApi.clockIn({
        workerId: worker.id,
        projectId,
        ...(geo ?? {}),
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'mobile-app',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate(60);
      await refresh(worker.id);
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof ApiError ? err.message : 'Einstempeln fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    if (!worker) return;
    setBusy(true);
    try {
      const geo = await getCurrentPosition();
      setGpsOk(geo !== null);
      await workerApi.clockOut({
        workerId: worker.id,
        ...(geo ?? {}),
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'mobile-app',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Vibration.vibrate([0, 40, 40, 40]);
      await refresh(worker.id);
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof ApiError ? err.message : 'Ausstempeln fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status: permStatus } =
        await ImagePicker.requestCameraPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Berechtigung', 'Kamera-Zugriff wird benötigt.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoOpen(true);
      }
    } catch {
      Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden.');
    }
  };

  const handlePhotoUpload = async () => {
    if (!worker || !photoUri) return;
    const projectId = clockedIn ? status?.project?.id : selectedProjectId;
    if (!projectId) {
      Alert.alert('Hinweis', 'Kein Projekt ausgewählt.');
      return;
    }
    setPhotoBusy(true);
    try {
      const form = new FormData();
      const filename = photoUri.split('/').pop() ?? 'photo.jpg';
      form.append('file', {
        uri: photoUri,
        name: filename,
        type: 'image/jpeg',
      } as unknown as Blob);
      form.append('workerId', worker.id);
      form.append('projectId', projectId);
      if (photoComment.trim()) form.append('comment', photoComment.trim());
      await workerApi.uploadPhoto(form);
      Alert.alert('Erfolg', 'Foto wurde hochgeladen.');
      setPhotoOpen(false);
      setPhotoUri(null);
      setPhotoComment('');
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof ApiError ? err.message : 'Upload fehlgeschlagen.',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!worker) return;
    setRefreshing(true);
    const geo = await getCurrentPosition();
    setGpsOk(geo !== null);
    await refresh(worker.id);
    setRefreshing(false);
  }, [worker, refresh]);

  if (!worker) return null;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const selectedAssignment = current.find(
    (a) => a.project.id === selectedProjectId,
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
            progressBackgroundColor="#111827"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initials(worker.firstName, worker.lastName)}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>Willkommen,</Text>
              <Text style={styles.name}>
                {worker.firstName} {worker.lastName}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View
              style={[
                styles.gpsIndicator,
                gpsOk ? styles.gpsActive : styles.gpsInactive,
              ]}
            >
              <Ionicons
                name={gpsOk ? 'location' : 'location-outline'}
                size={14}
                color={gpsOk ? '#22c55e' : '#6b7280'}
              />
              <Text
                style={[
                  styles.gpsText,
                  gpsOk ? styles.gpsTextActive : styles.gpsTextInactive,
                ]}
              >
                {gpsOk ? 'GPS aktiv' : 'GPS inaktiv'}
              </Text>
            </View>
            <Text style={styles.workerNumber}>#{worker.workerNumber}</Text>
          </View>
        </View>

        {/* Projektauswahl */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AKTUELLES PROJEKT</Text>
          {activeProject ? (
            <View style={styles.projectInfo}>
              <Text style={styles.projectTitle}>{activeProject.title}</Text>
              <Text style={styles.projectNumber}>
                {activeProject.projectNumber}
              </Text>
            </View>
          ) : current.length === 0 ? (
            <Text style={styles.mutedText}>Keine Projekte zugewiesen</Text>
          ) : current.length === 1 ? (
            <View style={styles.projectInfo}>
              <Text style={styles.projectTitle}>
                {current[0].project.title}
              </Text>
              {current[0].project.customer && (
                <Text style={styles.projectCustomer}>
                  {current[0].project.customer.companyName}
                </Text>
              )}
            </View>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setPickerOpen(!pickerOpen)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedAssignment
                    ? selectedAssignment.project.title
                    : 'Projekt auswählen…'}
                </Text>
                <Ionicons
                  name={pickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
              {selectedAssignment?.project.customer && (
                <Text style={styles.projectCustomerBelow}>
                  {selectedAssignment.project.customer.companyName}
                </Text>
              )}
              {pickerOpen && (
                <View style={styles.pickerDropdown}>
                  {current.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.pickerItem,
                        a.project.id === selectedProjectId &&
                          styles.pickerItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedProjectId(a.project.id);
                        setPickerOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          a.project.id === selectedProjectId &&
                            styles.pickerItemTextSelected,
                        ]}
                      >
                        {a.project.title}
                      </Text>
                      {a.project.customer && (
                        <Text style={styles.pickerItemCustomer}>
                          {a.project.customer.companyName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Zukünftige Projekte */}
          {future.length > 0 && (
            <View style={styles.futureSection}>
              <Text style={styles.futureLabel}>ZUKÜNFTIGE PROJEKTE</Text>
              {future.map((a) => (
                <View key={a.id} style={styles.futureItem}>
                  <Text style={styles.futureTitle} numberOfLines={1}>
                    {a.project.title}
                  </Text>
                  <Text style={styles.futureDate}>
                    {new Date(a.startDate).toLocaleDateString('de-DE')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Status-Text + Timer */}
        <View style={styles.clockSection}>
          {clockedIn ? (
            <>
              <Text style={styles.clockedInLabel}>
                Eingestempelt seit {formatTime(status?.since)}
              </Text>
              <Text style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
            </>
          ) : (
            <Text style={styles.notClockedInLabel}>Nicht eingestempelt</Text>
          )}

          {/* Stempel-Button */}
          <TouchableOpacity
            style={[
              styles.clockButton,
              clockedIn ? styles.clockButtonOut : styles.clockButtonIn,
              (busy || (!clockedIn && current.length === 0)) &&
                styles.clockButtonDisabled,
            ]}
            onPress={clockedIn ? handleClockOut : handleClockIn}
            disabled={busy || (!clockedIn && current.length === 0)}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={clockedIn ? 'stop' : 'play'}
                  size={48}
                  color="#ffffff"
                />
                <Text style={styles.clockButtonText}>
                  {clockedIn ? 'Ausstempeln' : 'Einstempeln'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Foto-Upload-Bereich */}
        {clockedIn && (
          <View style={styles.photoSection}>
            {!photoOpen ? (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleTakePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={22} color="#f9fafb" />
                <Text style={styles.photoButtonText}>
                  Arbeitsfoto aufnehmen
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.card}>
                {photoUri && (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                )}
                <TextInput
                  style={styles.commentInput}
                  value={photoComment}
                  onChangeText={setPhotoComment}
                  placeholder="Kommentar (optional)"
                  placeholderTextColor="#6b7280"
                  multiline
                />
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.photoCancelButton}
                    onPress={() => {
                      setPhotoOpen(false);
                      setPhotoUri(null);
                      setPhotoComment('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoUploadButton,
                      (!photoUri || photoBusy) &&
                        styles.photoUploadButtonDisabled,
                    ]}
                    onPress={handlePhotoUpload}
                    disabled={!photoUri || photoBusy}
                    activeOpacity={0.7}
                  >
                    {photoBusy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.photoUploadText}>Hochladen</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Tagesübersicht */}
        <View style={styles.todaySection}>
          <Text style={styles.sectionTitle}>Heutige Einträge</Text>
          {todayEntries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Noch keine Einträge heute</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {todayEntries.map((entry, idx) => (
                <View
                  key={entry.id}
                  style={[
                    styles.entryRow,
                    idx < todayEntries.length - 1 && styles.entryBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.entryBadge,
                      entry.entryType === 'CLOCK_IN'
                        ? styles.badgeIn
                        : styles.badgeOut,
                    ]}
                  >
                    <Text
                      style={[
                        styles.entryBadgeText,
                        entry.entryType === 'CLOCK_IN'
                          ? styles.badgeInText
                          : styles.badgeOutText,
                      ]}
                    >
                      {entry.entryType === 'CLOCK_IN'
                        ? 'Einstempeln'
                        : 'Ausstempeln'}
                    </Text>
                  </View>
                  <Text style={styles.entryTime}>
                    {formatTime(entry.occurredAtClient)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  greeting: {
    fontSize: 12,
    color: '#9ca3af',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsActive: {},
  gpsInactive: {},
  gpsText: {
    fontSize: 11,
    fontWeight: '500',
  },
  gpsTextActive: {
    color: '#22c55e',
  },
  gpsTextInactive: {
    color: '#6b7280',
  },
  workerNumber: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 8,
  },
  projectInfo: {
    marginTop: 2,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
  },
  projectNumber: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#6b7280',
    marginTop: 2,
  },
  projectCustomer: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  projectCustomerBelow: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  mutedText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },

  // Picker
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f9fafb',
    flex: 1,
  },
  pickerDropdown: {
    marginTop: 8,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#f9fafb',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: '#3b82f6',
  },
  pickerItemCustomer: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // Future Projects
  futureSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  futureLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 8,
  },
  futureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  futureTitle: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
    marginRight: 8,
  },
  futureDate: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Clock Section
  clockSection: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 28,
    gap: 12,
  },
  clockedInLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22c55e',
  },
  notClockedInLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: '#f9fafb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  clockButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  clockButtonIn: {
    backgroundColor: '#22c55e',
  },
  clockButtonOut: {
    backgroundColor: '#ef4444',
  },
  clockButtonDisabled: {
    opacity: 0.5,
  },
  clockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Photo Section
  photoSection: {
    marginBottom: 20,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 16,
    minHeight: 56,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f9fafb',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f9fafb',
    minHeight: 48,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCancelText: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
  photoUploadButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoUploadButtonDisabled: {
    opacity: 0.5,
  },
  photoUploadText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Today Section
  todaySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  entryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  entryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeIn: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  badgeOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeInText: {
    color: '#22c55e',
  },
  badgeOutText: {
    color: '#ef4444',
  },
  entryTime: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f9fafb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    minHeight: 48,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
});
