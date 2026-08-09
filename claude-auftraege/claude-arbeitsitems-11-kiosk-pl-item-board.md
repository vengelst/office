# Cloud-Auftrag #11: Kunden-PL Item-Board am Kiosk

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de`.

**SPEZ** (`SPEZ-arbeitsitems.md` §4.2 / §7 / §13): Primärer Einstieg des Kunden-PL ist der **Kiosk mit PIN** – Fortschritt sehen, Items prüfen / selbst fertigsetzen, Wochen-Stundenzettel abzeichnen.

**Ist-Zustand:**
- `/kiosk/pl` (Auftrag #9/#10): PIN → eingereichte Wochenzettel → Signatur + Approve + PDF-Mail
- `/pl/projects/[projectId]` (Office-Login): volles **Item-Board** (Statusfilter, Suche, Detail-Drawer mit Fotos, Approve / Force-Complete)
- API bereits vorhanden und rollengeschützt (`CUSTOMER_PL` + Projektzuordnung):
  - `GET /pl/projects/:projectId/work-items`
  - `GET /pl/work-items/:id`
  - `GET /pl/work-items/:id/photos/:documentId`
  - `POST /work-items/:id/reviews/approve`
  - `POST /work-items/:id/reviews/force-complete`

**Lücke:** Am Kiosk fehlt das Item-Board. Der Kunde müsste sonst in die Office-App – das ist ausdrücklich **nicht** gewollt.

---

## Ziel

Nach Abschluss kann der Kunden-PL am Baustellen-Tablet (`/kiosk/pl`) **ohne Office-Login**:

1. Per PIN anmelden (unverändert)
2. Zwischen **Arbeitsitems** und **Stundenzettel** wechseln
3. Item-Board des konfigurierten Kiosk-Projekts bedienen (Touch): Status-Zähler, Suche, Liste
4. Item öffnen → Fotos der Fertigmeldung sehen → **Prüfen (Approve)** oder **selbst fertigsetzen (Force-Complete)**
5. Stundenzettel-Flow bleibt wie heute (Liste → Detail → Signatur → Approve → PDF-Mail)
6. Auto-Logout / Idle wie bestehender Kiosk-PL; keine Navigation in die Office-App

---

## Nicht-Ziele

- Keine neuen API-Endpunkte (bestehende `/pl/**` und Review-Routen nutzen)
- Kein neues Auth-Modell (weiterhin `user-pin-login` → User-JWT in `office_kiosk_pl_token`)
- Keine Mobile-APK-Änderung
- Kein Büro-/Office-Refactor außer ggf. leichte Extraktion wiederverwendbarer UI-Teile
- Keine Offline-Unterstützung in diesem Auftrag
- Kein PDF-Seitensprung / Monteur-Paritätsthemen

---

## 1. Architektur / Token

Bestehend in `apps/web/src/app/kiosk/pl/page.tsx`:

- Token: `localStorage` Key `office_kiosk_pl_token`
- Helper `plFetch(path, opts)` setzt `Authorization: Bearer …`

**Regel:** Alle Board-/Detail-/Review-/Foto-Calls laufen über denselben Token-Pfad (entweder `plFetch` erweitern für Binary/Stream oder schmalen Wrapper analog `customerPlApi`, der den Kiosk-Token liest – **nicht** den Office-`apiClient` mit `office_token`).

Fotos: `GET /pl/work-items/:id/photos/:documentId` als Blob → Object-URL (wie `PlItemDetailSheet` / `ReportPhoto` unter `/pl`).

Projekt-ID: immer `config.projectId` aus `office_kiosk_config` (Kiosk-Setup). Kein Projektwechsel am Tablet.

---

## 2. UI – `/kiosk/pl`

### 2.1 Navigation nach Login

Nach erfolgreichem PIN-Login: **Hauptansicht mit zwei Bereichen** (Tabs oder große Segment-Buttons, Touch ≥44px):

| Tab | Inhalt |
|---|---|
| **Arbeitsitems** (Default, wenn Projekt `itemBased`) | Board (Abschnitt 2.2) |
| **Stundenzettel** | bestehende Liste / Detail / Signatur (bestehender Code) |

Wenn das Projekt **nicht** item-basiert ist: nur Stundenzettel anzeigen (kein leerer Items-Tab). `itemBased` aus bestehendem Projekt-Fetch oder aus `/pl/projects` (Eintrag mit passender `projectId`) ableiten – kein neuer Endpoint.

### 2.2 Item-Board (Touch)

Orientierung an `apps/web/src/app/(authenticated)/pl/projects/[projectId]/page.tsx` + `components/pl/pl-item-detail-sheet.tsx`, aber **kiosk-tauglich**:

- Status-Chips / Zähler als Schnellfilter (`OPEN`, `IN_PROGRESS`, `REVIEW`, `REWORK`, `APPROVED` – Labels aus bestehenden Texts/`WORK_ITEM_STATUS_LABELS`)
- Suchfeld Kennung / Titel / Raum (Query `q` wie API)
- Liste: Kennung, Status-Badge, Ort, Monteure, aktualisiert – große Zeilen, gut tippbar
- Tap auf Zeile → Detail (Vollbild oder großer Sheet, kein Desktop-Drawer-only)

**Empfehlung:** Logik/UI so weit wie sinnvoll aus dem Office-PL-Board extrahieren (shared Component unter `components/pl/` oder `components/kiosk/`), Kiosk-Seite orchestriert Token + Idle. Kein 1:1-Copy-Paste zweier 400-Zeilen-Duplikate.

### 2.3 Item-Detail

- Metadaten + Arbeitsumfang DE/SK (read-only)
- Reports mit Foto-Thumbnails (Stream-Endpunkt)
- Aktionen:
  - Status `REVIEW`: Button **Prüfen / OK** → `POST …/reviews/approve` (optional Kommentar)
  - Nicht `APPROVED`: Button **Selbst fertigsetzen** → Confirm → `POST …/reviews/force-complete`
- Nach Erfolg: Toast/Flash, Detail schließen, Board neu laden
- Idle-Timer während Detail/Fotos zurücksetzen (wie bei Stundenzettel-Signatur)

### 2.4 Idle / Logout

Bestehende Idle-Logik (`PL_IDLE_SECONDS` o. Ä.) bleibt. Längere Foto-Betrachtung darf nicht unnötig loggen – Idle bei Interaktion resetten. Optional Idle für Items leicht anheben (analog Terminal `max(config, 180)`), aber **kein** Separat-Config-Zwang.

---

## 3. Texte

- `texts.ts`: Kiosk-PL-Strings für Tabs, Board, Detail-Aktionen, Fehler (DE)
- Status-Labels können bestehende `WORK_ITEM_STATUS_LABELS` / `texts.customerPl` nutzen
- Keine DE+SK-Pflicht für Kunden-PL-UI (SPEZ DE+SK gilt für Monteur)

---

## 4. Akzeptanzkriterien

1. Kiosk-Setup Modus Kunden-PL + Projekt → `/kiosk/pl` → PIN → Tabs Items | Stundenzettel
2. Board zeigt Items des Kiosk-Projekts; Filter Status + Suche funktionieren
3. Item in `REVIEW`: Approve → Status `APPROVED`, Board aktualisiert
4. Force-Complete mit Bestätigung → `APPROVED`, Zuordnungen laut bestehender API-Logik
5. Fotos der Fertigmeldung sichtbar (keine 403)
6. Stundenzettel-Flow (#9/#10) unverändert grün
7. Logout/Idle löscht PL-Token; kein Zugriff auf Office-Routen `/customers` usw.
8. Worker-Kiosk `/kiosk/terminal` unverändert
9. Kein neuer Prisma-Migration nötig

---

## 5. Testhinweise (Produktion / Staging)

- Kunden-PL mit PIN und Zuordnung an item-basiertem Projekt
- Mind. 1 Item in `REVIEW` mit ≥2 Fotos (Monteur-Flow vorbereiten)
- Tablet-Viewport / Touch prüfen
- Negative: User ohne Projektzuordnung → API 403, UI sauberer Fehler

---

## 6. Dateien (Orientierung)

| Bereich | Pfad |
|---|---|
| Kiosk-Seite | `apps/web/src/app/kiosk/pl/page.tsx` (erweitern oder in Unterkomponenten splitten) |
| Office-Board (Referenz / Extrakt) | `apps/web/src/app/(authenticated)/pl/projects/[projectId]/page.tsx` |
| Detail-Sheet (Referenz / Extrakt) | `apps/web/src/components/pl/pl-item-detail-sheet.tsx` |
| API-Client Office | `apps/web/src/lib/work-items.ts` → `customerPlApi` (Muster; Kiosk braucht eigenen Token-Pfad) |
| Backend (nur lesen) | `customer-pl-work-items.controller.ts`, `work-item-workflow.service.ts` |

---

## Kurzformel

> Kiosk-PL = PIN + **Item-Board** + Stundenzettel. Gleiche API wie `/pl`, anderer Einstieg, Touch-UI, kein Office-Login.
