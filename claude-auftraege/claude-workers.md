# Claude Code – Auftrag: Monteur-/Personalverwaltung

## Kontext

Kunden-, Projekt-, Dokumenten- und Geocode-Module sind implementiert und laufen in Docker:
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Das Worker-Model existiert bereits rudimentär (Name, Email, Phone, Adresse, Nationalität, Qualifikationen als Freitext, Führerschein, Foto-Pfad). Dieses Modul erweitert es massiv und fügt Subunternehmen, Teams, Sprachkenntnisse, Zertifikate, Verträge und Reisedokumente hinzu.

**Wichtig:** Es existiert bereits ein Geocode-Endpoint `GET /api/geocode?address=...`. Nutze diesen im Frontend für alle Adress→Koordinaten-Auflösungen mit einem "Koordinaten ermitteln"-Button.

Das Dokumenten-System (Upload/Download/Link via `DocumentLink` mit `entityType`/`entityId`) existiert bereits. Nutze es für Monteur-Dokumente (entityType: `WORKER`).

### Wichtige übergreifende Regeln:
- Die App muss auf **Desktop, Tablet und Handy** gleichermaßen gut bedienbar sein
- Keine langen Formular-Scrollorgien – Inhalte in **Tabs/Sections** aufteilen
- Alle klickbaren Elemente mind. **44px Touch-Target**
- Telefonnummern als `tel:`-Links, E-Mails als `mailto:`-Links
- Alle UI-Texte zentral in `texts.ts` (i18n-Vorbereitung)
- CORS: `http://localhost:3900`
- Koordinatenfelder (latitude, longitude, mapsUrl) sind IMMER readonly und werden per "Koordinaten ermitteln"-Button befüllt

---

## 1. Schema-Erweiterung (Prisma-Migration)

### Neue Enums:

```prisma
enum WorkerType {
  EMPLOYED       // fest angestellt
  SUBCONTRACTED  // über Subunternehmen
}

enum WorkerAvailability {
  AVAILABLE      // verfügbar
  ON_PROJECT     // im Projekteinsatz
  SICK           // krank
  VACATION       // Urlaub
  UNAVAILABLE    // nicht verfügbar
}

enum LanguageProficiency {
  A1
  A2
  B1
  B2
  C1
  C2
  NATIVE         // Muttersprache
}
```

### Neues Model: Subcontractor (Subunternehmen)

```prisma
model Subcontractor {
  id                String   @id @default(cuid())
  name              String
  contactPerson     String?
  email             String?
  phone             String?
  addressLine1      String?
  addressLine2      String?
  postalCode        String?
  city              String?
  country           String?
  latitude          Float?
  longitude         Float?
  mapsUrl           String?
  taxNumber         String?
  vatId             String?
  iban              String?
  bic               String?
  bankName          String?
  notes             String?
  active            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  workers Worker[]
}
```

### Bestehende Felder im Worker-Model anpassen/erweitern:

```prisma
model Worker {
  // --- Bestehende Felder bleiben (id, workerNumber, firstName, lastName, email, phone, address*, active, notes, createdAt, updatedAt) ---
  
  // --- Bestehende Felder ÄNDERN ---
  // qualifications: ENTFERNEN (wird durch WorkerCertification ersetzt)
  // languageCode: ENTFERNEN (wird durch WorkerLanguage ersetzt)
  // emergencyContact: ENTFERNEN (wird durch strukturierte Felder ersetzt)
  // photoPath: bleibt, wird für Profilbild genutzt
  
  // --- Neue Felder: Stammdaten ---
  workerType            WorkerType          @default(SUBCONTRACTED)
  availability          WorkerAvailability  @default(AVAILABLE)
  dateOfBirth           DateTime?
  placeOfBirth          String?
  
  // --- Neue Felder: Kontakt & Notfall ---
  phoneSecondary        String?
  emergencyContactName  String?
  emergencyContactPhone String?
  emergencyContactRelation String?
  
  // --- Neue Felder: Ausweise & Reisedokumente ---
  idNumber              String?    // Personalausweis-Nr.
  taxNumber             String?    // Steuernummer
  socialSecurityNumber  String?    // Sozialversicherungsnummer
  oib                   String?    // OIB (Kroatien/Balkan)
  passportNumber        String?
  passportExpiry        DateTime?
  residencePermitNumber String?
  residencePermitExpiry DateTime?
  workPermitNumber      String?
  workPermitExpiry      DateTime?
  
  // --- Neue Felder: Vertrag & Kosten ---
  subcontractorId       String?
  contractStart         DateTime?
  contractEnd           DateTime?
  hourlyRate            Float?
  dailyRate             Float?
  
  // --- Neue Felder: PSA-Größen ---
  shoeSize              String?
  clothingSize          String?    // S, M, L, XL, XXL, etc.
  
  // --- Relations ---
  subcontractor  Subcontractor?     @relation(fields: [subcontractorId], references: [id], onDelete: SetNull)
  languages      WorkerLanguage[]
  certifications WorkerCertification[]
  teamMemberships WorkerTeamMember[]
}
```

