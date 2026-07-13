/** Sekunden → "H:MM:SS" Format */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** ISO-String → "HH:MM" (lokale Zeit) */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Datum → "TT.MM.JJJJ" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE');
}

/** Initialen aus Vor- und Nachname */
export function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

/** Tagesbeginn als Millisekunden (für Vergleiche) */
export function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
