/**
 * Live-Anwesenheitsliste für die Monteur-App (#38).
 * Konsumiert GET /time-entries/live/scoped – analog Web LivePresenceList.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workerApi, type ScopedLiveEntry } from '../lib/api';
import { formatDuration } from '../lib/utils';
import { LIVE_PRESENCE_LABELS } from '../lib/live-presence';

export { LIVE_PRESENCE_LABELS };

interface LivePresenceListProps {
  /** Optionaler Projektfilter – bei Änderung neu laden. */
  projectId?: string | null;
  /** Polling-Intervall ms (Default 30s), solange der Screen gemountet ist. */
  refreshMs?: number;
  /** Externe Refresh-Trigger (z. B. Pull-to-Refresh vom Parent). */
  refreshToken?: number;
}

export function LivePresenceList({
  projectId,
  refreshMs = 30000,
  refreshToken = 0,
}: LivePresenceListProps): React.ReactElement {
  const [rows, setRows] = useState<ScopedLiveEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    workerApi
      .liveScoped(projectId || undefined)
      .then((data) => {
        setRows(data);
        setError(false);
      })
      .catch(() => {
        // Unzugeordnetes Projekt / 403: leer + Fehlerzustand, kein Crash.
        setRows(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refresh, refreshMs, refreshToken]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = (since: string): number =>
    Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={20} color="#3b82f6" />
          <Text style={styles.title}>{LIVE_PRESENCE_LABELS.title}</Text>
        </View>
        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={refresh}
          disabled={loading}
          accessibilityLabel={LIVE_PRESENCE_LABELS.reload}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#9ca3af" />
          ) : (
            <Ionicons name="refresh" size={18} color="#9ca3af" />
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <Text style={styles.errorText}>{LIVE_PRESENCE_LABELS.error}</Text>
      ) : rows === null ? (
        <Text style={styles.mutedText}>{LIVE_PRESENCE_LABELS.reload}…</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.mutedText}>{LIVE_PRESENCE_LABELS.empty}</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const name =
              `${row.worker.firstName} ${row.worker.lastName}`.trim();
            return (
              <View key={row.timeEntryId} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.rowSince}>
                    {LIVE_PRESENCE_LABELS.since}{' '}
                    {formatDuration(elapsed(row.since))}
                  </Text>
                </View>
                {row.project ? (
                  <Text style={styles.rowProject} numberOfLines={2}>
                    {row.project.projectNumber} · {row.project.title}
                  </Text>
                ) : null}
                {row.activity?.name ? (
                  <Text style={styles.rowActivity} numberOfLines={1}>
                    {LIVE_PRESENCE_LABELS.activity}: {row.activity.name}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  reloadBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    color: '#f87171',
  },
  list: {
    gap: 8,
  },
  row: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 56,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
    flex: 1,
  },
  rowSince: {
    fontSize: 13,
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
  },
  rowProject: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  rowActivity: {
    fontSize: 13,
    color: '#e5e7eb',
    marginTop: 2,
  },
});
