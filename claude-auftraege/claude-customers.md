# Claude Code – Auftrag #2: Kundenmodul (CRM) + Dokumenten-Modul

## Kontext

Das Projekt-Fundament steht (Auftrag #1 abgeschlossen). Der Stack läuft in Docker:
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)
- CORS: erlaubt Origin `http://localhost:3900`

Jetzt sollen das **Kundenmodul** und das **Dokumenten-Modul** vollständig implementiert werden – Schema-Migration, API-Endpoints und Frontend-UI.

### Wichtige übergreifende Regeln:
- Die App muss auf **Desktop, Tablet und Handy** gleichermaßen gut bedienbar sein
- Keine langen Formular-Scrollorgien – Inhalte in **Tabs/Sections** aufteilen
- Alle klickbaren Elemente mind. **44px Touch-Target**
- Telefonnummern als `tel:`-Links (öffnet Telefon-App auf Mobile)
- E-Mail-Adressen als `mailto:`-Links
- Maps-Button öffnet Google Maps / native Maps-App
- Alle UI-Texte zentral in `texts.ts` (i18n-Vorbereitung, keine hartcodierten Strings)

---

## 1. Schema-Erweiterung (Prisma-Migration)

### Bestehende Modelle anpassen:

#### Customer – Felder anpassen:

**Entfernen** (werden nach CustomerEmail migriert):
- `email` → wird zu CustomerEmail mit Typ GENERAL
- `billingEmail` → wird zu CustomerEmail mit Typ BILLING
- `serviceEmail` → wird zu CustomerEmail mit Typ SERVICE

**Neue Felder hinzufügen:**
- `taxNumber String?` – Steuernummer (zusätzlich zum bestehenden `vatId`)
- `industry String?` – Branche
- `rating String?` – Interne Bewertung (A, B, C, D)
- `paymentTermDays Int?` – Zahlungsziel in Tagen
- `latitude Float?` – Geo-Koordinate
- `longitude Float?` – Geo-Koordinate
- `mapsUrl String?` – Direkter Maps-/Routing-Link

#### CustomerBranch – neue Felder hinzufügen:
- `latitude Float?`
- `longitude Float?`
- `mapsUrl String?`
- `branchType String?` – Typ: HEADQUARTERS, OFFICE, WAREHOUSE, SITE, OTHER

#### CustomerContact – neue Felder hinzufügen:
- `title String?` – Anrede (Herr, Frau, Dr., etc.)
- `department String?` – Abteilung
- `addressLine1 String?`
- `addressLine2 String?`
- `postalCode String?`
- `city String?`
- `country String?`
- `birthday DateTime?` – Geburtstag
- `linkedInUrl String?`
- `preferredContactMethod String?` – EMAIL, PHONE, MOBILE

### Neue Modelle erstellen:

#### CustomerEmail (unbegrenzt viele E-Mails pro Kunde)
```prisma
model CustomerEmail {
  id         String  @id @default(cuid())
  customerId String
  email      String
  emailType  String  // GENERAL, BILLING, SERVICE, SUPPORT, PROJECT, OTHER
  label      String? // Freitext-Bezeichnung
  isPrimary  Boolean @default(false)

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
}
```

#### CustomerBankAccount (max. 2 pro Kunde, aber als Liste modelliert)
```prisma
model CustomerBankAccount {
  id         String  @id @default(cuid())
  customerId String
  bankName   String
  iban       String
  bic        String?
  accountHolder String?
  isPrimary  Boolean @default(false)
  notes      String?

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
}
```

### Relationen in Customer ergänzen:
```prisma
emails       CustomerEmail[]
bankAccounts CustomerBankAccount[]
```

### DocumentType-Enum erweitern:
Zum bestehenden Enum `DocumentType` hinzufügen:
- `BUSINESS_CARD`
- `CONTRACT`
- `LOGO`
- `CERTIFICATE`
- `NOTE_DOCUMENT`

(Falls der Enum diese Werte noch nicht hat.)

---

## 2. API-Endpoints (NestJS)

### Neues Modul: `apps/api/src/customers/`

Struktur:
```
customers/
  customers.module.ts
  customers.controller.ts
  customers.service.ts
  dto/
    create-customer.dto.ts
    update-customer.dto.ts
    create-branch.dto.ts
    update-branch.dto.ts
    create-contact.dto.ts
    update-contact.dto.ts
    create-email.dto.ts
    create-bank-account.dto.ts
```

