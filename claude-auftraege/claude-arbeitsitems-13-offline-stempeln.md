# Cloud-Auftrag #13: Offline-Stempeln (PWA / Kiosk)

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de`.

**Problem:** Baustellen haben oft schlechtes/kein Netz. Monteur-PWA (`/worker-app`) und Kiosk (`/kiosk/terminal`) brauchen aktuell Server-Antworten für Clock-In/Out – Stempelung schlägt fehl oder wirkt „kaputt“.

**Ist-Zustand:**
- `POST /time-entries/clock-in` / `clock-out` mit optionalem `occurredAtClient` + GPS
- `TimeEntry` ohne Client-Idempotenz-Schlüssel
- SW (`apps/web/public/sw.js`): nur `/_next/static` + Icons – **kein** Offline für API/HTML (Kommentar: bewusst)
- Surfaces: `apps/web/src/app/worker-app/dashboard/page.tsx`, `apps/web/src/app/kiosk/terminal/page.tsx`
- Mobile-APK hat eigenen Clock-Flow – **nicht** Gegenstand dieses Auftrags (kommt mit #9 / Parität später); API-Änderungen müssen APK aber nicht brechen

---

## Ziel

Nach Abschluss:

1. Monteur kann **Ein-/Ausstempeln**, auch wenn das Gerät offline oder der Request fehlschlägt (Netz-Timeout)
2. Stempelungen landen in einer **lokalen Queue** und werden bei Wiederkehr des Netzes **automatisch** an die API gesendet
3. UI zeigt klar: Offline / wartende Stempelungen / Sync-Fehler
4. Server akzeptiert verzögerte Events **idempotent** (kein Doppel-Stempel bei Retry)
5. Online-Verhalten bleibt unverändert (kein Pflicht-Umweg über Queue, wenn Request sofort ok)

---

## Nicht-Ziele

- Kein Offline für Arbeitsitems (Claim, Fotos, PDF, Reports)
- Kein Offline-PIN-Login / keine gecachte Projektliste als voller Offline-Katalog (siehe Grenzen)
- Kein Offline für Kunden-PL-Kiosk
- Keine Background-Sync-API-Pflicht (nice-to-have; `online`-Event + App-Focus reichen)
- Kein neues Push / Background-Fetch
- Keine Mobile-APK-UI in diesem Auftrag
- Kein Umbau der Wochenzettel-Logik außer dass nach Sync dieselben TimeEntries entstehen

---

## Grenzen / Annahmen (verbindlich)

1. **PIN/Login braucht Netz einmalig.** Offline-Stempeln gilt nur in einer **bereits authentifizierten** Worker-Session (gültiges Token in localStorage). Bei 401 beim Sync: Queue behalten, Hinweis „Bitte erneut anmelden – Stempelungen warten“.
2. **Kiosk:** festes `projectId` aus Setup; Worker-App: gewähltes Projekt wie heute. Offline darf **nicht** still ein anderes Projekt wählen.
3. **GPS:** wenn offline nicht verfügbar → Stempel trotzdem queue’n (lat/lon optional null); wenn erfasst → mitspeichern.
4. **Reihenfolge:** Queue FIFO pro Worker. Clock-Out darf erst gesendet werden, wenn vorangehendes Clock-In derselben Session synced ist (oder lokal als Paar gekoppelt).
5. **Uhrzeit:** `occurredAtClient` = Zeitpunkt des Tippens (ISO), nicht Sync-Zeit. Server speichert weiter `occurredAtServer` = Empfangszeit.

---

## 1. API / Prisma – Idempotenz

### 1.1 Schema

`TimeEntry` erweitern:

```prisma
clientEventId String? @unique  // UUID vom Client; null = Alt/Online-ohne-Id
```

Migration anlegen.

### 1.2 DTO

`ClockInDto` / `ClockOutDto` um optionales Feld:

```ts
clientEventId?: string; // UUID v4
```

### 1.3 Verhalten

- Wenn `clientEventId` gesetzt und **bereits** ein TimeEntry damit existiert → **200/OK** mit aktuellem `getStatus` (Idempotent Replay), **kein** zweites Insert, **kein** Conflict.
- Wenn `clientEventId` fehlt → bisheriges Verhalten.
- Clock-In bei bereits eingestempelt **ohne** passende Idempotenz:
  - Wenn Offline-Sync ein IN nachliefert und Server schon IN hat: wenn gleiches `projectId` → Idempotent-OK (Status zurück); wenn anderes Projekt → 409 mit klarer Message (Queue-Eintrag als failed markieren, UI).
- Clock-Out ohne offenen IN: 409 → failed in Queue (nach manueller Klärung / Büro).

Kein Batch-Endpoint zwingend; einzeln syncen reicht. Optional später `POST /time-entries/sync` – **nicht Pflicht**.

---

## 2. Client – Queue & Sync

Gemeinsames Modul, z. B. `apps/web/src/lib/offline-clock-queue.ts` (+ ggf. kleine Hooks/Helper):

### 2.1 Speicher

- **IndexedDB** (bevorzugt) oder robustes localStorage-JSON mit Größenlimit
- Einträge: `{ id: clientEventId, type: 'CLOCK_IN'|'CLOCK_OUT', workerId, projectId, occurredAtClient, gps?, sourceDevice?, createdAt, status: 'pending'|'syncing'|'failed', lastError? }`

### 2.2 API-Wrapper

`workerApi.clockIn` / `clockOut` und `kioskApi.clockIn` / `clockOut` (beide nutzen Worker-Token):

1. Online-Versuch mit `clientEventId` (immer generieren)
2. Bei Erfolg: fertig
3. Bei Netzfehler / Offline / Timeout: in Queue legen, **lokalen Status optimistisch** setzen, UI Success-Hinweis „Gespeichert – wird synchronisiert“
4. Bei 4xx (außer behandelter Idempotenz): Fehler zeigen, **nicht** queue’n (außer spezifizierte Konflikte nach Retry)

### 2.3 Sync

- Trigger: `window` `online`, App-Focus/`visibilitychange`, nach Login, periodisch (z. B. 30–60 s solange Queue nicht leer)
- FIFO senden; bei Erfolg Eintrag entfernen; bei Idempotent-OK entfernen
- Parallelität: **1** Request gleichzeitig pro Gerät (keine Race)

### 2.4 Lokaler Status

Solange pending IN ohne Server-Bestätigung: UI zeigt eingestempelt (wie nach Erfolg), inkl. laufender Timer ab `occurredAtClient`.  
Nach Sync: Status vom Server refreshen.

---

## 3. UI

### 3.1 Worker-App Dashboard + Kiosk Terminal

- Banner/Badge: **Offline** (navigator.onLine + fehlgeschlagene Requests)
- Badge: „X Stempelung(en) ausstehend“
- Bei `failed`: kurzer Fehlertext + optional „Erneut versuchen“ (Sync anstoßen)
- Texte DE (+ SK wo die Surface schon zweisprachig ist; Kiosk-Stempel-Texte derzeit DE in `texts.kiosk` – konsistent halten)

### 3.2 Service Worker

`sw.js` **leicht** erweitern, damit die PWA-Shell offline startet:

- Zusätzlich cache’n (App-Shell): `/worker-app`, `/worker-app/dashboard`, `/kiosk`, `/kiosk/terminal` (Navigation fallback auf gecachte Shell)
- **Weiterhin keine** API-Caches (`/api/**` nie)
- Cache-Name bump (`vh-shell-v2`)

Ziel: App öffnet sich offline und zeigt Queue/UI; Stempel-Buttons funktionieren über Queue.

---

## 4. Sicherheit / Auth

- Queue nur für den eingeloggten `workerId`; bei Logout Queue **dieses** Workers behalten oder mit Token löschen?  
  **Festlegung:** Bei Logout Queue **nicht** stillschweigend löschen (Stempelungen sind Lohn-relevant) – aber ohne Token nicht syncbar. Beim nächsten Login desselben Workers weiter syncen; wenn anderer Worker: fremde Queue-Einträge nicht mischen (Key nach `workerId`).
- Keine Secrets in der Queue außer dem was schon im Token steckt.

---

## 5. Akzeptanzkriterien

1. Gerät Offline (DevTools Offline): Clock-In am Worker-Dashboard und Kiosk speichert lokal, UI zeigt eingestempelt + „ausstehend“
2. Danach Online: Eintrag erscheint als `TimeEntry` mit korrektem `occurredAtClient`; Queue leer
3. Doppel-Sync / Retry erzeugt **keinen** zweiten IN (gleiche `clientEventId`)
4. Clock-Out offline nach lokalem IN → nach Sync korrekte Paarung und Brutto-Minuten plausibel
5. Online-Happy-Path unverändert schnell (kein spürbarer Extra-Dialog)
6. API ohne `clientEventId` (alte APK) funktioniert weiter
7. Work-Items / PL-Kiosk unverändert; SW cached keine API-Daten
8. Builds: `@office/api` + `@office/web` grün

---

## 6. Dateien (Orientierung)

| Bereich | Pfad |
|---|---|
| Prisma | `prisma/schema.prisma` + Migration |
| API | `time-entries.service.ts`, DTOs, Controller unverändert Routen |
| Queue | `apps/web/src/lib/offline-clock-queue.ts` (neu) |
| Clients | `apps/web/src/lib/timesheets.ts` (`workerApi` / `kioskApi`) |
| UI | `worker-app/dashboard/page.tsx`, `kiosk/terminal/page.tsx` |
| SW | `apps/web/public/sw.js` |
| Texte | `texts.ts` |

---

## 7. Testpfad

1. Chrome DevTools → Network Offline → Worker-App PIN (vorher online einloggen) → Ein → Banner → Online → Server/Live-Stempeluhr prüfen
2. Kiosk ebenso mit festem Projekt
3. Retry: Sync zweimal auslösen → nur ein TimeEntry
4. 401: Token löschen, Queue bleibt, Hinweis sichtbar

---

## Kurzformel

> Stempel tippen speichert **immer** (lokal wenn nötig). Sync später, **idempotent** per `clientEventId`. Nur Clock-In/Out – keine Offline-Items.
