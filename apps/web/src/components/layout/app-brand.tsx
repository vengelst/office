'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import { companyLogoUrl } from '@/lib/settings';

/**
 * App-Brand: Firmenlogo (falls hochgeladen) oder Fallback Building2 + „Office“.
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
  const [hasLogo, setHasLogo] = useState(false);
  const [checked, setChecked] = useState(false);
  const [tick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setHasLogo(true);
        setChecked(true);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setHasLogo(false);
        setChecked(true);
      }
    };
    img.src = companyLogoUrl(tick);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const iconSize =
    size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const logoHeight =
    size === 'lg' ? 'h-10' : size === 'sm' ? 'h-6' : 'h-8';

  if (!checked) {
    // Kurz Placeholder in Brand-Größe, damit Layout nicht springt
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn(logoHeight, 'w-24 animate-pulse rounded bg-muted')} />
      </div>
    );
  }

  if (hasLogo) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={companyLogoUrl(tick)}
          alt={texts.app.name}
          className={cn(logoHeight, 'w-auto max-w-[140px] object-contain')}
          onError={() => setHasLogo(false)}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
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
  const [visible, setVisible] = useState(false);
  const [tick] = useState(() => Date.now());

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={companyLogoUrl(tick)}
      alt=""
      className={cn(
        'h-12 w-auto max-w-[180px] object-contain',
        !visible && 'hidden',
        className,
      )}
      onLoad={() => setVisible(true)}
      onError={() => setVisible(false)}
    />
  );
}