### Endpoints:

#### Kunden CRUD:
- `GET /api/customers` – Liste aller Kunden (Paginierung, Suche nach companyName/customerNumber)
- `GET /api/customers/:id` – Einzelkunde mit Branches, Contacts, Emails, BankAccounts
- `POST /api/customers` – Neuen Kunden anlegen
- `PATCH /api/customers/:id` – Kunden bearbeiten
- `DELETE /api/customers/:id` – Soft-Delete (setzt deletedAt)

#### Niederlassungen CRUD:
- `GET /api/customers/:customerId/branches` – Alle Niederlassungen eines Kunden
- `POST /api/customers/:customerId/branches` – Niederlassung anlegen
- `PATCH /api/customers/:customerId/branches/:id` – Niederlassung bearbeiten
- `DELETE /api/customers/:customerId/branches/:id` – Niederlassung löschen

#### Ansprechpartner CRUD:
- `GET /api/customers/:customerId/contacts` – Alle Kontakte eines Kunden
- `POST /api/customers/:customerId/contacts` – Kontakt anlegen
- `PATCH /api/customers/:customerId/contacts/:id` – Kontakt bearbeiten
- `DELETE /api/customers/:customerId/contacts/:id` – Kontakt löschen

#### E-Mails CRUD:
- `GET /api/customers/:customerId/emails` – Alle E-Mail-Adressen
- `POST /api/customers/:customerId/emails` – E-Mail hinzufügen
- `PATCH /api/customers/:customerId/emails/:id` – E-Mail bearbeiten
- `DELETE /api/customers/:customerId/emails/:id` – E-Mail löschen

#### Bankverbindungen CRUD:
- `GET /api/customers/:customerId/bank-accounts` – Alle Bankverbindungen
- `POST /api/customers/:customerId/bank-accounts` – Bankverbindung anlegen (max. 2 prüfen!)
- `PATCH /api/customers/:customerId/bank-accounts/:id` – bearbeiten
- `DELETE /api/customers/:customerId/bank-accounts/:id` – löschen

### Geschäftsregeln:
- Kundennummer wird automatisch generiert (Format: `K-YYYY-NNNN`, z.B. K-2026-0001)
- Soft-Delete: gelöschte Kunden werden nicht in der Standardliste angezeigt
- Max. 2 Bankverbindungen pro Kunde (Service wirft 400 bei Überschreitung)
- Nur Rollen SUPERADMIN, OFFICE, PROJECT_MANAGER dürfen Kunden verwalten
- Alle Schreiboperationen werden im AuditLog protokolliert

### Validierung (class-validator):
- E-Mail-Felder: @IsEmail()
- IBAN: @IsString() @MinLength(15) @MaxLength(34)
- Kundennummer: automatisch, nicht vom Client setzbar
- Pflichtfelder: companyName bei Customer, firstName+lastName bei Contact, email bei CustomerEmail

---

## 3. Frontend (Next.js)

### Seiten und Komponenten:

#### Kundenliste (`/customers`):
- Tabelle mit Spalten: Kundennr., Firmenname, Ort, Branche, Bewertung, Status
- Suchfeld (filtert nach Name und Nummer)
- Button "Neuer Kunde"
- Klick auf Zeile → Kundendetail
- Badge für Bewertung (A=grün, B=blau, C=gelb, D=rot)

#### Kundendetail (`/customers/[id]`):
Tabs-Layout mit folgenden Tabs:

**Tab 1: Stammdaten**
- Firmenname, Rechtsform, Kundennummer (readonly), Status
- Branche, Bewertung, Zahlungsziel
- Adresse (Straße, PLZ, Ort, Land)
- Koordinaten + Maps-Link (mit Button "Route öffnen" → öffnet Google Maps)
- Allg. Telefon, Website
- USt-ID, Steuernummer
- Notizen (Textfeld)

**Tab 2: E-Mail-Adressen**
- Liste aller E-Mails mit Typ-Badge
- Inline-Hinzufügen/Bearbeiten/Löschen
- Primär-Markierung

**Tab 3: Bankverbindungen**
- Max. 2 Einträge anzeigen
- Bankname, IBAN (teilmaskiert in Übersicht), BIC, Kontoinhaber
- Hinzufügen/Bearbeiten/Löschen (Button "Hinzufügen" deaktiviert wenn 2 vorhanden)

