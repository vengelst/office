# Cloud-Auftrag #30: Stundenzettel „Arbeiten“ (Checklisten + Freitext)

## Kontext

Stundenzettel zeigen Zeiten; **Master**-Monteure haben bereits **zeitbasierte** Tätigkeitssegmente (`ActivityType` / `TimeActivitySegment` → `WeeklyTimesheetDayActivity` mit Minuten). Das bleibt unverändert.

**Neu (dieser Auftrag):** Für **alle** Monteure optional dokumentieren, **was** am Tag gemacht wurde – ohne Pflicht, ohne Minutenabrechnung.

Auslöser User (2026-09-07): Feld „Arbeiten“ am Stundenzettel; Pflege durch Monteur (z. B. beim Auschecken) oder Büro bei manueller Erzeugung/Überarbeitung; optional Pop-up beim Clock-Out; **Checkboxen** aus Einstellungen (Kabelzug, Anschluss, Kameras …) **plus** freies Textfeld.

## Ziel

1. Am Stundenzettel-Tag: Bereich **Arbeiten** = Mehrfachauswahl Standardarbeiten + optionaler Freitext.
2. Katalog Standardarbeiten unter **Einstellungen** pflegbar.
3. Optionaler Dialog beim **Auschecken** (Kiosk + Worker-App): „Was hast du heute gemacht?“ – überspringbar.
4. Büro kann dieselben Felder beim Anlegen/Bearbeiten eines Tages setzen.
5. PDF und Wochen-UI zeigen die Arbeiten (wenn vorhanden).

## Produktentscheidungen (Defaults – bei Widerspruch melden)

| Thema | Entscheidung |
|--------|----------------|
| Trennung zu Master-Minuten | **Separater Katalog** `WorkTag` (nicht `ActivityType`). Master-Segmente/Minuten bleiben wie #22. |
| Pflicht | **Nie** Pflicht – Clock-Out und Speichern ohne Auswahl/Text immer erlaubt |
| Umfang | Pro **Kalendertag** am Stundenzettel (nicht pro Stempel-Intervall) |
| Mehrere Clock-Outs am Tag | Tags: **Vereinigung**; Freitext: neuer Text **anhängen** (mit Zeilenumbruch), leerer Text ändert nichts |
| Regenerieren aus Stempel | Zeiten neu; **Arbeiten (Tags+Text) am Tag behalten**, sofern Tag-Zeile erhalten/merged – bei Hard-Delete+Recreate der Days: vorherige `workNotes`/`workTags` aus DB-Snapshot des gleichen `workDate` wiederherstellen |
| Offline-Clock-Out | Tags/Text in Offline-Payload mitsenden; bei Sync speichern |
| Mobile-App | Gleicher optionaler Dialog wie Worker-Web, wenn Clock-Out dort existiert |
| Sprache | DE-Texte; Kiosk folgt Locale wo sinnvoll |

## Datenmodell

```text
WorkTag
  id, label, sortOrder, active, createdAt, updatedAt

WeeklyTimesheetDay
  + workNotes String?          // Freitext „Arbeiten“
  activities (bestehend)       // Master-Minuten – unberührt
  workTags WeeklyTimesheetDayWorkTag[]

WeeklyTimesheetDayWorkTag
  dayId, workTagId
  @@unique([dayId, workTagId])

TimeEntry (optional, für Clock-Out vor Generierung)
  + workNotes String?
  // Tags: TimeEntryWorkTag oder JSON workTagIds – Empfehlung Relation analog
```

**Alternative schlank:** Arbeiten nur am `WeeklyTimesheetDay`; Clock-Out legt/aktualisiert Draft-Timesheet-Tag für heute (ensure DRAFT week + day) und schreibt dorthin. Dann kein `TimeEntry`-Feld nötig. **Empfehlung:** diese Variante (weniger Doppelhaltung), solange Auto-Timesheet-on-clock bereits existiert.

## API

1. CRUD `GET/POST/PATCH/DELETE /work-tags` (SUPERADMIN/OFFICE; GET active auch WORKER/Kiosk).
2. Timesheet Day Update/Upsert: `workNotes?`, `workTagIds?: string[]` (ersetzt Tag-Set am Tag).
3. Clock-Out Body erweitern: `workNotes?`, `workTagIds?` – Service merged in heutigen Timesheet-Day (ensure week/day).
4. Detail/PDF-Include: `workTags: { id, label }[]`, `workNotes`.

## UI

### Einstellungen
- Neue Seite oder Unterpunkt: **Standardarbeiten** (`/settings/work-tags`) – Liste, anlegen, umbenennen, sortieren, aktiv/inaktiv.

### Stundenzettel (Office)
- Wochen-Tabelle: Spalte/Hinweis **Arbeiten** (Tags + gekürzter Text).
- Edit-/Add-Day-Dialog: Checkbox-Gruppe (aktive Tags) + Textarea „Arbeiten / Beschreibung“ (zusätzlich zu bestehendem `summaryComment` – Labels klar trennen: Kommentar vs. Arbeiten).

### Kiosk / Worker-App
- Nach erfolgreichem Clock-Out **oder** unmittelbar davor (ein Flow): Modal  
  - Titel z. B. „Arbeiten heute (optional)“  
  - Checkboxen aktiver WorkTags  
  - Textarea  
  - Buttons: **Überspringen** | **Speichern**  
- Überspringen = Clock-Out ohne Arbeiten (wenn Modal nach Clock-Out: nur speichern/skip für Arbeiten).

**Empfohlene UX:** Clock-Out zuerst ausführen, dann optionales Modal „Noch kurz notieren?“ – bei Skip fertig; bei Speichern PATCH Tag/ensure day. So blockiert das Modal nie das Ausstempeln.

## PDF

- Abschnitt oder Zeile unter dem Tag: „Arbeiten: Tag1, Tag2 – Freitext…“ nur wenn Inhalt vorhanden.
- Nicht mit „Tätigkeiten (abrechnungsrelevant)“ (Master-Minuten) vermischen – zwei getrennte Blöcke.

## Nichtziele

- Keine Minuten/Stückzahlen an WorkTags
- Keine Pflichtauswahl
- Kein Umbau Master-`ActivityType`-Segmente
- Keine Abrechnungslogik an WorkTags
- Kein DATEV

## Tests

1. WorkTag CRUD; inaktive nicht in Clock-Out/Checkbox-Liste.
2. Day-Update setzt Tags+Notes; PDF enthält sie.
3. Clock-Out ohne Payload unverändert möglich.
4. Clock-Out mit Tags+Notes → Draft-Tag hat Daten.
5. Zweiter Clock-Out: Tags vereinigt, Text angehängt.
6. Regenerieren überschreibt Zeiten, behält Arbeiten am gleichen Datum.
7. Build api+web grün.

## Lieferumfang

- PR gegen `main`, Commit `feat(timesheets): optionale Arbeiten (Tags + Freitext)`
- Kurze Summary, Abweichungen, Testergebnis

## Repo-Hinweise

- NestJS / Next.js / Prisma; Kiosk + Worker-App + ggf. `apps/mobile`
- Bestehende Auto-Timesheet-Erzeugung bei Clock-In/Out wiederverwenden (`ensure` DRAFT week)
- Feature-Flag `timesheets` beachten
