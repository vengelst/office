# Claude Code – Auftrag #6: Web-Monteur Arbeitsitems + PWA (Parität zur APK)

## Kontext

Repo: Office-Monorepo. Aufträge #1–#5 sind live (API, Büro, Mobile APK, Kunden-PL, PDF).

**Problem:** Monteure auf Android haben volle Arbeitsitems-UI in der APK. iPhone/iPad und der Web-Kiosk können nur stempeln → **Feature-Drift**. Der Benutzer will **keinen Drift**: Web (inkl. Apple) und Android-APK müssen **funktional identisch** sein.

**Spez:** `SPEZ-arbeitsitems.md` Abschnitte 4.1, 5, 6, 8.2, 13  
**Referenz-Implementierung (verbindlich nachbauen):**  
- `apps/mobile/app/(app)/work-items/index.tsx`  
- `apps/mobile/app/(app)/work-items/[id].tsx`  
- `apps/mobile/lib/work-items.ts`  
- `apps/mobile/lib/i18n-work-items.ts`  
- Dashboard-Einstieg in `apps/mobile/app/(app)/index.tsx`

**Bestehende Web-Stempel-Flächen (erweitern, nicht ersetzen):**  
- `/worker-app` – persönlicher Monteur (ideal iPhone/PWA)  
- `/kiosk` – Shared-Tablet nach Setup (Projekt fest)  
- Worker-JWT: `office_worker_token` via `kioskApi` / `workerApi` in `apps/web/src/lib/timesheets.ts`

**API (fertig, nicht neu erfinden):** Worker-Endpoints aus Auftrag #3/#5  
(`GET /workers/me/work-items`, claim, sessions, complete/rework, pdf). Auth: Worker-Bearer.

---

## Nicht-Ziele

- Keine Änderungen an Büro-Work-Items oder Kunden-PL-Board
- Kein Expo/React-Native-Code umbauen (außer ggf. Kommentar/Hinweis in STATUS)
- Kein Offline-First / Sync (PWA darf Cache für Shell haben, aber keine Offline-Arbeitsitems-Logik)
- Keine neue Backend-Fachlogik außer klaren Bugfixes, falls ein Endpoint für Browser (CORS, Content-Disposition PDF) hakt

---

## Paritäts-Prinzip (verbindlich)

1. **Gleiche Flows, gleiche Guards, gleiche API** wie Mobile.  
2. UI darf Web/Touch-optimiert sein (HTML), aber **keine fehlende Aktion** gegenüber der APK.  
3. Büro-`workItemsApi` (`office_token`) **nicht** wiederverwenden – neuer Worker-Client.  
4. i18n DE+SK: Texte aus `apps/mobile/lib/i18n-work-items.ts` **1:1 übernehmen** (nicht neu erfinden).  
5. In `SPEZ-arbeitsitems.md` Abschnitt 13 ergänzen: „Monteur-Oberfläche = Mobile **und** Web (`/worker-app` + `/kiosk`), feature-paritätisch.“

### Paritäts-Checkliste (muss alles grün sein)

| # | Flow | Mobile | Web (neu) |
|---|---|---|---|
| 1 | Einstieg nur wenn clocked-in **und** `itemBased` | ✓ | ☐ |
| 2 | Liste: currentSession / mine / open + Suche `itemKey` | ✓ | ☐ |
| 3 | Claim (Nehmen) | ✓ | ☐ |
| 4 | Session start/stop (aktuell); Hinweis wenn nicht clocked-in | ✓ | ☐ |
| 5 | Detail: Metadaten, Umfang DE+SK, Material DE+SK | ✓ | ☐ |
| 6 | Block-PDF öffnen (Worker-PDF-Endpoint, Blob/iframe) | ✓ | ☐ |
| 7 | Fertig: ≥2 Fotos (Kamera/Datei), multipart `photos` | ✓ | ☐ |
| 8 | Nacharbeit: Kommentar + optionale Fotos | ✓ | ☐ |
| 9 | Labels DE+SK | ✓ | ☐ |
| 10 | Stempel-Logik unverändert regressiv | ✓ | ☐ |

---

## 1. Worker Work-Items Client (Web)

Neu: `apps/web/src/lib/worker-work-items.ts` (Name frei, klar getrennt von Büro-`work-items.ts`).

- Nutzt denselben Token wie `workerApi` / `kioskApi` (`getWorkerToken` / `office_worker_token`)
- Methoden analog Mobile `workItemsApi`: `mine`, `one`, `claim`, `startSession`, `stopSession`, `complete`, `rework`, `openPdf` (Blob-URL)
- Typen möglichst an Mobile spiegeln; wo sinnvoll gemeinsame Typen in `packages/types` – **nur wenn ohne großen Umbau**
- `MIN_COMPLETION_PHOTOS = 2` konstant halten

Optional aber erwünscht gegen Drift: kleine Datei `apps/web/src/lib/i18n-work-items.ts` als Kopie der Mobile-Texte (Kommentar: „Sync mit apps/mobile/lib/i18n-work-items.ts“).

---

## 2. Shared Monteur-UI-Komponenten (Web)

Unter z. B. `apps/web/src/components/worker-work-items/`:

- `work-items-list.tsx` – Liste + Suche + Sektionen  
- `work-item-detail.tsx` – Detail + Aktionen  
- `complete-rework-dialog.tsx` – Foto-Auswahl (≥2), Kommentar  
- ggf. `status-badge.tsx`, `material-table.tsx`

