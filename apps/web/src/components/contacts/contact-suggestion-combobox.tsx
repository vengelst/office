'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  contactsApi,
  type ContactSuggestion,
} from '@/lib/contacts';

/**
 * Durchsuchbare Combobox für Kontakt-Suggestions
 * (Kunden- und Subunternehmen-Ansprechpartner).
 */
export function ContactSuggestionCombobox({
  customerId,
  valueLabel,
  placeholder,
  disabled,
  className,
  onSelect,
  onClear,
}: {
  customerId?: string;
  valueLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSelect: (suggestion: ContactSuggestion) => void;
  onClear?: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(valueLabel ?? '');
  const [items, setItems] = useState<ContactSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(valueLabel ?? '');
  }, [valueLabel]);

  const load = useCallback(
    (q: string) => {
      setLoading(true);
      contactsApi
        .suggestions({ q: q || undefined, customerId, limit: 20 })
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    [customerId],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const select = (item: ContactSuggestion): void => {
    setQuery(item.label);
    onSelect(item);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => (i < items.length - 1 ? i + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : items.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < items.length) {
          select(items[highlightIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder ?? 'Kontakt suchen …'}
          disabled={disabled}
          className={cn(
            'flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          )}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value && onClear) onClear();
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-0 top-0 flex h-full items-center px-2 text-muted-foreground hover:text-foreground disabled:pointer-events-none"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {loading && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Suche …
            </li>
          )}
          {!loading && items.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Keine Treffer
            </li>
          )}
          {!loading &&
            items.map((item, idx) => (
              <li
                key={`${item.source}-${item.id}`}
                role="option"
                aria-selected={highlightIndex === idx}
                className={cn(
                  'relative flex cursor-pointer select-none flex-col rounded-sm px-2 py-1.5 text-sm outline-none',
                  highlightIndex === idx
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item);
                }}
              >
                <span className="font-medium">{item.label}</span>
                {(item.email || item.role) && (
                  <span className="text-xs text-muted-foreground">
                    {[item.role, item.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
