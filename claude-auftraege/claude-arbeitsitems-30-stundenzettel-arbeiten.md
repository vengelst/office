# Cloud-Auftrag #30: Stundenzettel „Arbeiten“ (Pflicht nach Clock-Out)

## Kontext

Master-Minuten-Tätigkeiten (`ActivityType` / Segmente) bleiben unverändert.

**Neu:** Nach dem Ausstempeln dokumentiert der Monteur **pflichtig**, welche Arbeiten in **dieser Stempel-Session** erledigt wurden – per Checkboxen und optional (projektspezifisch) Freitext.

User-Klarstellung 2026-09-07:
- Popup **nicht optional** (Inhaltspflicht).
- Reihenfolge: **erst ausstempeln**, **dann** Popup (Absicht „ich höre auf“ darf nicht blockiert werden).
- Freitext-Feld **pro Projekt** ein-/ausschaltbar.
- Checkboxen = typische Arbeiten (auswählbar).
- Neue Stempel-Session (wieder einchecken) = **neuer** Arbeits-Block.
- „Neu laden der Zeiten“ (Büro-Regenerieren) ist **kein** Thema dieses Flows – betrifft nur Office-Stundenzettel-Neuberechnung aus Stempeldaten.

## Ziel

1. Clock-Out führt sofort aus (Zeiten/GPS wie heute).
2. Danach Modal **Pflicht**: solange nicht erfüllt/gespeichert, gilt die Session als „Arbeiten ausstehend“.
3. Inhalt: Checkboxen (Standardarbeiten) + Freitext nur wenn am Projekt aktiviert.
4. Validierung: mindestens eine Checkbox **oder** (wenn Freitext aktiv) nicht-leerer Text – siehe Regeln unten.
5. Büro sieht/kann dieselben Daten am Stundenzettel-Tag (und Session) einsehen/nachpflegen.
6. Katalog Standardarbeiten in Einstellungen; Zuordnung/ Freitext-Flag am Projekt.

## Flow (verbindlich)

```text
[Eingestempelt] → User tippt „Ausstempeln“
       → Clock-Out API (Erfolg)
       → Modal „Arbeiten dieser Schicht“ (Pflicht-UI)
            → Speichern (gültig) → fertig
            → App schließen ohne Speichern → beim nächsten Öffnen
              (solange eingeloggt / gleiche Schicht dokumentiert werden muss)
              Modal erneut, bis gespeichert
```

**Kein** Modal vor dem Clock-Out.

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Reihenfolge | Clock-Out **zuerst**, Popup **danach** |
| Pflicht | Popup muss bedient werden; Skip ohne Inhalt **nicht** erlaubt |
| Freitext | Flag am **Projekt** (z. B. `workNotesEnabled`); globaler Default aus oder an – **Empfehlung Default: an** |
| Checkbox-Katalog | Global unter Einstellungen (`WorkTag`); am Projekt optional welche Tags gelten – **Empfehlung v1: alle aktiven Tags für jedes Projekt**, Filter pro Projekt als Follow-up falls nötig |
| Session | Ein Dokumentations-Datensatz pro **beendetem** TimeEntry (Clock-Out-Intervall), nicht nur pro Kalendertag |
| Wiedereinstempeln | Neue Session → neues leeres Formular beim nächsten Clock-Out |
| Master-Segmente | Unberührt |
| Offline | Clock-Out offline wie heute; Arbeiten lokal merken und bei Sync nachziehen; UI blockiert „fertig“ bis lokal gespeichert |

### Validierung (Inhalt)

- Freitext **aus** (Projekt): ≥ 1 Checkbox Pflicht.
- Freitext **an**: ≥ 1 Checkbox **oder** Freitext mit Inhalt (nach Trim) – beides erlaubt.

## Datenmodell (Empfehlung)

```text
WorkTag
  id, label, sortOrder, active, …

Project
  + workNotesEnabled Boolean @default(true)
  // optional später: ProjectWorkTag[]

TimeEntry   // nach Clock-Out endedAt gesetzt
  + workNotes String?
  + workDocumentedAt DateTime?   // null = Popup noch offen
  workTags TimeEntryWorkTag[]

TimeEntryWorkTag
  timeEntryId, workTagId
  @@unique([timeEntryId, workTagId])
```

