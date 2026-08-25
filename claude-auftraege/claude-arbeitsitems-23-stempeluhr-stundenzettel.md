# Cloud-Auftrag #23: Stempeluhr & Stundenzettel – Gesamtkonzept

## Kontext

Repo: Office-Monorepo · Produktion `office.vivahome.de` · Kiosk `work.vivahome.de` · Pfad `/opt/office` · SSH Port **2805**.

**Ist-Zustand (Problem):**
- Office → Stempeluhr → **Live** zeigt nur **aktuell eingestempelte** Monteure.
- Wer schon ausgestempelt hat oder den Tag beendet hat, ist unsichtbar – Büro kann den Tag nicht prüfen.
- GPS-Tab und Wochen-Stundenzettel decken das nicht ab (kein Tages-/KW-Cockpit).
- Pause: `BreakRule` (Schwellen → automatischer Abzug) existiert; Enum `BREAK_START` / `BREAK_END` existiert, wird am Kiosk **nicht** genutzt.
- Büro kann Stempelzeiten nicht direkt korrigieren (nur über Stundenzettel-Tage indirekt).

**Ziel:** Stempeluhr als vollständiges Arbeitszeit-Werkzeug (REFA-/Baustellen-tauglich): erfassen am Kiosk, prüfen/korrigieren im Office, überführen in Stundenzettel.

---

## Produktentscheidungen (verbindlich)

1. **Pause = beides**
   - **BreakRules** bleiben: Soll/Plausibilität (ab welcher Bruttodauer welche Pause erwartet wird).
   - **Echte Pause** wird am Kiosk gestempelt: **Pause Start** / **Pause Stopp**.
   - Nettozeit = Brutto − **gebuchte** Pausen (Summe Pause-Start→Stopp).
   - UI zeigt zusätzlich **Regel vs. gebucht** (Warnung wenn gebucht < Regel). Kein stiller Zwangs-Abzug mehr „statt“ gestempelter Pause, sofern Pause-Events vorliegen. Wenn **keine** Pause gestempelt wurde: Fallback wie bisher BreakRule-Abzug (dokumentieren im UI).

2. **Sicht „Zeitraum“**
   - Alle Monteure der **Firma** (aktiv/inaktiv egal), immer an **Datum bzw. KW** gebunden.
   - Filter (kombinierbar):
     - Datum (Tag)
     - Kalenderwoche (KW + Jahr)
     - Projekt
     - Einzelmonteur
     - Monteur-Team (`WorkerTeam`)
   - Ohne Monteur/Team-Filter = alle Monteure im gewählten Zeitraum (ggf. eingeschränkt durch Projektfilter).

3. **Büro darf**
   - Stempelzeiten **korrigieren** (In/Out/Pause nachziehen, Zeiten ändern, Kommentar).
   - Stundenzettel **ändern** (bestehende Bearbeitung behalten/erweitern).

4. **Live bleibt Live**
   - Tab „Live“ = nur aktuell eingestempelt (Leitstand). Nicht ersetzen, sondern ergänzen.

---

## Architektur-Skizze

```
Kiosk: CLOCK_IN / BREAK_START / BREAK_END / CLOCK_OUT / switch-activity / Foto
        ↓ TimeEntry (+ optional GpsEvent)
Office Stempeluhr:
  Live          → GET /time-entries/live
  Zeitraum      → GET /time-entries/overview?from&to|week&year&projectId&workerId&teamId
  Detail/Korrektur → Timeline + PATCH/POST Korrektur
        ↓ generate / reload
Stundenzettel (WeeklyTimesheet) → Freigabe / PDF / Signatur wie bisher
```

---

## A) Kiosk – Pause stempeln

### A.1 API

- `POST /time-entries/break-start` `{ workerId, projectId?, latitude?, longitude?, accuracy?, occurredAtClient?, clientEventId? }`
  - Nur wenn aktuell CLOCK_IN ohne offene Pause.
  - Schreibt `TimeEntry` Typ `BREAK_START` (+ GPS wie Clock).
