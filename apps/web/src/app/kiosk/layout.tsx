import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { KioskLocaleProvider } from '@/lib/kiosk-locale';

/**
 * Kiosk-Layout inkl. PWA-Kopfdaten – das Tablet kann den Kiosk damit als
 * eigenständige App (Vollbild, ohne Browser-Leisten) starten.
 */
export const metadata: Metadata = {
  title: 'Kiosk-Terminal',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'VH Kiosk',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  viewportFit: 'cover',
};

export default function KioskLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <KioskLocaleProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <RegisterServiceWorker />
        {children}
      </div>
    </KioskLocaleProvider>
  );
}
