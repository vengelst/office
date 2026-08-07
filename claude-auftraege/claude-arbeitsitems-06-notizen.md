# Auftrag #6 – Web-Monteur Arbeitsitems + PWA: Umsetzung & Self-Check

Ergänzung zu `claude-arbeitsitems-06-web-kiosk-pwa.md` (Auftragstext).

## Was gebaut wurde

| Bereich | Datei(en) |
|---|---|
| Worker-Client (Worker-JWT) | `apps/web/src/lib/worker-work-items.ts` |
| Texte DE+SK (Kopie der APK) | `apps/web/src/lib/i18n-work-items.ts` |
| Gemeinsame UI | `apps/web/src/components/worker-work-items/{work-items-list,work-item-detail,complete-rework-dialog,status-badge,material-table}.tsx` |
| Einstieg persönlich | `apps/web/src/app/worker-app/work-items/**`, Button im Dashboard |
| Einstieg Kiosk | `apps/web/src/app/kiosk/terminal/page.tsx` (States `items` / `itemDetail`) |
| PWA | `public/manifest.webmanifest`, `public/icons/*`, `public/sw.js`, `components/pwa/register-service-worker.tsx`, Metadata in `worker-app/layout.tsx` + `kiosk/layout.tsx` |
| Doku | `SPEZ-arbeitsitems.md` §13, `STATUS.md` §20, Sync-Hinweis in beiden i18n-Dateien |

## Entscheidungen

- **Ein Screen, zwei Einstiege:** `/worker-app` navigiert über Routen, der Kiosk
  rendert dieselben Komponenten als zusätzliche Zustände seiner State-Machine.
  So bleiben Worker-Session, PIN-Flow und Auto-Logout des Kiosks intakt.
- **`itemBased` zur Laufzeit** aus `/worker-auth/me` (Zuweisung des angemeldeten
  Monteurs) statt aus der Kiosk-Config im LocalStorage: alte Configs kennen das
  Flag nicht, und der Item-Modus kann im Büro jederzeit umgeschaltet werden.
  Die Kiosk-Setup-Seite bleibt damit unverändert.
- **Auto-Logout:** läuft auf den Items-Screens weiter, jede Berührung setzt ihn
  zurück. Das Fenster ist dort aber mindestens 180 s (`ITEMS_IDLE_SECONDS`) –
  15 s passen zum Stempeln mit zwei Tipps, nicht zum Lesen einer Arbeitskarte
  oder zum Fotografieren. Der Zähler wird erst ab 30 s Restzeit eingeblendet.
- **Block-PDF:** per `fetch` mit Bearer-Token als Blob geladen und im Overlay
  gezeigt (`<iframe>` + „In neuem Tab öffnen“ als Fallback, weil iOS Safari PDFs
  im iframe nicht zuverlässig rendert). Direktlink geht nicht – der Endpunkt
  verlangt das Token. Blob-URLs werden beim Schließen/Unmount freigegeben.
- **Fotos:** zwei `<input type="file">` – „Kamera“ mit `capture="environment"`,
  „Galerie“ mit `multiple`. Upload als Multipart-Feld `photos`, ≥2 bei Fertig
  (Button bleibt sonst gesperrt, zusätzlich Hinweis DE+SK).
- **Kein Backend-Änderung nötig:** die Monteur-Endpunkte aus #3/#5 liefern
  bereits `Content-Disposition: inline` (`?inline=1`) und CORS ist gesetzt.
- **Kein Offline:** Service Worker cacht nur `/_next/static/**` und `/icons/**`,
  Navigationen und API laufen immer ans Netz.

## Paritäts-Checkliste

| # | Flow | Web |
|---|---|---|
| 1 | Einstieg nur clocked-in **und** `itemBased` | ✅ Dashboard-Button + Kiosk-Button nur in diesem Fall |
| 2 | Liste currentSession / mine / open + Suche | ✅ inkl. Projekt-Filter (`projectId`) |
| 3 | Claim (Nehmen) | ✅ |
| 4 | Session start/stop + Hinweis ohne Stempel | ✅ Warnkarte in der Liste, Guard im Detail |
| 5 | Detail: Metadaten, Umfang DE+SK, Material DE+SK | ✅ |
| 6 | Block-PDF öffnen | ✅ Blob + Overlay/neuer Tab |
| 7 | Fertig ≥2 Fotos (Kamera/Datei), multipart `photos` | ✅ |
| 8 | Nacharbeit: Kommentar + optionale Fotos | ✅ |
| 9 | Labels DE+SK | ✅ Texte 1:1 aus der APK |
| 10 | Stempel-Logik unverändert | ✅ keine Änderung an Clock-In/Out, Foto, PIN, Setup |

## Getestet

- `next build`: kompiliert (`✓ Compiled successfully`). Die anschließende
  Typprüfung bricht **lokal** in `src/app/layout.tsx` (next-themes) ab – das
  passiert unverändert auch auf dem sauberen HEAD ohne diese Änderungen
  (doppelte `@types/react` 18/19 durch `apps/mobile` im lokalen pnpm-Store).
  Gegenprobe: `tsc --noEmit` meldet **null** Fehler in allen neuen/geänderten
  Dateien; `next lint` auf denselben Dateien ist sauber.
- Dev-Server-Smoke-Test (HTTP 200): `/worker-app/work-items`,
  `/worker-app/work-items/<id>`, `/kiosk/terminal`, `/download`,
  `/manifest.webmanifest` (`application/manifest+json`), `/sw.js`.
- Ausgeliefertes HTML enthält `link rel="manifest"`,
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
  `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, `theme-color`.

## Noch am Gerät zu prüfen (braucht API + echte Daten)

- PIN-Login → Einstempeln → Arbeitsitems auf iPhone (Safari, PWA) und Tablet.
- Fertigmeldung mit 2 Fotos aus der Kamera (Upload-Größe, HEIC von iOS).
- Block-PDF auf iOS im Overlay bzw. über „In neuem Tab öffnen“.
- „Zum Home-Bildschirm“ auf iOS: Start in `/worker-app`, Vollbild ohne Adressleiste.
