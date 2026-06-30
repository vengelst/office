# Claude Code – Auftrag: Stundenzettel / Zeiterfassung

## Kontext

Alle bisherigen Module (Kunden, Projekte, Monteure/Teams/Subunternehmen) laufen in Docker:
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Das Datenbank-Schema für Zeiterfassung existiert bereits:
- `TimeEntry` – Einzelne Stempelereignisse (CHECK_IN, CHECK_OUT) mit GPS + Timestamp
- `WeeklyTimesheet` – Wochenstundenzettel pro Monteur+Projekt+KW mit Status (DRAFT → SUBMITTED → REVIEWED → APPROVED)
- `WeeklyTimesheetDay` – Tageszeile mit Clock-In/Out, Brutto/Netto-Minuten, Pausen
- `WeeklyTimesheetSignature` – Digitale Unterschrift (SignerType: WORKER, SUPERVISOR, MANAGER)
- `BreakRule` – Automatische Pausenabzugsregeln (Schwellenwerte)
- `GpsEvent` – GPS-Tracking zu TimeEntries

**Monteure stempeln via Mobile-App (Touch-optimiert), Vorarbeiter bestätigt und unterschreibt.**
**Keine Nacht-/Wochenend-Zuschläge. Keine Reisezeit-Sonderbehandlung.**

### Wichtige übergreifende Regeln:
- Die App muss auf **Desktop, Tablet und Handy** gleichermaßen gut bedienbar sein
- Mobile-First für die Stempel-Funktion (große Buttons, Touch-optimiert)
- Alle klickbaren Elemente mind. **44px Touch-Target**
- Alle UI-Texte zentral in `texts.ts` (i18n-Vorbereitung)
- CORS: `http://localhost:3900`

---

## 1. Schema-Ergänzungen (falls nötig)

Das Schema ist weitgehend vorhanden. Folgende Ergänzungen:

### WeeklyTimesheet erweitern:
```prisma
// Neue Felder:
  submittedAt     DateTime?   // Wann eingereicht
  reviewedAt      DateTime?   // Wann geprüft
  approvedAt      DateTime?   // Wann freigegeben
  rejectedAt      DateTime?   // Wann zurückgewiesen
  rejectionReason String?     // Grund für Zurückweisung
  reviewedByUserId String?    // Wer hat geprüft
  approvedByUserId String?    // Wer hat freigegeben
  
  reviewedBy User? @relation("TimesheetReviewer", fields: [reviewedByUserId], references: [id])
  approvedBy User? @relation("TimesheetApprover", fields: [approvedByUserId], references: [id])
```

### TimeEntry-Typ erweitern (falls nicht vorhanden):
```prisma
enum TimeEntryType {
  CHECK_IN
  CHECK_OUT
  BREAK_START
  BREAK_END
}
```

---

## 2. Backend (NestJS)

### 2.1 Worker-Auth / PIN-Login (`/api/worker-auth`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| POST | `/api/worker-auth/pin-login` | PIN prüfen → Worker-Token zurückgeben |
| GET | `/api/worker-auth/me` | Aktueller Worker (aus Token) |
| POST | `/api/worker-auth/logout` | Token invalidieren |

**PIN-Login:**
- Body: `{ pin: "1234" }` (4–6 Ziffern)
- Prüft gegen alle aktiven WorkerPins (isActive=true, validFrom <= now, validTo null oder > now)
- Gibt JWT zurück mit `{ workerId, workerNumber, type: 'worker' }`
- Separater `WorkerAuthGuard` für Worker-Endpoints (prüft `type: 'worker'` im Token)

### 2.2 Time-Entries / Stempeln (`/api/time-entries`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| POST | `/api/time-entries/clock-in` | Einstempeln (workerId, projectId, GPS optional) |
| POST | `/api/time-entries/clock-out` | Ausstempeln (workerId, GPS optional) |
| GET | `/api/time-entries/status/:workerId` | Aktueller Stempel-Status (eingestempelt? seit wann? welches Projekt?) |
| GET | `/api/time-entries/today/:workerId` | Heutige Einträge des Monteurs |
| GET | `/api/time-entries/live` | Alle aktuell eingestempelten Monteure (für Übersicht) |
| POST | `/api/time-entries/upload-photo` | Arbeitsfoto hochladen (workerId, projectId, Bild, optionaler Kommentar) → Speichert als Dokument |

