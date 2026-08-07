'use client';

/**
 * Registriert den Service Worker (`/public/sw.js`) – nur auf den
 * Monteur-Oberflächen (`/worker-app`, `/kiosk`), nicht im Büro-Frontend.
 *
 * Der Worker cacht ausschließlich Buildmaterial; er existiert vor allem,
 * damit Android/Chrome die Seite als App zum Installieren anbietet.
 * Auf iOS genügt für „Zum Home-Bildschirm“ bereits das Manifest.
 */
import { useEffect } from 'react';

export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    // Fehler bewusst schlucken: ohne HTTPS (z. B. lokal über IP) schlägt die
    // Registrierung fehl, die App muss trotzdem normal laufen.
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
