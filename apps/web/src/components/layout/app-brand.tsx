/**
 * Marken-/Logo-Darstellung im App-Chrome.
 * Teil des App-Chrome unter components/layout.
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import { companyLogoDarkUrl, companyLogoUrl } from '@/lib/settings';

/**
 * App-Brand: Im Dark Mode helles Logo (Fallback Standard-Logo),
 * sonst Standard-Logo. Print/PDF nutzen weiterhin nur das Standard-Logo.
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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [tick] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFailed(false);
    setUsedFallback(false);
  }, [resolvedTheme]);

  const isDark = mounted && resolvedTheme === 'dark';
  const preferDarkLogo = isDark && !usedFallback;
  const logoSrc = preferDarkLogo
    ? companyLogoDarkUrl(tick)
    : companyLogoUrl(tick);

  const iconSize =
    size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  const slotH =
    size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10';
  const slotW =
    size === 'lg' ? 'max-w-[240px]' : size === 'sm' ? 'max-w-[160px]' : 'max-w-[200px]';

  // Helles Dark-Logo: transparenter Slot. Standard-Logo im Dark Mode: weißer Slot.
  const needsLightSlot = isDark && (!preferDarkLogo || failed);

  if (!failed) {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center overflow-hidden rounded-md px-2.5 py-1',
          needsLightSlot ? 'bg-white shadow-sm' : null,
          slotH,
          slotW,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={logoSrc}
          src={logoSrc}
          alt={texts.app.name}
          className="block h-full w-auto max-h-full max-w-full object-contain object-left"
          onError={() => {
            if (preferDarkLogo) {
              setUsedFallback(true);
              return;
            }
            setFailed(true);
          }}
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
 * Immer Standard-Logo (nicht Dark-Variante).
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