### Neues Model: WorkerLanguage

```prisma
model WorkerLanguage {
  id          String              @id @default(cuid())
  workerId    String
  language    String              // "Deutsch", "Englisch", "Kroatisch", etc.
  proficiency LanguageProficiency

  worker Worker @relation(fields: [workerId], references: [id], onDelete: Cascade)

  @@unique([workerId, language])
}
```

### Neues Model: WorkerCertification

```prisma
model WorkerCertification {
  id          String    @id @default(cuid())
  workerId    String
  name        String    // z.B. "Elektrofachkraft", "SCC", "Ersthelfer", "Höhenarbeiter"
  issuedBy    String?   // Ausstellende Stelle
  issuedDate  DateTime?
  expiryDate  DateTime?
  notes       String?

  worker Worker @relation(fields: [workerId], references: [id], onDelete: Cascade)
}
```

### Neues Model: WorkerTeam

```prisma
model WorkerTeam {
  id          String   @id @default(cuid())
  name        String
  description String?
  leaderId    String?  // Worker-ID des Teamleiters
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members WorkerTeamMember[]
}
```

### Neues Model: WorkerTeamMember

```prisma
model WorkerTeamMember {
  id       String    @id @default(cuid())
  teamId   String
  workerId String
  joinedAt DateTime  @default(now())
  leftAt   DateTime?
  role     String?   // z.B. "Elektriker", "Helfer"

  team   WorkerTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  worker Worker     @relation(fields: [workerId], references: [id], onDelete: Cascade)

  @@unique([teamId, workerId, leftAt])
}
```

### DocumentType enum erweitern:

```prisma
// Neue Werte hinzufügen:
  PASSPORT           // Reisepass-Kopie
  ID_CARD            // Ausweis-Kopie
  WORK_PERMIT        // Arbeitserlaubnis
  RESIDENCE_PERMIT   // Aufenthaltsgenehmigung
  CERTIFICATION      // Zertifikat/Nachweis
  HEALTH_CERTIFICATE // Gesundheitszeugnis
  WORKER_PHOTO       // Profilbild
```

### ProjectAssignment erweitern:

Das bestehende `ProjectAssignment`-Model bekommt eine Constraint-Logik:
- Ein Worker kann nur EINE aktive Zuweisung haben (`active: true`)
- Bevor eine neue Zuweisung erstellt wird, muss geprüft werden ob bereits eine aktive existiert → Fehlermeldung mit Hinweis welches Projekt belegt ist

---

## 2. Backend (NestJS)

### 2.1 Workers-Controller (`/api/workers`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/workers` | Liste mit Suche, Filter (type, availability, subcontractorId, teamId), Sortierung, Pagination |
| GET | `/api/workers/:id` | Detail mit allen Relations (languages, certifications, teamMemberships, subcontractor, currentAssignment) |
| POST | `/api/workers` | Neuen Monteur anlegen (workerNumber auto-generiert: W-YYYY-NNNN) |
| PATCH | `/api/workers/:id` | Monteur aktualisieren |
| DELETE | `/api/workers/:id` | Soft-Delete (deletedAt setzen, falls noch nicht vorhanden → `deletedAt` Feld zum Worker hinzufügen!) |
| POST | `/api/workers/:id/photo` | Profilbild hochladen (zu MinIO, photoPath aktualisieren) |
| GET | `/api/workers/:id/photo` | Profilbild abrufen |

### 2.2 Worker-Languages (`/api/workers/:id/languages`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/workers/:id/languages` | Alle Sprachkenntnisse |
| POST | `/api/workers/:id/languages` | Sprache hinzufügen |
| PATCH | `/api/workers/:id/languages/:langId` | Niveau ändern |
| DELETE | `/api/workers/:id/languages/:langId` | Sprache entfernen |