**Business-Regeln Stempeln:**
- Kann nur einstempeln wenn nicht bereits eingestempelt
- Kann nur ausstempeln wenn eingestempelt
- Beim Ausstempeln: automatisch Brutto-Minuten berechnen
- Clock-In erzeugt automatisch einen `TimeEntry` mit Typ CHECK_IN
- Clock-Out erzeugt CHECK_OUT + berechnet Differenz

### 2.2 Wochenstundenzettel (`/api/timesheets`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/timesheets` | Liste mit Filter (workerId, projectId, weekYear, weekNumber, status), Pagination |
| GET | `/api/timesheets/:id` | Detail mit Tagen + Unterschriften |
| POST | `/api/timesheets/generate` | Stundenzettel aus TimeEntries generieren (workerId, projectId, weekYear, weekNumber) |
| PATCH | `/api/timesheets/:id/days/:dayId` | Tageseintrag manuell korrigieren (Zeiten überschreiben) |
| POST | `/api/timesheets/:id/submit` | Monteur reicht ein (Status → SUBMITTED) |
| POST | `/api/timesheets/:id/approve` | Vorarbeiter/PM genehmigt (Status → APPROVED) |
| POST | `/api/timesheets/:id/reject` | Zurückweisen mit Grund (Status → DRAFT, rejectionReason) |
| POST | `/api/timesheets/:id/sign` | Unterschrift hinzufügen (Base64-Bild der Signatur, signerType, signerName) |
| GET | `/api/timesheets/:id/pdf` | PDF-Export des Stundenzettels |

**Business-Regeln Stundenzettel:**
- `generate`: Aggregiert alle TimeEntries der Woche, wendet BreakRules an, erstellt/aktualisiert WeeklyTimesheetDays
- Nur DRAFT-Stundenzettel können bearbeitet werden
- Nach SUBMIT: Monteur kann nicht mehr ändern
- REJECT → zurück auf DRAFT, Monteur kann korrigieren
- APPROVE: Endgültig, kann nur von Admin zurückgesetzt werden
- Pausenabzug: Automatisch nach BreakRules (z.B. >6h → 30min Pause, >9h → 45min)
- Netto = Brutto − Pausen

### 2.3 Break-Rules (`/api/break-rules`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/break-rules` | Alle Regeln (global + projektspezifisch) |
| POST | `/api/break-rules` | Neue Regel erstellen |
| PATCH | `/api/break-rules/:id` | Bearbeiten |
| DELETE | `/api/break-rules/:id` | Löschen |

### 2.4 PDF-Generierung

- Wochenstundenzettel als PDF:
  - Header: Projektname, KW, Monteur-Name, Zeitraum (Mo–So)
  - Tabelle: Datum | Arbeitsbeginn | Arbeitsende | Brutto | Pause | Netto
  - Summenzeile: Gesamt Brutto, Gesamt Pause, Gesamt Netto
  - Unterschriften-Bereich: Monteur + Vorarbeiter (Signatur-Bilder wenn vorhanden)
- Bibliothek: `pdfkit` oder `@react-pdf/renderer` (Backend-seitig)

---

## 3. Frontend

### 3.1 Monteur-App / Stempel-Seite (`/worker-app`) – MOBILE-ONLY

Eigenständiger Bereich für Monteure. Kein normaler Login – nur PIN-Eingabe.

**Login-Flow:**
- Separate Seite `/worker-app` (kein Sidebar-Layout, eigenständig)
- PIN-Eingabe: 4–6-stelliger Zahlencode über großes Nummernpad (wie Handy-Entsperrung)
- PIN wird gegen `WorkerPin`-Tabelle geprüft (pinHash, validFrom/To, isActive)
- Nach erfolgreicher PIN: Worker-Session (JWT mit workerOnly-Flag oder separater Token)
- Kein E-Mail/Passwort nötig