Stundenzettel-Anzeige: beim Generieren/Anzeigen pro Tag die Arbeiten aller TimeEntries dieses Tages aggregieren (Tags vereinigen, Freitexte mit Trenner/Session-Hinweis). Büro-Edit: vorerst an TimeEntry oder aggregiert am Day – **Empfehlung:** Anzeige aggregiert am Tag; Nachpflege im Office über Tag-Editor schreibt auf den letzten Entry des Tages oder legt manuelle Notiz am Day (`workNotes`/`workTags` am Day parallel) – **v1 einfach:** nur an `TimeEntry` speichern; Office zeigt read-only Aggregation + darf PATCH auf Entry wenn nötig.

**v1-Pragmatik:** Speicherung nur an `TimeEntry`; Office-Stundenzettel liest/zeigt Aggregation; manuelle Tage ohne Stempel: `WeeklyTimesheetDay.workNotes` + Day-WorkTags analog (Büro-Pflicht optional lockern: manuell weiter ohne Popup).

## API

1. CRUD `/work-tags` (OFFICE/SUPERADMIN; GET active für Worker/Kiosk).
2. Project PATCH: `workNotesEnabled`.
3. Clock-Out: unverändert zeitlich; Response signalisiert `workDocumentationRequired: true` + `timeEntryId` wenn `workDocumentedAt == null`.
4. `POST /time-entries/:id/work-documentation` `{ workTagIds: string[], workNotes?: string }` – Validierung wie oben; setzt `workDocumentedAt`.
5. Status/Dashboard: wenn letzter Ausstempel-Eintrag ohne Doku → `pendingWorkDocumentation: { timeEntryId, workNotesEnabled, … }` damit UI Modal erzwingt.

## UI

### Einstellungen
- **Standardarbeiten** – CRUD Checkbox-Labels.

### Projekt
- Schalter: „Freitext Arbeiten nach Ausstempeln“ (workNotesEnabled).

### Kiosk / Worker-App / Mobile
- Nach Clock-Out-Erfolg: Modal Pflicht.
- Beim App-Start / Terminal-Fokus: wenn `pendingWorkDocumentation` → Modal erneut.
- Kein zweites Einstempeln? **Erlaubt** – aber Modal für offene Doku der **letzten** ausgecheckten Session weiter anzeigen bis erledigt (nicht blockieren für Clock-In, außer Product will block – **Empfehlung: Clock-In erlauben**, Modal bei nächster Gelegenheit / sofort nach Login priorisieren).

### Office Stundenzettel
- Pro Tag: Anzeige aggregierter Arbeiten.
- Manueller Tages-Dialog: dieselben Checkboxen + Freitext (wenn Projekt Freitext an), speichert am Day.

## PDF

- Pro Tag: „Arbeiten: …“ wenn vorhanden (Tags + Text), getrennt von Master-„Tätigkeiten (abrechnungsrelevant)“.

## Nichtziele

- Minuten an WorkTags
- Modal vor Clock-Out
- Umbau Master-ActivityType
- Projekt-spezifische Tag-Listen (v1 optional später)
- DATEV / Abrechnung an Tags

## Tests

1. Clock-Out ohne Doku → pending; Endpoint Doku ohne Tags/Text → 400.
2. Nur Text (Freitext an) → OK; nur Tags → OK; beides → OK.
3. Freitext aus + keine Tags → 400.
4. Nach Speichern kein pending mehr.
5. App-Reload zeigt pending erneut.
6. Zweite Schicht am Tag: zweites Doku-Objekt; Aggregation auf Tagesanzeige.
7. PDF/UI ohne „Skip“.
8. Build grün.

## Lieferumfang

- PR `feat(timesheets): Pflicht-Arbeiten nach Clock-Out (Tags + Projekt-Freitext)`
- Spec-Abweichungen dokumentieren

## Repo

- `apps/api` time-entries + projects + timesheets PDF/generate
- `apps/web` kiosk, worker-app, settings, project form, timesheet day UI
- `apps/mobile` Clock-Out-Flow analog