### 2.3 Worker-Certifications (`/api/workers/:id/certifications`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/workers/:id/certifications` | Alle Zertifikate |
| POST | `/api/workers/:id/certifications` | Zertifikat hinzufügen |
| PATCH | `/api/workers/:id/certifications/:certId` | Zertifikat bearbeiten |
| DELETE | `/api/workers/:id/certifications/:certId` | Zertifikat entfernen |

### 2.4 Subcontractors (`/api/subcontractors`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/subcontractors` | Liste mit Suche, Pagination |
| GET | `/api/subcontractors/:id` | Detail mit zugehörigen Monteuren |
| POST | `/api/subcontractors` | Neues Subunternehmen |
| PATCH | `/api/subcontractors/:id` | Bearbeiten |
| DELETE | `/api/subcontractors/:id` | Soft-Delete |

### 2.5 Teams (`/api/teams`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/teams` | Alle Teams mit Mitglieder-Anzahl |
| GET | `/api/teams/:id` | Team-Detail mit Mitgliederliste |
| POST | `/api/teams` | Team erstellen |
| PATCH | `/api/teams/:id` | Team bearbeiten |
| DELETE | `/api/teams/:id` | Team löschen |
| POST | `/api/teams/:id/members` | Mitglied hinzufügen |
| DELETE | `/api/teams/:id/members/:memberId` | Mitglied entfernen (leftAt setzen) |

### 2.6 Projektzuweisung (Ergänzung)

Die bestehende Route `POST /api/projects/:id/assignments` muss erweitert werden:
- **Prüfung**: Hat der Worker bereits eine aktive Zuweisung (`active: true`) in einem anderen Projekt?
- **Wenn ja**: HTTP 409 mit Fehler: `{ "message": "Worker ist bereits dem Projekt '{projectTitle}' zugewiesen. Bitte zuerst die bestehende Zuweisung beenden." }`
- **Wenn nein**: Zuweisung erstellen, Worker-Availability auf `ON_PROJECT` setzen
- Beim Beenden einer Zuweisung (PATCH `active: false`): Worker-Availability zurück auf `AVAILABLE` setzen

