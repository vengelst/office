/**
 * DE-Labels für Live-Anwesenheit (#38) – analog Web workerApp.dashboard.live*.
 * Eigenes Modul ohne React Native, damit Unit-Tests ohne RN-Transform laufen.
 */
export const LIVE_PRESENCE_LABELS = {
  title: 'Wer arbeitet jetzt?',
  empty: 'Niemand eingestempelt',
  error: 'Live-Übersicht konnte nicht geladen werden.',
  reload: 'Aktualisieren',
  since: 'seit',
  activity: 'Tätigkeit',
} as const;

/** Baut den API-Pfad für scoped Live-Anwesenheit. */
export function liveScopedPath(projectId?: string): string {
  const q = projectId
    ? `?projectId=${encodeURIComponent(projectId)}`
    : '';
  return `/time-entries/live/scoped${q}`;
}
