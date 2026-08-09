'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Auswahl-State für Listen mit Mehrfach-Löschen.
 */
export function useBulkSelection(itemIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected =
    itemIds.length > 0 && itemIds.every((id) => selected.has(id));
  const someSelected = itemIds.some((id) => selected.has(id));

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (itemIds.length > 0 && itemIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(itemIds);
    });
  }, [itemIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selected,
    selectedIds,
    count: selected.size,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
    isSelected: (id: string) => selected.has(id),
  };
}