### 2.7 Ablaufwarnungen-Endpoint

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/workers/expiring-documents` | Alle Monteure deren Reisepass, Aufenthaltsgenehmigung oder Arbeitserlaubnis in den nächsten 30 Tagen abläuft |

---

## 3. Frontend

### 3.1 Monteur-Liste (`/workers`)

- Tabelle (Desktop) / Karten (Mobile) mit:
  - Profilbild (klein, rund), Name, Typ-Badge (Angestellt/Sub), Verfügbarkeit-Badge
  - Subunternehmen, aktuelles Projekt, Stundensatz
- Filter: Typ, Verfügbarkeit, Subunternehmen, Team
- Suche: Name, workerNumber
- Sortierung: Name, Nummer, Stundensatz
- Button "Neuer Monteur"

### 3.2 Monteur-Detail (`/workers/[id]`) – 6 Tabs

#### Tab 1: Stammdaten
- Profilbild (Upload mit Vorschau, rund zugeschnitten)
- **Section "Persönlich"**: Vorname, Nachname, Geburtsdatum, Geburtsort, Nationalität, Monteur-Nummer (readonly)
- **Section "Kontakt"**: E-Mail, Telefon, Telefon 2
- **Section "Adresse"**: Straße, PLZ, Ort, Land + "Koordinaten ermitteln"-Button
- **Section "Notfallkontakt"**: Name, Telefon, Beziehung
- **Section "PSA-Größen"**: Schuhgröße, Konfektionsgröße
- **Section "Notizen"**: Freitext
- Verfügbarkeits-Badge oben (änderbar über Dropdown)

#### Tab 2: Dokumente & Ausweise
- **Section "Ausweise & IDs"**: Personalausweis-Nr., Steuernummer, Sozialversicherungsnr., OIB, Reisepass-Nr. + Ablauf, Aufenthaltsgenehmigung-Nr. + Ablauf, Arbeitserlaubnis-Nr. + Ablauf
  - Ablaufdaten die in <30 Tagen ablaufen: **gelb** markiert
  - Ablaufdaten die abgelaufen sind: **rot** markiert
- **Section "Dokumente"**: DocumentsTab (wie bei Kunden/Projekten, entityType: `WORKER`)

#### Tab 3: Qualifikationen & Sprachen
- **Section "Sprachkenntnisse"**: Liste mit Sprache + Niveau (Badges A1–C2/Muttersprache). Dialog zum Hinzufügen: Sprache (Combobox mit Deutsch, Englisch, Französisch, Kroatisch, Serbisch, Bosnisch, Polnisch, Rumänisch, Ungarisch, Türkisch, Slowenisch + freie Eingabe), Niveau (Dropdown A1–C2 + Muttersprache)
- **Section "Zertifikate & Schulungen"**: Liste mit Name, ausgestellt von, Datum, Ablaufdatum. Dialog zum Hinzufügen/Bearbeiten. Ablaufwarnungen wie bei Ausweisen (gelb/rot). Combobox mit Vorschlägen: Elektrofachkraft, SCC Dok. 017, SCC Dok. 018, Ersthelfer, Höhenarbeiter (PSAgA), Schweißerprüfung, Staplerschein, Brandschutzhelfer, DGUV V3, VOB-Kenntnisse + freie Eingabe

#### Tab 4: Vertrag & Kosten
- **Section "Typ & Subunternehmen"**: Worker-Typ (Dropdown: Angestellt/Subunternehmen), Subunternehmen (Dropdown der aktiven Subunternehmen, nur wenn Typ=Subunternehmen)
- **Section "Vertragsdaten"**: Vertragsbeginn, Vertragsende, Status-Info
- **Section "Stundensätze"**: Stundensatz, Tagessatz
- Wenn Subunternehmen gewählt: Link zum Subunternehmen (anklickbar → öffnet Subunternehmen-Detail)

#### Tab 5: Ausrüstung
- Bestehende `WorkerEquipmentIssue`-Logik nutzen
- Tabelle: Equipment-Name, Kategorie (Werkzeug/PSA/Messgerät/Sonstiges), ausgegeben am, zurückgegeben am, Zustand
- Button "Equipment ausgeben" → Dialog mit Equipment-Auswahl
- Button "Rückgabe" bei offenen Ausgaben

#### Tab 6: Projekte & Teams
- **Section "Aktuelle Projektzuweisung"**: Aktuelles Projekt (wenn vorhanden) mit Projektname, Rolle, seit wann. Button "Zuweisung beenden"
- **Section "Projekt-Historie"**: Vergangene Zuweisungen (Projekt, Rolle, Zeitraum)
- **Section "Teams"**: Aktuelle Team-Mitgliedschaften mit Team-Name und Rolle. Button "Zu Team hinzufügen"

### 3.3 Neuer Monteur (`/workers/new`)

- Formular mit den wichtigsten Stammdaten (Tab 1 Felder)
- Nach Speichern → Weiterleitung zur Detail-Seite

### 3.4 Subunternehmen (`/subcontractors`)

- **Liste**: Tabelle mit Name, Kontaktperson, Stadt, Anzahl aktive Monteure
- **Detail** (`/subcontractors/[id]`): 
  - Firmendaten (Name, Kontaktperson, Adresse, Koordinaten, Steuer-Nr., USt-ID)
  - Bankverbindung (IBAN, BIC, Bank)
  - Liste der zugehörigen Monteure (anklickbar → Monteur-Detail)
  - Notizen

### 3.5 Teams (`/teams`)

- **Liste**: Team-Karten mit Name, Teamleiter, Anzahl Mitglieder, Beschreibung
- **Detail** (`/teams/[id]`):
  - Team-Info (Name, Beschreibung, Teamleiter-Dropdown aus Mitgliedern)
  - Mitglieder-Liste mit Profilbild, Name, Rolle, beigetreten am
  - Button "Mitglied hinzufügen" → Worker-Auswahl-Dialog

### 3.6 Sidebar erweitern

Im Navigationsmenü unter "Projekte" hinzufügen:
- **Monteure** → `/workers`
- **Teams** → `/teams`  
- **Subunternehmen** → `/subcontractors`

### 3.7 Dashboard erweitern

Die Dashboard-Karte "Monteure" soll die Verfügbarkeits-Verteilung zeigen:
- X verfügbar, Y im Einsatz, Z krank/Urlaub
- Warnhinweis wenn Dokumente bald ablaufen (Anzahl)

---

## 4. Seed-Daten

Erstelle aussagekräftige Testdaten:

### 2 Subunternehmen:
1. "Elektro Kovačević d.o.o." – Zagreb, Kroatien
2. "Baltic Power Solutions" – Gdańsk, Polen

### 6 Monteure (erweitere/ändere bestehende Seed-Worker):
1. Marko Kovačević – Elektriker, Sub: Kovačević, Kroatisch (Muttersprache), Deutsch (B1), hat OIB, Pass, Aufenthaltsgenehmigung (läuft in 20 Tagen ab!), SCC + Elektrofachkraft-Zertifikate
2. Ivan Horvat – Helfer, Sub: Kovačević, Kroatisch (Muttersprache), Deutsch (A2), hat OIB
3. Piotr Wiśniewski – Elektriker, Sub: Baltic Power, Polnisch (Muttersprache), Deutsch (B2), Englisch (B1)
4. Tomasz Kowalski – Helfer, Sub: Baltic Power, Polnisch (Muttersprache), Deutsch (A1)
5. Stefan Müller – Elektriker, Angestellt, Deutsch (Muttersprache), Englisch (B2), alle Zertifikate
6. Ahmed Özdemir – Elektriker, Angestellt, Türkisch (Muttersprache), Deutsch (C1), Englisch (A2)

### 2 Teams:
1. "Team Hafenterminal" – Leiter: Marko, Mitglieder: Ivan, Piotr
2. "Team Neubau Süd" – Leiter: Stefan, Mitglieder: Ahmed, Tomasz

### Projektzuweisungen:
- Marko, Ivan, Piotr → Projekt "Videoüberwachung Hafenterminal" (aktiv)
- Stefan, Ahmed, Tomasz → Projekt "Elektroinstallation Neubau Süd" (aktiv)

### Equipment-Ausgaben:
- Marko: Hilti Bohrmaschine, Multimeter (ausgegeben)
- Stefan: Werkzeugkoffer, PSA-Set (ausgegeben)

---

## 5. Validierungen & Business-Regeln

1. **Einzel-Projekt-Constraint**: Ein Worker kann nur EIN aktives Projekt haben. Fehlermeldung bei Verstoß.
2. **Ablaufwarnungen**: Frontend zeigt gelb (<30 Tage) und rot (abgelaufen) für: Reisepass, Aufenthaltsgenehmigung, Arbeitserlaubnis, Zertifikate mit Ablaufdatum
3. **Verfügbarkeit auto-update**: Bei Projekt-Zuweisung → ON_PROJECT, bei Zuweisung-Ende → AVAILABLE
4. **Worker-Nummer**: Auto-generiert als W-YYYY-NNNN (fortlaufend pro Jahr)
5. **Subunternehmen-Pflicht**: Wenn workerType=SUBCONTRACTED, muss subcontractorId gesetzt sein (Frontend-Validierung + API-Warnung)
6. **Profilbild**: Max 5 MB, nur JPEG/PNG. Wird in MinIO gespeichert, Thumbnail (150x150) generieren wenn sharp verfügbar, sonst Original speichern.

---

## 6. Technische Hinweise

- Migration: Bestehende Worker-Daten migrieren (qualifications → als erste WorkerCertification, languageCode → als WorkerLanguage, emergencyContact → in emergencyContactName splitten wenn möglich)
- `deletedAt` Feld zum Worker-Model hinzufügen (Soft-Delete)
- Alle neuen Endpoints mit `JwtAuthGuard` schützen
- Pagination/Filter/Sort-Pattern vom Kunden- und Projektmodul übernehmen
- Frontend: shadcn/ui Komponenten, React Hook Form + Zod, gleicher Style wie Kunden/Projekte
- Combobox-Komponente (`apps/web/src/components/ui/combobox.tsx`) existiert bereits – nutzen für Sprachen und Zertifikats-Namen
- DocumentsTab-Komponente existiert bereits und unterstützt beliebige entityTypes – für Workers wiederverwenden

---

## 7. Ausführungsreihenfolge

1. Prisma-Schema erweitern + Migration erstellen
2. Backend: Subcontractors-Module, Workers-Module (erweitern), Teams-Module
3. Frontend: API-Client (`lib/workers.ts`, `lib/subcontractors.ts`, `lib/teams.ts`)
4. Frontend: Texte in `texts.ts` erweitern
5. Frontend: Alle Seiten und Komponenten
6. Seed-Daten
7. Sidebar + Dashboard erweitern
8. Docker Build + Smoke-Test
