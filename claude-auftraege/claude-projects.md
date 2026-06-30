# Claude Code – Auftrag: Projektverwaltung

## Kontext

Das Kundenmodul, Dokumenten-Modul und Geocode-Modul sind implementiert und laufen in Docker:
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Das Projekt-Schema existiert bereits in der Datenbank (Model `Project`, `ProjectAssignment`, `ProjectNote`, `ProjectEmailRecipient`). Die Sidebar hat bereits einen "Projekte"-Link auf `/projects`. Dieses Modul baut darauf auf und erweitert es.

**Wichtig:** Es existiert bereits ein Geocode-Endpoint `GET /api/geocode?address=...` (nutzt OpenStreetMap Nominatim). Nutze diesen im Frontend für alle Adress→Koordinaten-Auflösungen (Sites, Unterkunft, Hauptstandort) mit einem "Koordinaten ermitteln"-Button, genau wie im Kundenmodul bereits umgesetzt.

### Wichtige übergreifende Regeln:
- Die App muss auf **Desktop, Tablet und Handy** gleichermaßen gut bedienbar sein
- Keine langen Formular-Scrollorgien – Inhalte in **Tabs/Sections** aufteilen
- Alle klickbaren Elemente mind. **44px Touch-Target**
- Telefonnummern als `tel:`-Links, E-Mails als `mailto:`-Links
- Maps-Buttons öffnen Google Maps / native Maps-App
- Alle UI-Texte zentral in `texts.ts` (i18n-Vorbereitung)
- CORS: `http://localhost:3900`
- Koordinatenfelder (latitude, longitude, mapsUrl) sind IMMER readonly und werden per "Koordinaten ermitteln"-Button über den Geocode-Endpoint befüllt

---

## 1. Schema-Erweiterung (Prisma-Migration)

### Bestehende Modelle anpassen:

#### Project – bestehende Felder ändern:
- `accommodationAddress String?` → **ENTFERNEN** und durch die neuen Felder ersetzen (Datenmigration: bestehenden Wert nach `accommodationAddressLine1` kopieren, dann alte Spalte droppen)

#### Project – neue Felder:
- `billingMode String?` – Abrechnungsmodus: HOURLY_PACKAGE | UNIT_BASED | MIXED
  - HOURLY_PACKAGE = Wochenpaket mit Stunden + Überstunden
  - UNIT_BASED = Leistungsabrechnung nach Einheiten/Maßen (Meter, Stück, m², etc.) – Detail-Logik kommt in späterem Auftrag
  - MIXED = Kombination aus beiden
- `weeklyPackageHours Float?` – Stunden im Wochenpaket (z.B. 40)
- `weeklyPackagePrice Float?` – Preis pro Wochenpaket
- `overtimeRatePerHour Float?` – Stundensatz für Überstunden
- `accommodationAddressLine1 String?`
- `accommodationAddressLine2 String?`
- `accommodationPostalCode String?`
- `accommodationCity String?`
- `accommodationCountry String?`
- `accommodationLatitude Float?`
- `accommodationLongitude Float?`
- `accommodationMapsUrl String?`
- `accommodationNotes String?` – Hinweise zur Unterkunft
- `siteAccessInfo String?` – Zugangsinfos (Tor-Code, Schlüssel, etc.)
- `siteWorkingHours String?` – Arbeitszeiten / Hausordnung vor Ort
- `latitude Float?` – Geo-Koordinate Hauptstandort
- `longitude Float?` – Geo-Koordinate Hauptstandort
- `mapsUrl String?` – Maps-Link Hauptstandort

#### ProjectAssignment – neues Feld:
- `isLead Boolean @default(false)` – Hauptmonteur/Verantwortlicher für dieses Projekt

### Neue Modelle:

