# Cloud-Auftrag #22: Master-Tätigkeitsbereiche (abrechnungsrelevant)

## Produktentscheidungen (Defaults aus Plan)

1. **Nur Master-Monteur** (`worker.masterEngineer === true`)
2. **Segmente während der Schicht** (Wechsel ohne Ausstempeln)
3. Katalog unter **Einstellungen** pflegbar
4. Seed: Anfahrt, Abfahrt, Besprechung, Montagetätigkeit, Training
5. Pflichtauswahl beim Einstempeln für Master; Wechsel-Button am Kiosk/Worker-App
6. Stundenzettel: Minuten je Tätigkeit pro Tag; PDF/UI; v1 ohne eigenen Stundensatz

## Datenmodell

- `ActivityType` (code, name, sortOrder, active, billable)
- `TimeActivitySegment` (workerId, projectId, activityTypeId, startedAt, endedAt?)
- `WeeklyTimesheetDayActivity` (dayId, activityTypeId, minutes) – Snapshot bei Generierung

## API

- CRUD `/activity-types` (OFFICE/SUPERADMIN/PM)
- `GET /activity-types?active=true` auch für WORKER (Master braucht Liste)
- `POST /time-entries/clock-in` + optional/pflicht `activityTypeId` (Master: Pflicht)
- `POST /time-entries/switch-activity` { workerId, activityTypeId, GPS… }
- Clock-Out schließt offenes Segment
- Status liefert `currentActivity`

## UI

- Einstellungen → Tätigkeitsbereiche
- Kiosk/Worker-App (Master): Auswahl vor Clock-In, Wechsel während Schicht
- Stundenzettel-Detail + PDF: Aufschlüsselung

## GPS

- Bei Tätigkeitswechsel: `GpsEventType.ACTION`

## Abnahme

1. Master ohne Tätigkeit → Clock-In 400
2. Master Clock-In mit Anfahrt → Segment offen
3. Wechsel zu Montage → Segment Anfahrt geschlossen, Montage offen
4. Clock-Out → Segment geschlossen
5. Stundenzettel generieren → Minuten je Tätigkeit
6. Normaler Monteur: unverändert ohne Tätigkeit
7. Build grün, Deploy api+web

Commit: `feat: Master-Tätigkeitsbereiche für Stempel und Stundenzettel`
