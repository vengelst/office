import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { KioskInstallPrompt } from '@/components/kiosk/kiosk-install-prompt';
import { KioskLocaleProvider } from '@/lib/kiosk-locale';

/**
 * Kiosk-Layout inkl. PWA-Kopfdaten – Smartphone/Tablet speichern den Kiosk als
 * eigenständige App (Vollbild). Manifest startet auf /kiosk (nicht worker-app).
 */
export const metadata: Metadata = {
  title: 'Vivahome Kiosk',
  applicationName: 'VH Kiosk',
  manifest: '/manifest-kiosk.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'VH Kiosk',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
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
        <KioskInstallPrompt />
      </div>
    </KioskLocaleProvider>
  );
}