**Wichtig:** Eine Implementierung, zwei Einstiege (worker-app + kiosk). Kein Copy-Paste zweier Screens.

Touch-first, dunkles Theme wie Kiosk/worker-app, große Buttons.

Foto-Upload im Browser: `<input type="file" accept="image/*" capture="environment" multiple>` + Vorschau; min. 2 vor Submit bei Complete.

PDF: `GET /workers/me/work-items/:id/pdf?inline=1` mit Bearer → Blob → neues Tab oder eingebettetes `<iframe>`/`object`.

---

## 3. Integration `/worker-app`

Dateien: `apps/web/src/app/worker-app/dashboard/page.tsx` (+ ggf. neue Routen).

- Wenn eingestempelt und aktives Projekt `itemBased === true`: prominenter Button **„Arbeitsitems / Pracovné položky“**
- Routen z. B.:
  - `/worker-app/work-items?projectId=`
  - `/worker-app/work-items/[id]`
- Auth-Gate wie Dashboard (Worker-Token vorhanden)
- `workerApi.me()` muss `itemBased` am Project liefern (API bereits seit #3; prüfen/anzeigen)

---

## 4. Integration `/kiosk`

Datei: `apps/web/src/app/kiosk/terminal/page.tsx` (+ ggf. Unterrouten unter `/kiosk/…`).

Nach erfolgreichem PIN-Login + Clock-In (oder wenn bereits clocked-in auf dem Kiosk-Projekt):

- Wenn Kiosk-Projekt `itemBased`: Button/Action **Arbeitsitems** → gleiche Shared-Komponenten
- `projectId` aus `office_kiosk_config` (festes Projekt)
- Auto-Logout / Idle-Timer des Kiosks **nicht brechen** (Activity auf Items-Screens zählt als Aktivität, falls Timer existiert)
- Admin-PIN / Setup unverändert
- Shared-PIN-Pad-Flow für Stempel bleibt Primärpfad; Items sind Zusatz nach Login

Falls Kiosk-Setup das Projekt lädt: `itemBased` beim Speichern der Config mitziehen **oder** zur Laufzeit aus `me`/Projekt-Status lesen – klar und robust.

---

## 5. PWA (installierbar auf iPhone + Android)

Ziel: Monteur kann „Zum Home-Bildschirm“ / Install App – **gleiche Web-App**, kein zweiter Codepfad.

Mindestumfang:

1. `apps/web/public/manifest.webmanifest` (oder `manifest.json`)
   - name/short_name: z. B. „VH Kiosk“ / „Vivahome Monteur“
   - `start_url`: `/worker-app` (persönliche Session; sinnvoll für iPhone)
   - `display`: `standalone`
   - `background_color` / `theme_color` dunkel wie Kiosk
   - Icons: vorhandene Assets nutzen oder einfache 192/512 PNG unter `public/icons/` erzeugen (keine riesigen Binaries committen wenn vermeidbar – SVG + generierte PNGs ok)
2. Link im Root-Layout **oder** gezielt in `worker-app`/`kiosk`-Layouts:  
   `<link rel="manifest" …>` + Apple-Meta:
   - `apple-mobile-web-app-capable`
   - `apple-mobile-web-app-status-bar-style`
   - `apple-touch-icon`
3. Service Worker: **leicht** – App-Shell cachen reicht. Kein aggressives Offline für API.  
   Wenn `next-pwa` zu invasiv: manueller SW unter `public/sw.js` + Registrierung nur auf `/worker-app` und `/kiosk`. Lieber simpel und stabil als komplex.
4. Download-Seite (`/download`) ergänzen: Hinweis „iPhone/iPad: PWA über Safari → Teilen → Zum Home-Bildschirm“ + Link zu `/worker-app` bzw. Kiosk-Doku. Android: weiterhin APK **und** optional PWA.

HTTPS ist auf office.vivahome.de bereits gegeben.

---

## 6. Doku

- `SPEZ-arbeitsitems.md` §13: Web-Monteur = Mobile, Paritätspflicht  
- Kurz in `STATUS.md` oder `PROJECT-STATUS.md`: Web-Kiosk/worker-app Arbeitsitems + PWA  
- Kommentar in `apps/mobile/lib/i18n-work-items.ts` und Web-Kopie: bei Textänderungen **beide** aktualisieren

---

## 7. Qualität

- TypeScript clean, keine `any`-Orgie
- Bestehende Stempel-Flows manuell denkbar regressiv (Clock in/out, Foto, Setup)
- Keine Secrets committen
- Keine unnötigen Dependencies; PWA möglichst ohne schwere Libs

---

## Done wenn

1. Auf `/worker-app` und `/kiosk` sind alle Punkte der Paritäts-Checkliste umsetzbar.  
2. Gleiche Worker-API wie Mobile; keine Office-JWT-Workarounds.  
3. PWA: Manifest + Icons + Apple-Meta; unter Safari „Zum Home-Bildschirm“ sinnvoll startbar.  
4. `/download` erklärt APK (Android) und PWA (iOS/Android).  
5. SPEZ §13 aktualisiert.  
6. Kurzer Self-Check / Notizen was getestet wurde (Text im Commit oder kurze `claude-auftraege`-Notiz).

---

## Hinweis Workflow

Nach Abschluss: Commit auf `main` mit klarer Message. Deploy macht Cursor/User separat (git push + Server). Kein lokales Docker Compose nötig.
