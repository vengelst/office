/**
 * Gemeinsame Anzeige-Helfer für Arbeitsitem-Listen (Büro-PL + Kiosk-PL).
 */
import type { WorkItemListEntry } from './work-items';

/**
 * "5 · A · Lift Lobby" aus Geschoss/Bereich/Raum.
 *
 * @param item - Parameter `item` (WorkItemListEntry)
 * @returns string
 */
export function workItemLocationLabel(item: WorkItemListEntry): string {
  return [item.floor, item.area, item.room].filter(Boolean).join(' · ') || '–';
}

/**
 * Namen der aktiven Monteure eines Items.
 *
 * @param item - Parameter `item` (WorkItemListEntry)
 * @returns string
 */
export function workItemWorkerLabel(item: WorkItemListEntry): string {
  if (item.assignments.length === 0) return '–';
  return item.assignments
    .map((a) => `${a.worker.lastName}, ${a.worker.firstName}`)
    .join('; ');
}
