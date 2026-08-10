'use client';

import type { ReactNode } from 'react';
import { T, useWorkItemText } from '@/lib/i18n-work-items';
import { formatQty, type WorkItemMaterial } from '@/lib/worker-work-items';

/**
 * Materialtabelle des Items (SPEZ 4.1): Menge + Text DE, darunter SK kursiv.
 * Gleiche Darstellung wie `work-items/[id].tsx` in der APK.
 */
export function MaterialTable({
  materials,
}: {
  materials: WorkItemMaterial[];
}): ReactNode {
  const tx = useWorkItemText();
  if (materials.length === 0) return null;
  return (
    <section className="rounded-2xl bg-gray-900 p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {tx(T.material)}
      </h2>
      <ul className="divide-y divide-gray-800">
        {materials.map((line) => (
          <li key={line.id} className="flex gap-3 py-2.5">
            <span className="min-w-[64px] font-mono text-sm font-semibold text-blue-400">
              {formatQty(line) || '–'}
            </span>
            <span className="flex-1">
              <span className="block text-[15px] text-gray-50">
                {line.materialDe}
              </span>
              {line.materialSk && (
                <span className="block text-[13px] italic text-gray-400">
                  {line.materialSk}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
