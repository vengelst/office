import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import { KioskInstallPrompt } from '@/components/kiosk/kiosk-install-prompt';
import { KioskDarkBoot } from '@/components/kiosk/kiosk-dark-boot';
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

/**
 * Sofortiges Dark-Theme bevor React hydratisiert – verhindert Weiß-Flash
 * (Root-Body ist sonst hell, Kiosk-Wrapper erst nach JS dunkel).
 */
const KIOSK_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.add('dark');d.style.colorScheme='dark';var b=document.body;if(b){b.style.backgroundColor='#030712';b.style.color='#f3f4f6';}}catch(e){}})();`;

export default function KioskLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <KioskLocaleProvider>
      <script dangerouslySetInnerHTML={{ __html: KIOSK_BOOT_SCRIPT }} />
      <KioskDarkBoot />
      <div className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <RegisterServiceWorker />
        {children}
        <KioskInstallPrompt />
      </div>
    </KioskLocaleProvider>
  );
}
