import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';

/**
 * PWA-Kopfdaten der Monteur-App: Manifest + Apple-Meta, damit iPhone/iPad die
 * Seite über Safari → Teilen → „Zum Home-Bildschirm“ als App starten
 * (`start_url` des Manifests ist `/worker-app`).
 */
export const metadata: Metadata = {
  title: 'Monteur-App',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'VH Monteur',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1220',
  viewportFit: 'cover',
};

/**
 * Eigenständiges Layout der Monteur-App (Mobile-First, KEINE Sidebar/Header).
 * Zentriert den Inhalt in einer schmalen, touch-optimierten Spalte.
 */
export default function WorkerAppLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-sm">
        <RegisterServiceWorker />
        {children}
      </div>
    </div>
  );
}
