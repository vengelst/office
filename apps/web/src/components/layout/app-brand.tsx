/**
 * Marken-/Logo-Darstellung im App-Chrome.
 * Teil des App-Chrome unter components/layout.
 */

'use client';

import { useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import { companyLogoUrl } from '@/lib/settings';

/**
 * App-Brand: Firmenlogo auf heller Fläche (sichtbar im Dark Mode) oder Fallback Building2 + „Office“.
 *
 * @param props - Komponenten-Props
 */
export function AppBrand({
  className,
  showTagline = true,
  size = 'md',
}: {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const [failed, setFailed] = useState(false);
  const [tick] = useState(() => Date.now());

  const iconSize =
    size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  // Fester Slot in der h-16-Headerzeile; weißer Hintergrund für dunkle Logos
  const slotH =
    size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10';
  const slotW =
    size === 'lg' ? 'max-w-[240px]' : size === 'sm' ? 'max-w-[160px]' : 'max-w-[200px]';

  if (!failed) {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center overflow-hidden rounded-md bg-white px-2.5 py-1 shadow-sm',
          slotH,
          slotW,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={companyLogoUrl(tick)}
          alt={texts.app.name}
          className="block h-full w-auto max-h-full max-w-full object-contain object-left"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Building2 className={cn(iconSize, 'shrink-0 text-primary')} />
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            'font-semibold leading-tight',
            size === 'lg' ? 'text-base' : 'text-sm',
          )}
        >
          {texts.app.name}
        </span>
        {showTagline && (
          <span className="text-[10px] leading-tight text-muted-foreground">
            {texts.app.tagline}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Firmenlogo nur beim Drucken (Tab-Druck und Gesamtübersicht).
 *
 * @param props - Komponenten-Props
 */
export function CompanyLogoPrint({
  className,
}: {
  className?: string;
}): ReactNode {
  const [failed, setFailed] = useState(false);
  const [tick] = useState(() => Date.now());

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={companyLogoUrl(tick)}
      alt=""
      className={cn(
        'block h-14 max-h-14 w-auto max-w-[220px] object-contain object-left',
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Briefkopf für Einzel-/Tab-Druck. Bei Gesamtübersicht ausgeblendet (dort hat PrintAll bereits ein eigenes Logo).
 *
 * @param props - Komponenten-Props
 */
export function PrintLetterhead(): ReactNode {
  return (
    <div className="print-letterhead mb-4 hidden border-b border-black/20 pb-3 print:block">
      <CompanyLogoPrint />
    </div>
  );
}
