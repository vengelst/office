'use client';

import { useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import { companyLogoUrl } from '@/lib/settings';

/**
 * App-Brand: Firmenlogo (skaliert auf Header-Höhe) oder Fallback Building2 + „Office“.
 * Verwendung: Sidebar, Mobile-Header, Login, Druckkopf.
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

  // Feste Slot-Maße: Logo muss in die h-16-Headerzeile passen
  const slot =
    size === 'lg'
      ? 'h-12 max-h-12 max-w-[220px]'
      : size === 'sm'
        ? 'h-7 max-h-7 max-w-[140px]'
        : 'h-10 max-h-10 max-w-[200px]';

  if (!failed) {
    return (
      <div
        className={cn(
          'flex w-full min-w-0 items-center overflow-hidden',
          slot,
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

/** Nur das Logo-Bild für Drucklayouts (ohne Fallback-Text). */
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
        'block h-12 max-h-12 w-auto max-w-[180px] object-contain object-left',
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