**Nach Login – Hauptbildschirm:**
- Monteur-Name + Avatar oben
- **Aktuelles Projekt** (das heute gültige Assignment): Projektname, Kundenname, groß angezeigt
- **Zukünftige Projekte**: Kleine Liste darunter (ausgegraut, nicht auswählbar, nur zur Info)
- Großer Status-Bereich: "Eingestempelt seit 07:32" oder "Nicht eingestempelt"
- Großer runder Button (mind. 80px): "Arbeit starten" (grün) / "Arbeit beenden" (rot)
- Heutige Zeiten darunter: Liste der Ein-/Ausstempel-Paare mit Dauer
- GPS-Status-Indikator (aktiv/inaktiv)
- **Foto-Button**: "Arbeitsfoto hinzufügen" (Kamera öffnen oder Galerie)
  - Foto wird als Dokument hochgeladen (entityType: PROJECT, documentType: SITE_PHOTO)
  - Verknüpft mit dem aktuellen Projekt + Monteur als Uploader
  - Optional: Kurzer Kommentar/Beschreibung zum Foto

**Verhalten:**
- Beim Öffnen: Aktuellen Status laden (`/api/time-entries/status/:workerId`)
- Projekt-Auswahl: NUR das aktive Projekt (Assignment mit `active: true` und `startDate <= heute`)
- Zukünftige Projekte: Assignments mit `startDate > heute` (nur anzeigen)
- GPS-Position ermitteln (Geolocation API, optional – kein Blocker wenn verweigert)
- Button-Press → API-Call → visuelles Feedback (Animation, Vibration wenn möglich)
- Kamera: `navigator.mediaDevices` oder `<input type="file" accept="image/*" capture="environment">`
- Auto-Refresh alle 60s für Timer-Anzeige
- Logout-Button unten (zurück zur PIN-Eingabe)

### 3.2 Live-Übersicht (`/time-clock/live`) – DESKTOP/TABLET

Für Vorarbeiter/PM: Wer ist gerade eingestempelt?

- Tabelle/Karten: Monteur (Avatar + Name), Projekt, eingestempelt seit, Dauer bisher
- Grün = eingestempelt, Grau = nicht eingestempelt
- Auto-Refresh alle 30s
- Filter: Projekt, Team

### 3.3 Stundenzettel-Übersicht (`/timesheets`)

- Filterleiste: Monteur, Projekt, KW (Kalenderwochen-Picker), Status
- Tabelle: KW | Monteur | Projekt | Netto-Stunden | Status-Badge | Aktionen
- Status-Badges: Entwurf (grau), Eingereicht (blau), Genehmigt (grün), Zurückgewiesen (rot)
- Button "Stundenzettel generieren" → Dialog: Monteur + Projekt + KW auswählen

### 3.4 Stundenzettel-Detail (`/timesheets/[id]`)

**2 Tabs:**

#### Tab 1: Wochenübersicht
- Tabelle Mo–So:
  | Tag | Datum | Beginn | Ende | Brutto | Pause | Netto | Kommentar |
- Editierbar wenn Status=DRAFT (inline oder Dialog)
- Summenzeile am Ende
- GPS-Info: Kleines Icon wenn GPS-Daten vorhanden (Klick → Maps öffnen)

#### Tab 2: Unterschriften & Status
- Status-Timeline: DRAFT → SUBMITTED → APPROVED (mit Timestamps und wer)
- Bei REJECTED: Grund anzeigen (rot)
- **Unterschrift-Canvas**: Touch-fähiges Zeichenfeld für Unterschrift
  - "Als Monteur unterschreiben" / "Als Vorarbeiter unterschreiben"
  - Canvas mit Finger/Stift beschreiben
  - "Löschen" + "Bestätigen" Buttons
  - Nach Bestätigung: Signatur-Bild wird gespeichert
- Bereits vorhandene Unterschriften: Bild anzeigen + Name + Datum
- Button "Einreichen" (wenn DRAFT + Monteur-Unterschrift vorhanden)
- Button "Genehmigen" (wenn SUBMITTED + Vorarbeiter hat Berechtigung)
- Button "Zurückweisen" (mit Textfeld für Grund)
- Button "PDF herunterladen"

### 3.5 Pausenregeln (`/settings/break-rules`)

