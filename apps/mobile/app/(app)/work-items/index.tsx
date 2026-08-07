/**
 * Arbeitsitems-Liste des Monteurs (SPEZ-arbeitsitems.md Abschnitt 6).
 *
 * Zeigt das aktuelle Item (laufende Session), die eigenen Items und den
 * offenen Pool des Projekts. Suche geht über die Kennung (`itemKey`).
 * Der Screen ändert nichts an der Stempel-Logik – er liest nur den
 * Stempel-Status, um den Hinweis „Erst einstempeln“ zeigen zu können.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import { ApiError, workerApi, type ClockStatus } from '../../../lib/api';
import {
  formatLocation,
  workItemsApi,
  type MyWorkItemsResponse,
  type WorkItemListEntry,
} from '../../../lib/work-items';
import {
  STATUS_COLORS,
  T,
  both,
  statusLabel,
} from '../../../lib/i18n-work-items';
import { formatTime } from '../../../lib/utils';

export default function WorkItemsListScreen() {
  const { worker } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = typeof params.projectId === 'string' ? params.projectId : undefined;

  const [data, setData] = useState<MyWorkItemsResponse | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!worker) return;
    try {
      const [items, status] = await Promise.all([
        workItemsApi.mine(projectId),
        workerApi.status(worker.id),
      ]);
      setData(items);
      setClock(status);
    } catch (err) {
      Alert.alert(
        both(T.error),
        err instanceof ApiError ? err.message : both(T.loadFailed),
      );
    }
  }, [worker, projectId]);

  // Beim Öffnen und nach jeder Rückkehr aus dem Detail
  // (Nehmen, Session, Meldung) neu laden.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const { mine, open } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (item: WorkItemListEntry) =>
      needle.length === 0 ||
      item.itemKey.toLowerCase().includes(needle) ||
      (item.title ?? '').toLowerCase().includes(needle) ||
      (item.room ?? '').toLowerCase().includes(needle);
    return {
      mine: (data?.mine ?? []).filter(match),
      open: (data?.open ?? []).filter(match),
    };
  }, [data, query]);

  // Die API liefert die laufende Session projektübergreifend – in der
  // Projektliste nur zeigen, wenn sie zu diesem Projekt gehört.
  const session = data?.currentSession ?? null;
  const currentSession =
    session && (!projectId || session.workItem.projectId === projectId)
      ? session
      : null;
  const clockedIn = clock?.clockedIn ?? false;

  const openDetail = (id: string) => {
    router.push(`/(app)/work-items/${id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#f9fafb" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{T.workItems.de}</Text>
          <Text style={styles.headerSubtitle}>{T.workItems.sk}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        {!clockedIn && (
          <View style={styles.warnCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#facc15" />
            <View style={styles.warnTexts}>
              <Text style={styles.warnTitle}>{both(T.clockInFirst)}</Text>
              <Text style={styles.warnText}>{T.clockInFirstHint.de}</Text>
              <Text style={styles.warnTextSk}>{T.clockInFirstHint.sk}</Text>
            </View>
          </View>
        )}

        {currentSession && (
          <TouchableOpacity
            style={styles.currentCard}
            onPress={() => openDetail(currentSession.workItem.id)}
            activeOpacity={0.8}
          >
            <View style={styles.currentHeader}>
              <Ionicons name="play-circle" size={18} color="#4ade80" />
              <Text style={styles.currentLabel}>{both(T.currentItem)}</Text>
            </View>
            <Text style={styles.currentKey}>
              {currentSession.workItem.itemKey}
            </Text>
            {currentSession.workItem.title && (
              <Text style={styles.currentTitle} numberOfLines={2}>
                {currentSession.workItem.title}
              </Text>
            )}
            <Text style={styles.currentSince}>
              {both(T.timeRunning)} · {formatTime(currentSession.startedAt)}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={both(T.searchKey)}
            placeholderTextColor="#6b7280"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        <Section
          title={T.myItems.de}
          subtitle={T.myItems.sk}
          count={mine.length}
          items={mine}
          emptyText={both(T.noItems)}
          currentItemId={currentSession?.workItem.id ?? null}
          onSelect={openDetail}
        />

        <Section
          title={T.openPool.de}
          subtitle={T.openPool.sk}
          count={open.length}
          items={open}
          emptyText={both(T.noOpenItems)}
          currentItemId={null}
          onSelect={openDetail}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Eine Listensektion („Meine“ / „Offen“). */
function Section({
  title,
  subtitle,
  count,
  items,
  emptyText,
  currentItemId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  count: number;
  items: WorkItemListEntry[];
  emptyText: string;
  currentItemId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isCurrent={item.id === currentItemId}
            onPress={() => onSelect(item.id)}
          />
        ))
      )}
    </View>
  );
}

/** Eine Item-Zeile mit Kennung, Ort, Status-Badge. */
function ItemRow({
  item,
  isCurrent,
  onPress,
}: {
  item: WorkItemListEntry;
  isCurrent: boolean;
  onPress: () => void;
}) {
  const colors = STATUS_COLORS[item.status];
  const location = formatLocation(item);
  return (
    <TouchableOpacity
      style={[styles.itemCard, isCurrent && styles.itemCardCurrent]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.itemMain}>
        <View style={styles.itemKeyRow}>
          {isCurrent && (
            <Ionicons name="play-circle" size={16} color="#4ade80" />
          )}
          <Text style={styles.itemKey}>{item.itemKey}</Text>
        </View>
        {item.title && (
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
        )}
        {location.length > 0 && (
          <Text style={styles.itemLocation} numberOfLines={1}>
            {location}
          </Text>
        )}
      </View>
      <View style={styles.itemRight}>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#4b5563" />
      </View>
    </TouchableOpacity>
  );
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
    paddingBottom: 32,
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
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Hinweis „Erst einstempeln“
  warnCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warnTexts: {
    flex: 1,
  },
  warnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#facc15',
    marginBottom: 2,
  },
  warnText: {
    fontSize: 13,
    color: '#d1d5db',
  },
  warnTextSk: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Aktuelles Item
  currentCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  currentKey: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  currentTitle: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 2,
  },
  currentSince: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
  },

  // Suche
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#f9fafb',
    paddingVertical: 12,
  },

  // Sektionen
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },

  // Item-Zeile
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    minHeight: 64,
  },
  itemCardCurrent: {
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  itemMain: {
    flex: 1,
  },
  itemKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemKey: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemTitle: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 2,
  },
  itemLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
