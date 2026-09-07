# Cloud-Auftrag #30: Arbeiten nach Clock-Out + manuell am Stundenzettel (projektbezogene Checkboxen)

## Kontext

Master-Minuten-Tätigkeiten (`ActivityType` / Segmente) bleiben unverändert.

**Neu:** Dokumentation der **Arbeiten** einer Schicht bzw. eines Stundenzettel-Tages:
- Checkboxen aus **projektbezogenen Tätigkeiten** (nur dieses Projekt, nie die Summe aller Projekte)
- Freitext optional je nach Projekt-Flag
- Pflicht nach Clock-Out (Modal nach erfolgreichem Ausstempeln)
- Dieselbe UI beim **manuellen** Anlegen/Bearbeiten von Stundenzettel-Tagen im Office (ohne Kiosk)

## User-Festlegungen (2026-09-07)

1. Reihenfolge: **erst Clock-Out**, **dann** Pflicht-Popup.
2. Inhaltspflicht: Checkbox(en) und/oder Freitext (siehe Validierung).
3. Freitext-Feld am **Projekt** ein-/ausschaltbar.
4. Checkboxen **nicht** aus globalem Katalog, sondern aus einem **Feld/Liste am Projekt** (3–5 typische Tätigkeiten pro Projekt); anderes Projekt → andere Checkboxen.
5. Manueller Stundenzettel (Büro, ohne Kiosk): dieselben Checkboxen + Freitext müssen verfügbar sein.
6. Neue Stempel-Session nach Wiedereinstempeln = neuer Arbeits-Block.
7. „Neu laden der Zeiten“ = nur Büro-Regenerieren aus Stempeldaten – nicht Teil des Monteur-Flows.

## Ziel

1. Am Projekt: Liste projektbezogener Arbeitstätigkeiten pflegen + Flag Freitext.
2. Clock-Out → Modal mit genau diesen Checkboxen (+ Freitext wenn Flag an).
3. Office: Tag anlegen/bearbeiten mit denselben Kontrollen.
4. Speicherung pro beendetem TimeEntry; Aggregation auf Tagesanzeige/PDF.
5. Pending-Doku bis Speichern (App-Reload zeigt Modal erneut).

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Checkbox-Quelle | **Nur Projekt** – `ProjectWorkActivity` (Label-Liste am Projekt) |
| Globaler WorkTag-Katalog | **Nein** (kein Settings-CRUD für systemweite Checkboxen in v1) |
| Freitext | `Project.workNotesEnabled` (Default: `true`) |
| Reihenfolge Clock-Out | API Clock-Out zuerst, dann Pflicht-UI |
| Manuell ohne Kiosk | Office Add/Edit Day: gleiche Checkboxen/Freitext aus `day.project` / Timesheet.project |
| Validierung Freitext an | ≥1 Checkbox **oder** nicht-leerer Freitext |
| Validierung Freitext aus | ≥1 Checkbox |
| Leere Projekt-Liste | Clock-Out-Modal: wenn keine Tätigkeiten am Projekt und Freitext aus → **Konfigurationsfehler** klar melden (Büro muss Tätigkeiten hinterlegen); wenn Freitext an → nur Freitext Pflicht |
| Master-Segmente | Unberührt |
| Offline | Clock-Out ok; Doku lokal bis Sync; Pending bis gespeichert |

## Datenmodell

```text
Project
  + workNotesEnabled Boolean @default(true)
  workActivities ProjectWorkActivity[]

ProjectWorkActivity
  id, projectId, label, sortOrder, active
  @@index([projectId, active, sortOrder])

TimeEntry
  + workNotes String?
  + workDocumentedAt DateTime?   // null = Doku ausstehend nach Clock-Out
  workActivities TimeEntryWorkActivity[]  // gewählte Projekt-Tätigkeiten

TimeEntryWorkActivity
  timeEntryId, projectWorkActivityId
  @@unique([timeEntryId, projectWorkActivityId])

// Manuelle Tage ohne TimeEntry:
WeeklyTimesheetDay
  + workNotes String?
  dayWorkActivities WeeklyTimesheetDayWorkActivity[]

WeeklyTimesheetDayWorkActivity
  dayId, projectWorkActivityId
  @@unique([dayId, projectWorkActivityId])
```

Beim Generieren aus Stempel: TimeEntry-Arbeiten für den Tag aggregieren (Labels vereinigen, Freitexte mit Trenner). Manuelle Day-Felder bleiben zusätzlich/primär wenn kein Entry.

## API

1. Project GET/PATCH: `workNotesEnabled`; nested oder eigene Routen:
   - `GET/POST /projects/:id/work-activities`
   - `PATCH/DELETE /projects/:id/work-activities/:activityId`
2. Clock-Out Response: `workDocumentationRequired`, `timeEntryId`, `workNotesEnabled`, `workActivities: [{id,label}]` (aktive des Projekts).
3. `POST /time-entries/:id/work-documentation` `{ projectWorkActivityIds: string[], workNotes?: string }` – IDs müssen zum Entry-Projekt gehören.
4. Status: `pendingWorkDocumentation` wenn letzter eigener Ausstempel-Entry `workDocumentedAt == null`.
5. Timesheet Day upsert/update: `workNotes?`, `projectWorkActivityIds?` (Validierung analog, Projekt vom Timesheet).

## UI

### Projekt (Office)
- Abschnitt **Arbeiten / Tätigkeiten für Stundenzettel**:
  - Liste Labels (hinzufügen, umbenennen, Reihenfolge, aktiv)
  - Schalter „Freitext nach Ausstempeln / am Stundenzettel“

### Kiosk / Worker-App / Mobile
- Nach Clock-Out: Pflicht-Modal mit **nur** Projekt-Checkboxen + Freitext wenn Flag.
- Pending nach Reload erneut.
- Clock-In trotz Pending erlaubt; Modal priorisiert anzeigen.

### Stundenzettel Office
- Add/Edit Day: Checkboxen aus Timesheet-Projekt + Freitext (Flag); Pflicht-Validierung wie oben beim Speichern des Tages **wenn** Büro „Arbeiten setzen“ will – **Empfehlung:** bei manuellem Tag ebenfalls dieselbe Validierung erzwingen, sobald der Dialog „Arbeiten“ genutzt wird bzw. immer beim Speichern eines Tages mit Zeiten (konsistent zur Pflichtidee).
- Wochengrid: Kurzanzeige gewählter Labels + Textauszug.

## PDF

- Pro Tag „Arbeiten: …“ getrennt von Master-„Tätigkeiten (abrechnungsrelevant)“.

## Nichtziele

- Globaler Tätigkeits-Katalog / Settings-Seite für systemweite Checkboxen
- Minuten an Projekt-Tätigkeiten
- Modal vor Clock-Out
- Umbau Master-ActivityType
- DATEV

## Tests

1. Projekt A/B unterschiedliche Activities → Modal/Day nur jeweilige Checkboxen.
2. Clock-Out → pending → Doku ohne Inhalt 400 → mit Checkbox OK.
3. Freitext aus + 0 Checkboxen → 400; Freitext an + nur Text → OK.
4. Manueller Day ohne Kiosk: speichern mit Projekt-Checkboxen.
5. Fremde `projectWorkActivityId` (anderes Projekt) → 400.
6. Reload zeigt pending.
7. Build grün.

## Lieferumfang

- PR `feat(timesheets): projektbezogene Arbeiten nach Clock-Out und manuell`
- Abweichungen dokumentieren

## Repo

- projects (+ UI Projekt-Detail), time-entries, timesheets, kiosk, worker-app, mobile
