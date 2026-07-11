'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { texts } from '@/lib/texts';

type MapSize = 'small' | 'medium' | 'large';

const SIZE_CONFIG: Record<MapSize, { height: number; label: string }> = {
  small: { height: 200, label: texts.map.sizeSmall },
  medium: { height: 350, label: texts.map.sizeMedium },
  large: { height: 500, label: texts.map.sizeLarge },
};

function storageKey(entityType: string): string {
  return `office-map-size-${entityType}`;
}

interface LocationMapProps {
  lat: number;
  lng: number;
  label?: string;
  entityType: string;
}

export function LocationMap({ lat, lng, label, entityType }: LocationMapProps) {
  const t = texts.map;

  const [size, setSize] = useState<MapSize>('medium');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(entityType));
      if (saved && (saved === 'small' || saved === 'medium' || saved === 'large')) {
        setSize(saved);
      }
    } catch {
      // localStorage unavailable
    }
  }, [entityType]);

  const changeSize = (s: MapSize) => {
    setSize(s);
    try {
      localStorage.setItem(storageKey(entityType), s);
    } catch {
      // localStorage unavailable
    }
  };

  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=17&output=embed`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          {(Object.keys(SIZE_CONFIG) as MapSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSize(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                size === s
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {SIZE_CONFIG[s].label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={routeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t.route}
          </a>
        </Button>
      </div>

      <div
        className="w-full overflow-hidden rounded-lg border"
        style={{ height: SIZE_CONFIG[size].height }}
      >
        <iframe
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          title={label ?? `${lat}, ${lng}`}
        />
      </div>

      {label && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {label}
        </p>
      )}
    </div>
  );
}