**Tab 4: Niederlassungen**
- Liste der Standorte mit Typ-Badge
- Klick öffnet Detail/Edit-Dialog
- Eigene Adresse, Telefon, E-Mail, Koordinaten, Maps-Link
- Button "Route öffnen"

**Tab 5: Ansprechpartner**
- Liste aller Kontakte (gruppiert nach Niederlassung / Hauptsitz)
- Anrede, Name, Funktion, Abteilung, E-Mail, Telefon
- Geburtstag, LinkedIn-Link
- Zuordnung zu Niederlassung oder Hauptsitz
- Flags: Buchhaltung / Projektleitung / Unterschriftsberechtigt
- Button "Visitenkarte hochladen" → nutzt Dokumenten-Upload

**Tab 6: Dokumente**
- Alle zum Kunden verknüpften Dokumente (via DocumentLink)
- Upload-Button
- Typ-Filter (Visitenkarte, Vertrag, Logo, Zertifikat, Notiz-Dokument, Sonstiges)
- Download/Preview

### UI-Anforderungen:
- Formulare mit React Hook Form + Zod-Validierung
- **Responsive Design (3 Breakpoints):**
  - **Desktop (≥1024px):** Tabellen-Ansicht in Listen, Side-by-Side-Layouts in Detail-Formularen
  - **Tablet (768–1023px):** Kompaktere Tabelle, Cards für Unter-Entities
  - **Mobile (<768px):** Card-basierte Listen statt Tabellen, gestapelte Layouts, keine horizontalen Scrolls
- **Tab-Navigation im Kundendetail** – keine lange Scroll-Seite! Klare Trennung der Bereiche
- **Leere Zustände:** Jede Liste zeigt einen hilfreichen Empty-State mit Aktion ("Noch keine Ansprechpartner. Jetzt anlegen →")
- **Ladeanimationen:** Skeleton-Loader für Listen und Formulare
- **Breadcrumbs:** Kunden → Kundendetail → zeigt Firmenname
- **Sortierung:** Kundenliste sortierbar nach Name, Kundennr., Ort, Bewertung
- Bestätigungsdialoge bei Löschen
- Toast-Benachrichtigungen bei Erfolg/Fehler
- Alle UI-Texte zentral in `texts.ts` (i18n-Vorbereitung)
- Bestehender Stil: shadcn/ui, nüchtern, professionell
- **Telefonnummern** als klickbare `tel:`-Links
- **E-Mail-Adressen** als klickbare `mailto:`-Links
- **Maps-Button:** "Route öffnen" → `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` (öffnet native App auf Mobile)

---

## 4. Seed-Daten erweitern

Zum bestehenden Seed hinzufügen:
- 3 Beispielkunden mit unterschiedlichen Bewertungen (A, B, C)
- Jeder mit 1-2 Niederlassungen
- Jeder mit 2-4 Ansprechpartnern (verteilt auf Niederlassungen)
- Jeder mit 2-3 E-Mail-Adressen (verschiedene Typen)
- 2 Kunden mit Bankverbindung

---

## 5. Technische Anforderungen

- Prisma-Migration erstellen (`prisma migrate dev --name add_customer_module`)
- **E-Mail-Migration:** Die bestehenden Felder `email` und `billingEmail` aus dem Customer-Model entfernen. In der Migration: bestehende Werte aus diesen Feldern in neue `CustomerEmail`-Einträge überführen (GENERAL bzw. BILLING). Danach Spalten droppen.
- Bestehende Seed-Daten NICHT löschen – neuen Seed additiv ergänzen (idempotent!)
- CORS bleibt auf `http://localhost:3900`
- Alle neuen Endpoints durch RolesGuard geschützt (SUPERADMIN, OFFICE, PROJECT_MANAGER)
- Dokumenten-Upload nutzt den MinIO-Storage (Bucket automatisch erstellen)
- Die Kundenliste soll bei 100+ Einträgen performant sein (Paginierung: `?page=1&limit=25`)
- API-Fehler immer als strukturiertes JSON: `{ statusCode, message, error }`
- Prisma-Queries mit `select` oder `include` optimieren (kein overfetching)

---

## 6. Erwartetes Ergebnis

