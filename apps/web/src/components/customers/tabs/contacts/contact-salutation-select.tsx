/**
 * Anrede-Auswahl für Ansprechpartner: Herr / Frau / Firma / leer.
 */

'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Sentinel für „keine Anrede“ (Radix Select erlaubt kein leeres value). */
export const SALUTATION_NONE = '__none__';

export const SALUTATION_OPTIONS = [
  { value: 'Herr', label: 'Herr' },
  { value: 'Frau', label: 'Frau' },
  { value: 'Firma', label: 'Firma' },
] as const;

export type SalutationValue = '' | 'Herr' | 'Frau' | 'Firma';

/** Mappt OCR-/Freitext auf erlaubte Anreden; sonst leer. */
export function normalizeSalutation(raw: string | null | undefined): SalutationValue {
  if (!raw) return '';
  const t = raw.trim().toLowerCase().replace(/\.$/, '');
  if (t === 'herr' || t === 'hr' || t === 'mr' || t === 'mister') return 'Herr';
  if (t === 'frau' || t === 'fr' || t === 'mrs' || t === 'ms' || t === 'miss') return 'Frau';
  if (t === 'firma' || t === 'company' || t === 'gmbh' || t === 'ag') return 'Firma';
  if (raw === 'Herr' || raw === 'Frau' || raw === 'Firma') return raw;
  return '';
}

export function ContactSalutationSelect({
  value,
  onChange,
  noneLabel = '—',
  className = 'min-h-[44px]',
}: {
  value: string;
  onChange: (value: SalutationValue) => void;
  noneLabel?: string;
  className?: string;
}): React.ReactNode {
  const selectValue = value && ['Herr', 'Frau', 'Firma'].includes(value)
    ? value
    : SALUTATION_NONE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) =>
        onChange(v === SALUTATION_NONE ? '' : (v as SalutationValue))
      }
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SALUTATION_NONE}>{noneLabel}</SelectItem>
        {SALUTATION_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