- Einfache Liste: Regelname, Schwellenwert 1 (z.B. 360min → 30min Pause), Schwellenwert 2
- Dialog zum Erstellen/Bearbeiten
- Global vs. projektspezifisch (Dropdown)

### 3.6 Sidebar erweitern

Neuer Bereich "Zeiterfassung":
- **Stempeluhr** → `/time-clock`
- **Stundenzettel** → `/timesheets`

Im Bereich "Einstellungen":
- **Pausenregeln** → `/settings/break-rules`

### 3.7 Dashboard erweitern

Neue Karte: "Heute eingestempelt"
- Anzahl aktuell eingestempelte Monteure / Gesamt aktive
- Link zu Live-Übersicht

---

## 4. Seed-Daten

### Seed: WorkerPins
Für alle 6 Seed-Monteure je einen PIN setzen:
- Marko: 1001
- Ivan: 1002
- Piotr: 1003
- Tomasz: 1004
- Stefan: 1005
- Ahmed: 1006

### TimeEntries (letzte 2 Wochen):
Für die 6 Seed-Monteure: Realistische Check-In/Out Paare generieren:
- Mo–Fr, ca. 07:00–16:00 mit leichter Variation (±15min)
- Samstag gelegentlich (halber Tag)
- GPS-Koordinaten in der Nähe des jeweiligen Projekt-Standorts

### WeeklyTimesheets:
- Letzte Woche: Für alle 6 Monteure generiert, Status APPROVED (mit Unterschriften)
- Aktuelle Woche: Für alle 6 Monteure generiert, Status DRAFT (noch keine Unterschriften)

### BreakRules:
- Global: >360min → 30min Pause, >540min → 45min Pause
- Projekt "Hafenterminal": >360min → 45min (strengere Regel)

---

## 5. Technische Hinweise

- **Unterschrift-Canvas**: HTML5 Canvas mit Touch-Events. Speicherung als PNG (Base64 → MinIO upload → Pfad in DB). Bibliothek-Empfehlung: `signature_pad` (npm) oder eigene Canvas-Implementierung
- **PDF**: `pdfkit` im Backend installieren. Einfaches aber professionelles Layout.
- **Geolocation**: Frontend fragt `navigator.geolocation.getCurrentPosition()` ab. Timeout 10s, optional.
- **Stempel-Authentifizierung**: Monteure loggen sich AUSSCHLIESSLICH per PIN ein (über das bestehende `WorkerPin`-Model). Eigener Auth-Flow: POST `/api/worker-auth/pin-login` → prüft PIN-Hash, gibt Worker-Token zurück. Separater Guard `WorkerAuthGuard` für Worker-Only-Endpoints.
- **Monteur-App als eigenständiger Bereich**: `/worker-app/*` hat KEIN normales Layout (keine Sidebar, kein Header). Komplett eigenständige Mobile-UI.
- **Foto-Upload von Baustelle**: Monteure können Arbeitsfotos direkt aus der App hochladen (Kamera oder Galerie). Fotos werden als Projektdokumente (SITE_PHOTO) gespeichert und mit dem Monteur als Uploader verknüpft.
- **Timer**: Client-seitig mit `setInterval` aktualisieren (Sekunden-Anzeige seit Clock-In)
- **Responsive**: Stempel-Seite ist primär Mobile, Rest Desktop-First mit Mobile-Support
- **Alle neuen Module in `app.module.ts` registrieren**
- **Endpoints mit `JwtAuthGuard` schützen**

---

## 6. Ausführungsreihenfolge

1. Schema-Ergänzungen + Migration
2. Backend: TimeEntries-Module, Timesheets-Module, BreakRules-Module, PDF-Service
3. Frontend: API-Client (`lib/timesheets.ts`)
4. Frontend: Texte in `texts.ts` erweitern
5. Frontend: Stempel-Seite (Mobile-First)
6. Frontend: Live-Übersicht, Stundenzettel-Übersicht, Detail mit Unterschrift-Canvas
7. Frontend: Pausenregeln-Einstellungen
8. Seed-Daten
9. Sidebar + Dashboard erweitern
10. Docker Build + Smoke-Test
