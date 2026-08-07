/**
 * Item-Detail des Monteurs (SPEZ-arbeitsitems.md Abschnitte 4.1, 5, 6, 8.2).
 *
 * Zeigt Metadaten, Arbeitsumfang und Material zweisprachig (DE + SK) und
 * bündelt die vier Monteur-Aktionen:
 *   Nehmen · Als aktuell setzen (Item-Zeit) · Fertig (≥2 Fotos) · Nacharbeit
 *
 * Guards:
 *   - „Als aktuell setzen“ nur wenn am Projekt eingestempelt (Item-Zeit läuft
 *     laut SPEZ 8.2 nur bei gestempeltem Monteur).
 *   - Fertigmeldung erst ab 2 Fotos (die API weist weniger mit 400 ab).
 *   - REVIEW/APPROVED sind read-only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import { ApiError, workerApi, type ClockStatus } from '../../../lib/api';
import {
  MIN_COMPLETION_PHOTOS,
  WorkItemPdfError,
  formatQty,
  openWorkItemPdf,
  workItemsApi,
  type PickedPhoto,
  type WorkItemDetail,
} from '../../../lib/work-items';
import {
  PDF_ERRORS,
  STATUS_COLORS,
  T,
  both,
  statusLabel,
} from '../../../lib/i18n-work-items';
import { formatDateTime, formatTime } from '../../../lib/utils';

/** Art der offenen Rückmeldung im Foto-Dialog. */
type ReportMode = 'complete' | 'rework';

