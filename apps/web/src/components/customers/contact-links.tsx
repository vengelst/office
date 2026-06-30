'use client';

import { Mail, MapPin, Phone, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildMapsUrl } from '@/lib/format';
import { texts } from '@/lib/texts';

/** Klickbarer Telefon-Link (tel:) – öffnet die Telefon-App auf Mobilgeräten. */
export function PhoneLink({
  phone,
  mobile,
}: {
  phone?: string | null;
  mobile?: boolean;
}): React.ReactNode {
  if (!phone) return <span className="text-muted-foreground">–</span>;
  const Icon = mobile ? Smartphone : Phone;
  return (
    <a
      href={`tel:${phone.replace(/\s+/g, '')}`}
      className="inline-flex min-h-[44px] items-center gap-1.5 text-primary hover:underline"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{phone}</span>
    </a>
  );
}

/** Klickbarer E-Mail-Link (mailto:). */
export function MailLink({ email }: { email?: string | null }): React.ReactNode {
  if (!email) return <span className="text-muted-foreground">–</span>;
  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex min-h-[44px] items-center gap-1.5 break-all text-primary hover:underline"
    >
      <Mail className="h-4 w-4 shrink-0" />
      <span>{email}</span>
    </a>
  );
}

/** "Route öffnen"-Button → Google Maps / native Maps-App. */
export function RouteButton({
  latitude,
  longitude,
  mapsUrl,
  address,
}: {
  latitude?: number | null;
  longitude?: number | null;
  mapsUrl?: string | null;
  address?: string;
}): React.ReactNode {
  const url = buildMapsUrl(latitude, longitude, mapsUrl, address);
  if (!url) return null;
  return (
    <Button asChild variant="outline" size="sm" className="min-h-[44px]">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MapPin className="h-4 w-4" />
        {texts.customers.actions.openRoute}
      </a>
    </Button>
  );
}