Nach Abschluss:
1. `docker compose -f docker-compose.dev.yml up --build` startet sauber
2. Migration läuft durch (inkl. E-Mail-Feld-Migration)
3. Seed-Daten enthalten Beispielkunden mit allen Unter-Entities
4. Login → Sidebar "Kunden" → Kundenliste sichtbar
5. Kundenliste: Suche, Sortierung, Paginierung funktionieren
6. Kundenliste auf Handy: Cards statt Tabelle, gut bedienbar
7. Neuer Kunde kann angelegt werden (Formular in Tabs/Sections aufgeteilt)
8. Kundendetail mit allen 6 Tabs funktioniert
9. E-Mails, Bankverbindungen, Niederlassungen, Kontakte sind CRUD-fähig
10. Dokument kann hochgeladen, verknüpft und heruntergeladen werden
11. "Route öffnen" öffnet Google Maps mit den Koordinaten
12. Telefonnummern und E-Mails sind auf Mobile klickbar (tel:/mailto:)
13. Alle Ansichten funktionieren auf Desktop, Tablet UND Handy

### Smoke-Test-Checkliste:
- [ ] API Health: `GET /api` → 200
- [ ] Login: `POST /api/auth/login` → JWT
- [ ] Kundenliste: `GET /api/customers` → Array mit Seed-Kunden
- [ ] Kunde anlegen: `POST /api/customers` → 201
- [ ] Kundendetail: `GET /api/customers/:id` → vollständiges Objekt mit Relations
- [ ] E-Mail hinzufügen: `POST /api/customers/:id/emails` → 201
- [ ] Bankverbindung max 2: Dritte `POST /api/customers/:id/bank-accounts` → 400
- [ ] Dokument-Upload: `POST /api/documents/upload` (multipart) → 201
- [ ] Dokument-Download: `GET /api/documents/:id/download` → File-Stream
- [ ] Frontend: alle Tabs rendern ohne Fehler
- [ ] Frontend Mobile: Viewport 375px → alles bedienbar

---

## 7. Dokumenten-Modul (Abhängigkeit)

Das Kundenmodul braucht Dokument-Upload (Visitenkarten, Verträge, etc.). Erstelle ein vollständiges Documents-Modul.

### Modul-Struktur: `apps/api/src/documents/`
```
documents/
  documents.module.ts
  documents.controller.ts
  documents.service.ts
  storage.service.ts      → MinIO-Integration (Upload, Download, Delete)
  dto/
    upload-document.dto.ts
```

### API-Endpoints:
- `POST /api/documents/upload` – Datei hochladen (Multipart/FormData) + Metadaten (documentType, title, description)
- `POST /api/documents/:id/link` – Dokument mit Entity verknüpfen (entityType: CUSTOMER | BRANCH | CONTACT, entityId)
- `GET /api/documents?entityType=CUSTOMER&entityId=xxx` – Dokumente einer Entity auflisten
- `GET /api/documents/:id/download` – Datei herunterladen (Signed URL oder Stream)
- `DELETE /api/documents/:id` – Dokument löschen (aus Storage + DB)

### Storage-Service (MinIO):
- Upload → MinIO Bucket `office-documents`
- Pfad-Schema: `{entityType}/{entityId}/{timestamp}_{originalFilename}`
- Maximale Dateigröße: 10 MB
- Erlaubte MIME-Types: image/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.*
- MinIO-Client initialisieren mit Env-Variablen (MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET)
- Bucket automatisch erstellen falls nicht vorhanden (beim App-Start)

### Frontend (im Kunden-Tab 6 "Dokumente"):
- Upload-Bereich mit Drag&Drop oder File-Picker
- Typ-Auswahl beim Upload (Visitenkarte, Vertrag, Logo, Zertifikat, Notiz-Dokument, Sonstiges)
- Liste mit: Dateiname, Typ, Größe, Upload-Datum, Uploader
- Download-Button
- Lösch-Button (mit Bestätigung)
- Preview für Bilder (Thumbnail inline)

---

## 8. NICHT in diesem Auftrag

- Keine Projektverwaltung
- Keine Monteurverwaltung
- Keine Zeiterfassung
- Kein Kiosk-Modus
- Keine Volltextsuche (einfaches LIKE reicht)
- Kein Karten-Widget eingebettet (nur externer Maps-Link)
- Keine Versionierung von Dokumenten (kommt später)