export default function WorkItemDetailScreen() {
  const { worker } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const itemId = typeof params.id === 'string' ? params.id : '';

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pdfBusy, setPdfBusy] = useState(false);

  const [reportMode, setReportMode] = useState<ReportMode | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!worker || !itemId) return;
    try {
      const [detail, status] = await Promise.all([
        workItemsApi.one(itemId),
        workerApi.status(worker.id),
      ]);
      setItem(detail);
      setClock(status);
    } catch (err) {
      Alert.alert(
        both(T.error),
        err instanceof ApiError ? err.message : both(T.loadFailed),
      );
    }
  }, [worker, itemId]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Aktive Zuordnung des angemeldeten Monteurs an diesem Item. */
  const assignedToMe = useMemo(
    () => (item?.assignments ?? []).some((a) => a.worker.id === worker?.id),
    [item, worker],
  );

  /** Laufende eigene Session an diesem Item = „aktuelles Item“. */
  const runningSession = useMemo(
    () =>
      (item?.sessions ?? []).find(
        (s) => s.endedAt === null && s.worker.id === worker?.id,
      ) ?? null,
    [item, worker],
  );

  /** Am Projekt dieses Items eingestempelt (Voraussetzung für Item-Zeit). */
  const clockedInHere =
    (clock?.clockedIn ?? false) && clock?.project?.id === item?.projectId;

  // ── Aktionen ─────────────────────────────────────────────────

  const runAction = async (fn: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (successMessage) Alert.alert(both(T.done), successMessage);
    } catch (err) {
      Alert.alert(
        both(T.error),
        err instanceof ApiError ? err.message : both(T.loadFailed),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = () =>
    runAction(() => workItemsApi.claim(itemId), both(T.claimed));

  const handleStartSession = () => {
    if (!clockedInHere) {
      Alert.alert(both(T.clockInFirst), `${T.clockInFirstHint.de}\n${T.clockInFirstHint.sk}`);
      return;
    }
    void runAction(() => workItemsApi.startSession(itemId));
  };

  const handleStopSession = () => runAction(() => workItemsApi.stopSession(itemId));

  /** Block-PDF laden und im Viewer öffnen (SPEZ 6.5 „Unterlage öffnen“). */
  const handleOpenPdf = async () => {
    if (!item || pdfBusy) return;
    setPdfBusy(true);
    try {
      await openWorkItemPdf(item);
    } catch (err) {
      const reason = err instanceof WorkItemPdfError ? err.reason : 'download';
      Alert.alert(both(T.error), both(PDF_ERRORS[reason]));
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Foto-Auswahl ─────────────────────────────────────────────

  const addFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(both(T.hint), both(T.cameraPermission));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
      });
      if (!result.canceled) setPhotos((prev) => [...prev, ...toPicked(result.assets)]);
    } catch {
      Alert.alert(both(T.error), both(T.cameraPermission));
    }
  };

  const addFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(both(T.hint), both(T.galleryPermission));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
      });
      if (!result.canceled) setPhotos((prev) => [...prev, ...toPicked(result.assets)]);
    } catch {
      Alert.alert(both(T.error), both(T.galleryPermission));
    }
  };

  const openReport = (mode: ReportMode) => {
    setReportMode(mode);
    setPhotos([]);
    setComment('');
  };

  const closeReport = () => {
    setReportMode(null);
    setPhotos([]);
    setComment('');
  };

  const submitReport = async () => {
    if (!reportMode) return;
    if (reportMode === 'complete' && photos.length < MIN_COMPLETION_PHOTOS) {
      Alert.alert(both(T.hint), both(T.minPhotosMissing));
      return;
    }
    setSending(true);
    try {
      if (reportMode === 'complete') {
        await workItemsApi.complete(itemId, photos, comment);
      } else {
        await workItemsApi.rework(itemId, photos, comment);
      }
      const message =
        reportMode === 'complete' ? both(T.completeSent) : both(T.reworkSent);
      closeReport();
      await load();
      Alert.alert(both(T.done), message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        both(T.error),
        err instanceof ApiError ? err.message : both(T.loadFailed),
      );
    } finally {
      setSending(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} title={both(T.workItems)} />
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>{both(T.loadFailed)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const colors = STATUS_COLORS[item.status];
  // REVIEW/APPROVED sind für den Monteur read-only; sonst gilt: wer das Item
  // (noch) nicht hat, kann es nehmen – auch als zusätzlicher Monteur (SPEZ 5.2).
  const readOnly = item.status === 'REVIEW' || item.status === 'APPROVED';
  const claimable = !assignedToMe;
  const planLine = [
    item.block ? `${T.block.de}/${T.block.sk} ${item.block.blockKey}` : null,
    item.pdfFile,
    item.pdfPage != null ? `${T.page.de}/${T.page.sk} ${item.pdfPage}` : null,
    item.planPage != null && item.pdfPage == null
      ? `${T.plan.de}/${T.plan.sk} ${item.planPage}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} title={item.itemKey} mono />

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
        {/* Kopf */}
        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
            {runningSession && (
              <View style={styles.runningBadge}>
                <Ionicons name="play-circle" size={14} color="#4ade80" />
                <Text style={styles.runningText}>
                  {both(T.isCurrent)} · {formatTime(runningSession.startedAt)}
                </Text>
              </View>
            )}
          </View>

          {item.title && <Text style={styles.itemTitle}>{item.title}</Text>}

          <View style={styles.metaGrid}>
            <Meta label={T.floor.de} labelSk={T.floor.sk} value={item.floor} />
            <Meta label={T.area.de} labelSk={T.area.sk} value={item.area} />
            <Meta label={T.room.de} labelSk={T.room.sk} value={item.room} />
            <Meta label={T.type.de} labelSk={T.type.sk} value={item.type} />
            <Meta label={T.rc.de} labelSk={T.rc.sk} value={item.rc} />
          </View>

          {item.detail && <Text style={styles.detailText}>{item.detail}</Text>}

          {/* Unterlage: Planreferenz („Block · Datei · Seite 3“) + PDF-Button */}
          {(planLine.length > 0 || item.hasPdf) && (
            <View style={styles.planSection}>
              {planLine.length > 0 && (
                <View style={styles.planRow}>
                  <Ionicons name="document-outline" size={16} color="#9ca3af" />
                  <Text style={styles.planText}>{planLine}</Text>
                </View>
              )}
              {item.hasPdf && (
                <TouchableOpacity
                  style={[styles.pdfButton, pdfBusy && styles.pdfButtonBusy]}
                  onPress={handleOpenPdf}
                  disabled={pdfBusy}
                  activeOpacity={0.8}
                >
                  {pdfBusy ? (
                    <ActivityIndicator size="small" color="#f9fafb" />
                  ) : (
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#f9fafb"
                    />
                  )}
                  <Text style={styles.pdfButtonText}>
                    {pdfBusy ? both(T.openingPdf) : both(T.openPdf)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Arbeitsumfang DE + SK */}
        {(item.workScopeDe || item.workScopeSk) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{both(T.workScope)}</Text>
            {item.workScopeDe && (
              <Text style={styles.scopeDe}>{item.workScopeDe}</Text>
            )}
            {item.workScopeSk && (
              <Text style={styles.scopeSk}>{item.workScopeSk}</Text>
            )}
          </View>
        )}

        {/* Material DE + SK */}
        {item.materials.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{both(T.material)}</Text>
            {item.materials.map((line, idx) => (
              <View
                key={line.id}
                style={[
                  styles.materialRow,
                  idx < item.materials.length - 1 && styles.materialBorder,
                ]}
              >
                <Text style={styles.materialQty}>{formatQty(line) || '–'}</Text>
                <View style={styles.materialTexts}>
                  <Text style={styles.materialDe}>{line.materialDe}</Text>
                  {line.materialSk && (
                    <Text style={styles.materialSk}>{line.materialSk}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Rückmeldungen (neueste zuerst) */}
        {item.reports.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{both(T.reports)}</Text>
            {item.reports.map((report, idx) => (
              <View
                key={report.id}
                style={[
                  styles.historyRow,
                  idx < item.reports.length - 1 && styles.historyBorder,
                ]}
              >
                <View style={styles.historyHead}>
                  <Ionicons
                    name={
                      report.type === 'COMPLETED'
                        ? 'checkmark-done'
                        : 'build-outline'
                    }
                    size={15}
                    color={report.type === 'COMPLETED' ? '#4ade80' : '#f59e0b'}
                  />
                  <Text style={styles.historyType}>
                    {report.type === 'COMPLETED'
                      ? both(T.complete)
                      : both(T.rework)}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>
                  {formatDateTime(report.reportedAt)} · {both(T.byWorker)}{' '}
                  {report.worker.firstName} {report.worker.lastName} ·{' '}
                  {report.photoDocumentIds.length} {both(T.photos)}
                </Text>
                {report.comment && (
                  <Text style={styles.historyComment}>{report.comment}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Kontrollen des Kunden-PLs (nur lesen) */}
        {item.reviews.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{both(T.reviews)}</Text>
            {item.reviews.map((review, idx) => (
              <View
                key={review.id}
                style={[
                  styles.historyRow,
                  idx < item.reviews.length - 1 && styles.historyBorder,
                ]}
              >
                <View style={styles.historyHead}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color="#60a5fa"
                  />
                  <Text style={styles.historyType}>
                    {review.action === 'APPROVE'
                      ? both(T.approvedReview)
                      : both(T.forcedReview)}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>
                  {formatDateTime(review.reviewedAt)}
                  {review.reviewer
                    ? ` · ${both(T.byWorker)} ${review.reviewer.displayName}`
                    : ''}
                </Text>
                {review.comment && (
                  <Text style={styles.historyComment}>{review.comment}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Hinweise für read-only Stati */}
        {item.status === 'REVIEW' && (
          <View style={styles.infoCard}>
            <Ionicons name="hourglass-outline" size={18} color="#facc15" />
            <Text style={styles.infoText}>{both(T.waitingForReview)}</Text>
          </View>
        )}
        {item.status === 'APPROVED' && (
          <View style={styles.infoCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#4ade80" />
            <Text style={styles.infoText}>{both(T.approvedHint)}</Text>
          </View>
        )}

        {/* Aktionen */}
        {!readOnly && (
          <View style={styles.actions}>
            {claimable && (
              <ActionButton
                icon="hand-left-outline"
                label={both(T.claim)}
                variant="primary"
                disabled={busy}
                onPress={handleClaim}
              />
            )}

            {assignedToMe && !runningSession && (
              <ActionButton
                icon="play"
                label={both(T.setCurrent)}
                variant={clockedInHere ? 'primary' : 'muted'}
                disabled={busy}
                onPress={handleStartSession}
              />
            )}

            {assignedToMe && runningSession && (
              <ActionButton
                icon="pause"
                label={both(T.stopTime)}
                variant="neutral"
                disabled={busy}
                onPress={handleStopSession}
              />
            )}

            {assignedToMe && (
              <>
                <ActionButton
                  icon="checkmark-done"
                  label={both(T.complete)}
                  variant="success"
                  disabled={busy}
                  onPress={() => openReport('complete')}
                />
                <ActionButton
                  icon="build-outline"
                  label={both(T.rework)}
                  variant="warn"
                  disabled={busy}
                  onPress={() => openReport('rework')}
                />
              </>
            )}

            {!assignedToMe && (
              <Text style={styles.emptyText}>{both(T.claimFirst)}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Foto-Dialog für Fertig / Nacharbeit */}
      <Modal
        visible={reportMode !== null}
        animationType="slide"
        transparent
        onRequestClose={closeReport}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {reportMode === 'complete' ? both(T.complete) : both(T.rework)}
            </Text>
            <Text style={styles.modalHint}>
              {reportMode === 'complete'
                ? `${T.minPhotos.de} · ${T.minPhotos.sk}`
                : `${T.photos.de} / ${T.photos.sk} (optional)`}
            </Text>

            <ScrollView
              horizontal
              style={styles.thumbStrip}
              showsHorizontalScrollIndicator={false}
            >
              {photos.map((photo, idx) => (
                <View key={`${photo.uri}-${idx}`} style={styles.thumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== idx))
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length === 0 && (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="images-outline" size={22} color="#4b5563" />
                </View>
              )}
            </ScrollView>

            <View style={styles.pickRow}>
              <TouchableOpacity
                style={styles.pickButton}
                onPress={addFromCamera}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color="#f9fafb" />
                <Text style={styles.pickButtonText}>{both(T.camera)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickButton}
                onPress={addFromGallery}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={20} color="#f9fafb" />
                <Text style={styles.pickButtonText}>{both(T.gallery)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.photoCount}>
              {both(T.photos)}: {photos.length}
              {reportMode === 'complete' ? ` / ${MIN_COMPLETION_PHOTOS}+` : ''}
            </Text>

            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={both(T.commentOptional)}
              placeholderTextColor="#6b7280"
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={closeReport}
                disabled={sending}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>{both(T.cancel)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmit,
                  (sending ||
                    (reportMode === 'complete' &&
                      photos.length < MIN_COMPLETION_PHOTOS)) &&
                    styles.modalSubmitDisabled,
                ]}
                onPress={submitReport}
                disabled={
                  sending ||
                  (reportMode === 'complete' &&
                    photos.length < MIN_COMPLETION_PHOTOS)
                }
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>{both(T.send)}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Kopfzeile mit Zurück-Button (globale Stack-Header sind ausgeblendet). */
function Header({
  onBack,
  title,
  mono,
}: {
  onBack: () => void;
  title: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color="#f9fafb" />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, mono && styles.headerTitleMono]}>
        {title}
      </Text>
    </View>
  );
}

/** Ein Metadatenfeld (Label DE/SK + Wert); wird bei leerem Wert ausgelassen. */
function Meta({
  label,
  labelSk,
  value,
}: {
  label: string;
  labelSk: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>
        {label} / {labelSk}
      </Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/** Großflächiger Aktions-Button (Touch-Ziel ≥ 56 px). */
function ActionButton({
  icon,
  label,
  variant,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  variant: 'primary' | 'success' | 'warn' | 'neutral' | 'muted';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, VARIANTS[variant], disabled && styles.actionDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={22} color="#ffffff" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const VARIANTS = StyleSheet.create({
  primary: { backgroundColor: '#3b82f6' },
  success: { backgroundColor: '#22c55e' },
  warn: { backgroundColor: '#f59e0b' },
  neutral: { backgroundColor: '#374151' },
  muted: { backgroundColor: '#1f2937' },
});

/** ImagePicker-Assets auf das Upload-Format reduzieren. */
function toPicked(assets: ImagePicker.ImagePickerAsset[]): PickedPhoto[] {
  return assets.map((asset) => ({
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  }));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    flex: 1,
  },
  headerTitleMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Karten
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
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runningText: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    marginTop: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  metaItem: {
    minWidth: 90,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  metaValue: {
    fontSize: 15,
    color: '#f9fafb',
    fontWeight: '500',
    marginTop: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 12,
  },
  planSection: {
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planText: {
    flex: 1,
    fontSize: 13,
    color: '#9ca3af',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  pdfButtonBusy: {
    opacity: 0.7,
  },
  pdfButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
  },

  // Arbeitsumfang
  scopeDe: {
    fontSize: 15,
    color: '#f9fafb',
    lineHeight: 21,
  },
  scopeSk: {
    fontSize: 15,
    color: '#9ca3af',
    lineHeight: 21,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Material
  materialRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  materialBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  materialQty: {
    minWidth: 64,
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  materialTexts: {
    flex: 1,
  },
  materialDe: {
    fontSize: 15,
    color: '#f9fafb',
  },
  materialSk: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 1,
  },

  // Historie (Rückmeldungen und Kontrollen)
  historyRow: {
    paddingVertical: 10,
  },
  historyBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
  },
  historyMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  historyComment: {
    fontSize: 13,
    color: '#d1d5db',
    marginTop: 4,
  },

  // Hinweis-Karten
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Aktionen
  actions: {
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Foto-Dialog
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
  },
  modalHint: {
    fontSize: 13,
    color: '#9ca3af',
  },
  thumbStrip: {
    maxHeight: 92,
  },
  thumbWrap: {
    marginRight: 8,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    minHeight: 52,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f9fafb',
  },
  photoCount: {
    fontSize: 13,
    color: '#9ca3af',
  },
  commentInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f9fafb',
    minHeight: 60,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9ca3af',
  },
  modalSubmit: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
