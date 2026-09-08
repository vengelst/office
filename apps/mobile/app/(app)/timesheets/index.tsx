/**
 * Stundenzettel-Liste (eigene Wochenzettel, Signatur-CTA).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth-context';
import {
  workerApi,
  ApiError,
  type TimesheetListItem,
} from '../../../lib/api';
import {
  formatHours,
  timesheetStatusLabel,
} from '../../../lib/utils';

function canSignSheet(sheet: TimesheetListItem): boolean {
  return sheet.status === 'DRAFT' || sheet.status === 'REJECTED';
}

export default function TimesheetsListScreen() {
  const { worker } = useAuth();
  const [items, setItems] = useState<TimesheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await workerApi.listTimesheets({
        page: 1,
        limit: 50,
        sortBy: 'weekYear',
        sortDir: 'desc',
      });
      setItems(res.data ?? []);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Stundenzettel konnten nicht geladen werden.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!worker) return;
    void load();
  }, [worker, load]);

  if (!worker) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#9ca3af" />
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={() => {
            setRefreshing(true);
            void load();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#f9fafb" />
          <Text style={styles.reloadText}>Aktualisieren</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Meine Stundenzettel</Text>
      <Text style={styles.subtitle}>
        Wochenstunden prüfen und digital unterschreiben
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
              progressBackgroundColor="#111827"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Noch keine Stundenzettel vorhanden.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(app)/timesheets/[id]',
                  params: { id: item.id },
                })
              }
              activeOpacity={0.8}
            >
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.week}>
                    KW {item.weekNumber}/{item.weekYear}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {timesheetStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.project} numberOfLines={1}>
                  {item.project.title}
                </Text>
                <Text style={styles.net}>
                  Netto: {formatHours(item.totalMinutesNet)}
                </Text>
              </View>
              {canSignSheet(item) ? (
                <View style={styles.signCta}>
                  <Ionicons name="create-outline" size={14} color="#3b82f6" />
                  <Text style={styles.signCtaText}>Unterschreiben</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
  },
  backText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  reloadText: {
    color: '#f9fafb',
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 24,
  },
  empty: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 32,
  },
  list: {
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    minHeight: 72,
    marginBottom: 12,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  week: {
    fontSize: 16,
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
  },
  net: {
    fontSize: 12,
    color: '#6b7280',
  },
  signCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  signCtaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