- `POST /time-entries/break-end` analog → `BREAK_END`.
- Status-Endpoint liefert: `clockedIn`, `onBreak`, `breakStartedAt`, `currentActivity` (Master).
- Offline-Queue (Auftrag #13): Break-Events analog Clock-In/Out mitnehmen (`clientEventId`).

### A.2 UI Kiosk (`/kiosk/terminal`)

- Bei eingestempelt, nicht in Pause: Button **Pause starten**.
- Bei Pause: Button **Pause beenden** (Clock-Out während Pause: Pause zuerst schließen oder klar ablehnen – **Entscheidung umsetzen: Pause automatisch beenden, dann Clock-Out**, mit Hinweis).
- Anzeige „Pause seit …“.
- Worker-App (`/worker-app/dashboard`): gleiche Pause-Buttons.

### A.3 Texte

- Alle Labels über `texts` / i18n-Kiosk (DE; SK/SL wo Kiosk-i18n schon existiert).

---

## B) Office Stempeluhr – Zeitraum-Ansicht

### B.1 Navigation

Unter `/time-clock`:
- Tab **Live** (bestehend)
- Tab **Zeitraum** (neu, Default empfohlen oder zweiter Tab klar sichtbar)
- Tab **GPS** (bestehend)

### B.2 Filterleiste

| Filter | Verhalten |
|---|---|
| Datum | einzelner Kalendertag (Europe/Berlin) |
| KW + Jahr | ganze Woche Mo–So; wenn gesetzt, Datum-Filter deaktivieren oder KW priorisieren |
| Projekt | optional; leert = alle Projekte |
| Monteur | optional; einzelner Worker |
| Team | optional; alle Mitglieder von `WorkerTeam` |

Validierung: Zeitraum max. sinnvoll begrenzen (z. B. max. 1 KW oder max. 31 Tage), Performance.

### B.3 Liste / Tabelle

Pro Monteur (und bei Projektfilter ggf. pro Monteur×Projekt-Zeile – **bevorzugt: eine Zeile pro Monteur mit Summen + Projekt-Aufschlüsselung in Expand**):

| Spalte | Inhalt |
|---|---|
| Monteur | Name, Nummer |
| Status | `eingestempelt` / `in Pause` / `ausgestempelt` / `kein Stempel` |
| Erster In | Zeit |
| Letzter Out | Zeit (leer wenn noch ein) |
| Brutto | Minuten/hh:mm |
| Pause gebucht | Summe BREAK_START→END |
| Pause Regel | aus BreakRule zur Bruttodauer |
| Netto | Brutto − Pause gebucht (bzw. Regel-Fallback wenn keine Pause-Events) |
| Warnung | z. B. Pause &lt; Regel, fehlendes Out, &gt;10h |
| Projekte | Kurzliste |

Klick → **Detail-Drawer/Seite**: chronologische Timeline aller `TimeEntry` (+ Tätigkeitsegmente, Fotos-Links, GPS-Punkte optional).

### B.4 API Overview

`GET /time-entries/overview`

Query: `date` **oder** (`weekYear` + `weekNumber`), optional `projectId`, `workerId`, `teamId`.

Response (Beispiel-Shape):

```ts
{
  from: string; // ISO
  to: string;
  rows: Array<{
    worker: { id; workerNumber; firstName; lastName; active: boolean };
    status: 'CLOCKED_IN' | 'ON_BREAK' | 'CLOCKED_OUT' | 'NO_ENTRIES';
    firstClockInAt: string | null;
    lastClockOutAt: string | null;
    grossMinutes: number;
    breakBookedMinutes: number;
    breakRuleMinutes: number;
    netMinutes: number;
    warnings: string[];
    projects: Array<{ id; projectNumber; title; grossMinutes; netMinutes }>;
  }>;
}
```

Rollen: OFFICE / SUPERADMIN / PROJECT_MANAGER (PM ggf. auf eigene Projekte beschränken – **wenn bestehendes PM-Scoping existiert, übernehmen**; sonst SUPERADMIN/OFFICE = Firma gesamt).

---

## C) Büro – Zeiten korrigieren

### C.1 Korrektur-API

- `POST /time-entries/manual` – manuelles Event (`MANUAL_ADJUSTMENT` oder explizit Typ CLOCK_IN/OUT/BREAK_* mit `createdByUserId`)
- `PATCH /time-entries/:id` – `occurredAtClient`, Kommentar (nur wenn Stundenzettel zum Tag noch nicht LOCKED/APPROVED – klare Regel)
- `DELETE /time-entries/:id` – Soft oder Hard; Audit-Kommentar Pflicht

Alle Korrekturen: `createdByUserId` setzen, optional `comment` Pflicht bei Änderung.

### C.2 UI

Im Timeline-Detail:
- Zeit ändern
- Event hinzufügen (In/Out/Pause)
- Event löschen (mit Bestätigung)
- Hinweis wenn Tag bereits in freigegebenem Stundenzettel steckt → Korrektur sperren oder „Stundenzettel zuerst zurücksetzen“ (bestehenden Workflow nutzen).

---

## D) Stundenzettel – Anbindung

Bestehendes Modul `/timesheets` bleibt; erweitern:

1. **Generate / Neu laden aus Stempelungen** berücksichtigt `BREAK_START`/`BREAK_END` für `breakMinutes` (Priorität gebuchte Pause; sonst BreakRule).
2. Filter analog wo sinnvoll: Projekt, Monteur, Team, KW (Liste hat teils Filter – angleichen).
3. Nach Korrektur in Stempeluhr: Button „Stundenzettel für KW aktualisieren“ (bestehendes Regenerate).
4. Master-Tätigkeiten (Auftrag #22): Minuten je Tätigkeit weiter aus Segmenten; Pause zählt nicht zur Tätigkeit.

---

## E) Pause-Regeln (BreakRules) – Rolle schärfen

- Einstellungen → BreakRules unverändert pflegbar.
- Verwendung neu:
  - **Vergleichswert** in Zeitraum-Ansicht (`breakRuleMinutes`).
  - **Fallback**, wenn an einem Tag keine Pause gestempelt wurde.
- UI-Text klarstellen: „Regel = Vorgabe; gestempelte Pause = Ist.“

---

## F) Nicht-Ziele (dieser Auftrag)

- Kein eigener Stundensatz pro Tätigkeit (bleibt #22 v1).
- Keine Lohnbuchhaltungs-Export-Datei (CSV kann Follow-up sein).
- Kein Multi-Mandant.
- GPS-Tab bleibt; keine Doppel-UI.

---

## Abnahme

### Kiosk / Worker-App
1. Eingestempelt → Pause starten → Status `onBreak`, Dauer sichtbar.
2. Pause stoppen → weiter eingestempelt.
3. Clock-Out während Pause → Pause wird geschlossen, dann Out.
4. Offline: Pause-Events in Queue, Sync ok.

### Office Zeitraum
5. Filter Tag: alle Monteure mit/ohne Stempel sichtbar.
6. Filter KW: Aggregation/Zeilen für die Woche (pro Tag expandierbar **oder** Wochen-Summenzeile + Drill-down – **Mindestens:** Liste Tage der KW wählbar oder Summen + Klick öffnet Tag).
7. Filter Projekt / Monteur / Team funktionieren kombiniert.
8. Nicht eingestempelte Monteure erscheinen mit Status `kein Stempel`.

### Korrektur & Stundenzettel
9. Büro ändert Clock-Out-Zeit → Overview/Netto aktualisiert.
10. Stundenzettel „aus Stempelungen laden“ nutzt gebuchte Pausen.
11. Freigegebener/gesperrter Zettel: Korrektur abgelehnt oder klar geführt.

### Regression
12. Live-Tab unverändert sinnvoll.
13. Normaler Monteur ohne Master: weiter ohne Tätigkeitspflicht.
14. Build grün; Deploy api+web (SSH Port 2805); Migration falls nötig.

---

## Technische Hinweise

- Zeitzone: **Europe/Berlin** für Tages-/KW-Grenzen (wie Backup/Stundenzettel).
- KW: ISO-Woche (Mo–So), konsistent zu bestehendem `weekYear`/`weekNumber`.
- Performance: Overview aggregiert serverseitig; Indizes auf `TimeEntry(workerId, entryType, occurredAtClient)` nutzen/erweitern.
- Texte: `apps/web/src/lib/texts/timeClock.ts` (+ timesheets).
- Doku: `HANDBUCH.md` / `STATUS.md` kurz aktualisieren (Pause stempeln, Zeitraum-Tab).

---

## Empfohlene Umsetzungsschritte (für den Agenten)

1. Pause API + Kiosk/Worker-UI + Offline-Queue  
2. Overview-API + Office-Tab Zeitraum + Filter  
3. Detail-Timeline + Korrektur-API/UI  
4. Timesheet-Generierung auf gebuchte Pausen umstellen + BreakRule-Fallback  
5. Deploy + Abnahme-Checkliste  

Commit-Präfix: `feat: Stempeluhr Zeitraum, Pause-Stempel und Korrekturen`

---

## Referenz-Dateien

- `apps/web/src/app/(authenticated)/time-clock/**`
- `apps/web/src/app/kiosk/terminal/page.tsx`
- `apps/web/src/app/worker-app/dashboard/page.tsx`
- `apps/web/src/lib/timesheets.ts`, `offline-clock-queue.ts`
- `apps/api/src/time-entries/**`
- `apps/api/src/timesheets/**`
- `prisma/schema.prisma` (`TimeEntry`, `TimeEntryType`, `BreakRule`, `WorkerTeam`, `WeeklyTimesheet*`)
- SSH/Deploy: `DEPLOYMENT.md` (Port 2805)