#### ProjectSite (mehrere Einsatzorte pro Projekt)
```prisma
model ProjectSite {
  id            String   @id @default(cuid())
  projectId     String
  name          String   // z.B. "Gebäude A", "Tiefgarage", "Außenbereich"
  addressLine1  String?
  addressLine2  String?
  postalCode    String?
  city          String?
  country       String?
  latitude      Float?
  longitude     Float?
  mapsUrl       String?
  accessInfo    String?  // Zugangsinfos für diesen Standort
  notes         String?
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

#### ProjectEquipment (ausgegebene Werkzeuge/Geräte für Projekt)
```prisma
model ProjectEquipment {
  id            String    @id @default(cuid())
  projectId     String
  name          String    // z.B. "Bohrmaschine Hilti TE 70", "Leiter 8m"
  description   String?
  quantity      Int       @default(1)
  serialNumber  String?   // Falls vorhanden
  issuedAt      DateTime  @default(now())  // Ausgegeben am
  returnedAt    DateTime? // Zurückgegeben am (null = noch draußen)
  issuedTo      String?   // An wen ausgegeben (Freitext oder Worker-Referenz)
  condition     String?   // Zustand bei Ausgabe
  returnCondition String? // Zustand bei Rückgabe
  notes         String?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

#### ProjectStatusHistory (Status-Protokoll)
```prisma
model ProjectStatusHistory {
  id          String   @id @default(cuid())
  projectId   String
  fromStatus  String?
  toStatus    String
  changedByUserId String?
  comment     String?
  changedAt   DateTime @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  changedBy User?   @relation(fields: [changedByUserId], references: [id], onDelete: SetNull)
}
```

### Relationen in Project ergänzen:
```prisma
sites            ProjectSite[]
equipment        ProjectEquipment[]
statusHistory    ProjectStatusHistory[]
```

### Relation in User ergänzen:
```prisma
projectStatusChanges ProjectStatusHistory[]
```

### DocumentType-Enum erweitern (falls noch nicht vorhanden):
- `DRAWING` – Zeichnungen/Pläne
- `WORK_CONTRACT` – Werkvertrag
- `SPECIFICATION` – Leistungsverzeichnis/Spezifikation
- `SITE_PHOTO` – Baustellenfotos
- `HANDOVER_PROTOCOL` – Übergabeprotokoll

---

## 2. API-Endpoints (NestJS)

### Modul: `apps/api/src/projects/`

Struktur:
```
projects/
  projects.module.ts
  projects.controller.ts
  projects.service.ts
  dto/
    create-project.dto.ts
    update-project.dto.ts
    update-status.dto.ts
    create-site.dto.ts
    update-site.dto.ts
    create-equipment.dto.ts
    update-equipment.dto.ts
    create-email-recipient.dto.ts
```

### Endpoints:

#### Projekte CRUD:
- `GET /api/projects` – Liste (Paginierung, Suche, Filter nach status/customerId/serviceType)
- `GET /api/projects/:id` – Einzelprojekt mit Sites, Equipment, EmailRecipients, StatusHistory
- `POST /api/projects` – Neues Projekt anlegen (Projektnummer automatisch: P-YYYY-NNNN)
- `PATCH /api/projects/:id` – Projekt bearbeiten
- `DELETE /api/projects/:id` – Soft-Delete

#### Status-Workflow:
- `POST /api/projects/:id/status` – Status ändern (Body: `{ status, comment? }`)
  - Flexibel: JEDER Übergang erlaubt (kein hartes Enforcement)
  - Erstellt automatisch einen `ProjectStatusHistory`-Eintrag
  - Setzt `actualStartDate` automatisch wenn Status → ACTIVE (falls noch leer)
  - Setzt `actualEndDate` automatisch wenn Status → COMPLETED

#### Projektstandorte (Sites) CRUD:
- `GET /api/projects/:projectId/sites` – Alle Standorte
- `POST /api/projects/:projectId/sites` – Standort anlegen
- `PATCH /api/projects/:projectId/sites/:id` – bearbeiten
- `DELETE /api/projects/:projectId/sites/:id` – löschen

#### Projekt-Equipment CRUD:
- `GET /api/projects/:projectId/equipment` – Alle Geräte/Werkzeuge
- `POST /api/projects/:projectId/equipment` – Gerät ausgeben
- `PATCH /api/projects/:projectId/equipment/:id` – bearbeiten (z.B. Rückgabe eintragen)
- `DELETE /api/projects/:projectId/equipment/:id` – löschen

#### E-Mail-Verteiler CRUD:
- `GET /api/projects/:projectId/email-recipients` – Empfänger auflisten
- `POST /api/projects/:projectId/email-recipients` – Empfänger hinzufügen
- `PATCH /api/projects/:projectId/email-recipients/:id` – bearbeiten
- `DELETE /api/projects/:projectId/email-recipients/:id` – löschen

#### Projekt-Notizen:
- `GET /api/projects/:projectId/notes` – Alle Notizen
- `POST /api/projects/:projectId/notes` – Notiz anlegen
- `DELETE /api/projects/:projectId/notes/:id` – löschen

#### Monteur-Zuordnungen (Basis):
- `GET /api/projects/:projectId/assignments` – Zuordnungen auflisten
- `POST /api/projects/:projectId/assignments` – Monteur zuordnen
- `PATCH /api/projects/:projectId/assignments/:id` – bearbeiten (Rolle, Zeitraum, isLead)
- `DELETE /api/projects/:projectId/assignments/:id` – Zuordnung entfernen

#### Kalender/Timeline:
- `GET /api/projects/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD` – Alle Projekte im Zeitraum mit Start/End-Datum und Anzahl zugeordneter Monteure

### Geschäftsregeln:
- Projektnummer automatisch generiert (Format: `P-YYYY-NNNN`)
- Status-Änderung: flexibel, aber immer protokolliert
- Equipment: `returnedAt = null` bedeutet "noch nicht zurückgegeben" → Warnung in UI
- Nur SUPERADMIN, OFFICE, PROJECT_MANAGER dürfen Projekte verwalten
- Alle Schreiboperationen im AuditLog protokollieren
- Projekt-Dokumente nutzen das bestehende Documents-Modul (DocumentLink mit entityType=PROJECT)

---

## 3. Frontend (Next.js)

### Projektliste (`/projects`):

**Desktop:** Tabelle mit Spalten:
- Projektnr., Titel, Kunde, Status-Badge (farbig), Priorität, Leistungsart, Zeitraum, Monteure (Anzahl)

**Mobile:** Card-basiert mit den wichtigsten Infos

**Filter/Suche:**
- Freitextsuche (Titel, Projektnummer)
- Status-Filter (Multiselect: DRAFT, PLANNED, ACTIVE, etc.)
- Kunden-Filter (Dropdown)
- Leistungsart-Filter

**Sortierung:** Nach Priorität, Startdatum, Status, Kunde

**Quick-Filter-Buttons:** "Alle" | "Aktiv" | "Geplant" | "Abgeschlossen"

---

### Projektdetail (`/projects/[id]`):

#### Tab 1: Stammdaten
Aufgeteilt in Sections (keine endlose Feldliste!):

**Section "Allgemein":**
- Projektnummer (readonly), Titel, Beschreibung
- Kunde (Dropdown/Suche → verlinkt zu Kundendetail)
- Niederlassung (Dropdown, gefiltert nach gewähltem Kunden)
- Kundenansprechpartner (Dropdown, gefiltert nach Kunde)
- Leistungsart, Priorität, Status (mit farbigem Badge)
- Interner Projektleiter (Dropdown → User)

**Section "Zeitplan":**
- Geplanter Start / Geplantes Ende
- Tatsächlicher Start / Tatsächliches Ende
- Visuelle Zeitbalken-Anzeige (geplant vs. tatsächlich)

**Section "Abrechnung":**
- Abrechnungsmodus (Dropdown: Wochenpaket/Stunden | Nach Maß/Einheit | Gemischt)
- Bei Wochenpaket: Stunden, Preis, Überstundensatz
- Bei Nach Maß/Einheit: Hinweistext "Leistungspositionen werden in einem späteren Update ergänzt" (Platzhalter)
- Bei Gemischt: Beides sichtbar

**Section "Pausenregelung":**
- Eigene Regel oder globaler Default (Verweis auf BreakRule)

#### Tab 2: Standorte & Unterkunft

**Section "Hauptstandort (Baustelle)":**
- Adresse, Koordinaten (readonly), Maps-Link
- Button "Koordinaten ermitteln" (nutzt bestehenden `/api/geocode` Endpoint)
- Button "Route öffnen"
- Zugangsinfos (Freitext)
- Arbeitszeiten/Hausordnung (Freitext)

**Section "Weitere Einsatzorte":**
- Liste der ProjectSites (Name, Adresse, Zugangsinfo)
- Hinzufügen/Bearbeiten/Löschen (Dialog)
- Jeder Standort mit eigenem "Route öffnen" Button
- "Koordinaten ermitteln"-Button pro Standort im Dialog
- Drag&Drop für Sortierung

**Section "Unterkunft":**
- Adresse, Koordinaten (readonly), Maps-Link
- Button "Koordinaten ermitteln"
- Hinweise zur Unterkunft
- Button "Route öffnen"

#### Tab 3: Monteure
- Liste zugeordneter Monteure (Name, Rolle, Zeitraum, isLead-Badge)
- Hauptmonteur hervorgehoben (★)
- Hinzufügen (Worker-Auswahl aus bestehenden Seed-Daten)
- Bearbeiten (Rolle, Zeitraum, Lead-Status)
- Entfernen (mit Bestätigung)

#### Tab 4: Equipment & Werkzeug
- Liste ausgegebener Geräte/Werkzeuge
- Spalten: Name, Menge, Seriennr., Ausgegeben am, Rückgabe, Status
- Status-Badge: "Ausgegeben" (orange) / "Zurück" (grün)
- Filter: "Nur offene" (returnedAt = null)
- Hinzufügen-Dialog
- "Rückgabe erfassen" Button (setzt returnedAt + returnCondition)
- **Warnung oben:** "X Geräte noch nicht zurückgegeben" (wenn vorhanden)

#### Tab 5: Dokumente
- Wiederverwendung des Documents-Moduls (wie beim Kunden)
- Upload mit Typ-Auswahl: Zeichnung, Werkvertrag, Spezifikation, Baustellenfoto, Übergabeprotokoll, Sonstiges
- Liste, Download, Preview für Bilder

#### Tab 6: E-Mail-Verteiler
- Liste der Empfänger mit Typ (Buchhaltung, Projektleitung, CC)
- Hinzufügen/Bearbeiten/Löschen
- Wird später für Stundenzettel-Versand genutzt

#### Tab 7: Notizen & Verlauf
- Interne Notizen (erstellen, lesen, löschen)
- Status-Historie (readonly Zeitleiste: wer hat wann welchen Status gesetzt)

---

### Kalender/Timeline-Ansicht (`/projects/calendar`):

**Desktop:**
- Horizontale Timeline (Monate als Spalten)
- Jedes Projekt als farbiger Balken (Farbe = Status)
- Hover zeigt: Titel, Kunde, Anzahl Monteure, Zeitraum
- Klick → öffnet Projektdetail

**Tablet/Mobile:**
- Vereinfachte Listenansicht nach Monaten gruppiert
- Monat-Navigation (vor/zurück)
- Projekt-Cards mit Zeitbalken

**Inhalte:**
- Projektname + Kunde
- Zeitbalken (geplant vs. tatsächlich)
- Anzahl zugeordneter Monteure (Zahl im Balken)
- Status-Farbe

**Filter:**
- Zeitraum auswählen (von/bis)
- Nur aktive Projekte
- Nach Kunde filtern

---

## 4. Seed-Daten erweitern

Zum bestehenden Seed hinzufügen:
- 4 Beispielprojekte (verschiedene Status: DRAFT, PLANNED, ACTIVE, COMPLETED)
- Projekte verknüpft mit Seed-Kunden
- 2 Projekte mit je 2-3 Sites (Einsatzorten)
- 1 Projekt mit Equipment (3 Geräte, 1 davon zurückgegeben)
- 2 Projekte mit E-Mail-Verteilern
- Statushistorie für das COMPLETED-Projekt (DRAFT → PLANNED → ACTIVE → COMPLETED)
- 2-3 Monteur-Zuordnungen (mit bestehenden Seed-Workern)
- 1 Projekt mit Unterkunftsadresse

---

## 5. Technische Anforderungen

- Prisma-Migration erstellen (`prisma migrate dev --name add_projects_module`)
- Bestehende Seed-Daten NICHT löschen – additiv ergänzen (idempotent!)
- CORS bleibt auf `http://localhost:3900`
- Alle neuen Endpoints durch RolesGuard geschützt (SUPERADMIN, OFFICE, PROJECT_MANAGER)
- Dokumenten-Upload wiederverwendet das bestehende Documents-Modul
- Projektliste performant bei 100+ Einträgen (Paginierung: `?page=1&limit=25`)
- Timeline-Endpoint optimiert (nur nötige Felder, kein overfetching)
- API-Fehler als strukturiertes JSON

---

## 6. Erwartetes Ergebnis

Nach Abschluss:
1. Docker-Stack startet sauber mit Migration
2. Sidebar "Projekte" → Projektliste mit Seed-Daten
3. Neues Projekt anlegen (Tabs-Formular, nicht eine lange Seite!)
4. Projektdetail mit 7 Tabs funktioniert komplett
5. Mehrere Standorte (Sites) pro Projekt CRUD-fähig
6. Equipment-Ausgabe und Rückgabe funktioniert
7. Kalender/Timeline-Ansicht zeigt Projekte als Zeitbalken
8. Status-Workflow protokolliert Änderungen
9. Alle Ansichten funktionieren auf Desktop, Tablet UND Handy
10. Route-Buttons öffnen Google Maps

### Smoke-Test-Checkliste:
- [ ] `GET /api/projects` → Array mit Seed-Projekten
- [ ] `POST /api/projects` → 201 mit automatischer Projektnummer
- [ ] `GET /api/projects/:id` → vollständiges Objekt mit Relations
- [ ] `POST /api/projects/:id/status` → Status geändert, History-Eintrag erstellt
- [ ] `POST /api/projects/:id/sites` → Site angelegt
- [ ] `POST /api/projects/:id/equipment` → Equipment angelegt
- [ ] `PATCH /api/projects/:id/equipment/:id` (returnedAt setzen) → 200
- [ ] `GET /api/projects/timeline?from=2026-01-01&to=2026-12-31` → Projektliste mit Zeitdaten
- [ ] Frontend: alle 7 Tabs rendern ohne Fehler
- [ ] Frontend: Kalender zeigt Zeitbalken
- [ ] Frontend Mobile (375px) → alles bedienbar

---

## 7. NICHT in diesem Auftrag

- Kein Monteur-Modul (kommt separat als claude-workers.md)
- Keine Zeiterfassung / Clock-In/Out
- Keine Stundenzettel
- Kein PDF-Export
- Kein E-Mail-Versand (nur Verteiler-Verwaltung)
- Keine Drag&Drop Kalenderplanung (nur Ansicht)
- Keine Offline-Fähigkeit
