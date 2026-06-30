# Claude Code – Auftrag: Abrechnungsmodul

## Kontext

Alle bisherigen Module laufen (Kunden, Projekte, Monteure, Zeiterfassung):
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Die Zeiterfassung liefert genehmigte Wochenstundenzettel (`WeeklyTimesheet` mit Status APPROVED). Projekte haben `billingMode` (HOURLY_PACKAGE, UNIT_BASED, MIXED), `weeklyPackageHours`, `weeklyPackagePrice`, `overtimeRatePerHour`. Kunden haben `paymentTermDays`.

**Zwei Abrechnungsrichtungen:**
1. **Ausgangsrechnungen** (an Kunden): Was der Kunde mir schuldet
2. **Eingangsrechnungen** (von Subunternehmen): Was ich dem Sub schulde

**Features:** Teilrechnungen/Abschlagsrechnungen, Zahlungsziele pro Kunde, PDF-Export (Vorlage kommt später – erstmal sauberes Standard-Layout), kein Mahnwesen, DATEV-Export später.

### Wichtige übergreifende Regeln:
- Desktop, Tablet und Handy bedienbar
- Inhalte in Tabs/Sections aufteilen
- Alle klickbaren Elemente mind. 44px Touch-Target
- Alle UI-Texte zentral in `texts.ts`
- CORS: `http://localhost:3900`

---

## 1. Schema (Prisma-Migration)

### Neue Enums:

```prisma
enum InvoiceType {
  OUTGOING      // Ausgangsrechnung (an Kunde)
  INCOMING      // Eingangsrechnung (von Sub)
}

enum InvoiceStatus {
  DRAFT         // Entwurf
  SENT          // Versendet
  PARTIALLY_PAID // Teilweise bezahlt
  PAID          // Vollständig bezahlt
  CANCELLED     // Storniert
}

enum InvoiceLineType {
  WEEKLY_PACKAGE    // Wochenpaket-Pauschale
  OVERTIME          // Überstunden
  UNIT_BASED        // Einheitsbasiert (Meter, Stück, etc.)
  PARTIAL_PAYMENT   // Abschlagsrechnung
  CUSTOM            // Freie Position
}
```

### Neues Model: Invoice

```prisma
model Invoice {
  id                String        @id @default(cuid())
  invoiceNumber     String        @unique   // RE-YYYY-NNNN (Ausgang) / ER-YYYY-NNNN (Eingang)
  invoiceType       InvoiceType
  status            InvoiceStatus @default(DRAFT)
  
  // Bezug
  projectId         String?
  customerId        String?       // Bei OUTGOING: Rechnungsempfänger
  subcontractorId   String?       // Bei INCOMING: Rechnungssteller
  
  // Zeitraum
  periodFrom        DateTime?
  periodTo          DateTime?
  
  // Beträge
  subtotal          Float         @default(0)    // Netto-Summe
  taxRate           Float         @default(19)   // MwSt-Satz in %
  taxAmount         Float         @default(0)    // MwSt-Betrag
  total             Float         @default(0)    // Brutto-Summe
  
  // Teilrechnung
  isPartialInvoice  Boolean       @default(false)
  partialNumber     Int?          // 1. Abschlag, 2. Abschlag, etc.
  partialPercentage Float?        // % des Gesamtauftrags
  
  // Zahlungsziel
  paymentTermDays   Int?          // Überschreibt Kunden-Default
  issueDate         DateTime      @default(now())
  dueDate           DateTime?     // issueDate + paymentTermDays
  paidDate          DateTime?
  paidAmount        Float?        // Bei Teilzahlung
  
  // Metadaten
  notes             String?
  internalNotes     String?
  pdfPath           String?       // Pfad zur generierten PDF in MinIO
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  createdByUserId   String?
  
  // Relations
  project        Project?        @relation(fields: [projectId], references: [id])
  customer       Customer?       @relation(fields: [customerId], references: [id])
  subcontractor  Subcontractor?  @relation(fields: [subcontractorId], references: [id])
  createdBy      User?           @relation("InvoiceCreator", fields: [createdByUserId], references: [id])
  lines          InvoiceLine[]
  payments       InvoicePayment[]
}
```

### Neues Model: InvoiceLine

```prisma
model InvoiceLine {
  id              String          @id @default(cuid())
  invoiceId       String
  lineType        InvoiceLineType
  position        Int             // Reihenfolge
  description     String
  quantity        Float           @default(1)
  unit            String?         // "Std", "Stk", "m", "m²", "Pauschale", "KW"
  unitPrice       Float           @default(0)
  total           Float           @default(0)   // quantity * unitPrice
  
  // Referenz auf Stundenzettel (optional)
  weeklyTimesheetId String?
  
  invoice         Invoice         @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  weeklyTimesheet WeeklyTimesheet? @relation(fields: [weeklyTimesheetId], references: [id])
}
```

### Neues Model: InvoicePayment

```prisma
model InvoicePayment {
  id          String   @id @default(cuid())
  invoiceId   String
  amount      Float
  paidDate    DateTime
  method      String?  // "Überweisung", "Bar", etc.
  reference   String?  // Buchungsreferenz
  notes       String?
  createdAt   DateTime @default(now())
  
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
}
```

### Bestehende Models: Relations ergänzen

```prisma
// Project:
  invoices Invoice[]

// Customer:
  invoices Invoice[]

// Subcontractor:
  invoices Invoice[]

// User:
  createdInvoices Invoice[] @relation("InvoiceCreator")

// WeeklyTimesheet:
  invoiceLines InvoiceLine[]
```

---

## 2. Backend (NestJS)

### 2.1 Invoices (`/api/invoices`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/invoices` | Liste mit Filter (type, status, projectId, customerId, subcontractorId, periodFrom/To), Pagination, Sort |
| GET | `/api/invoices/:id` | Detail mit Lines + Payments |
| POST | `/api/invoices` | Neue Rechnung (manuell) |
| POST | `/api/invoices/generate-from-timesheets` | Rechnung aus genehmigten Stundenzetteln generieren |
| PATCH | `/api/invoices/:id` | Rechnung bearbeiten (nur DRAFT) |
| DELETE | `/api/invoices/:id` | Löschen (nur DRAFT) |
| POST | `/api/invoices/:id/send` | Status → SENT, dueDate berechnen |
| POST | `/api/invoices/:id/cancel` | Stornieren |
| GET | `/api/invoices/:id/pdf` | PDF generieren/herunterladen |
| POST | `/api/invoices/:id/duplicate` | Rechnung duplizieren als neuen Entwurf |

### 2.2 Invoice-Lines (`/api/invoices/:id/lines`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/invoices/:id/lines` | Alle Positionen |
| POST | `/api/invoices/:id/lines` | Position hinzufügen |
| PATCH | `/api/invoices/:id/lines/:lineId` | Position bearbeiten |
| DELETE | `/api/invoices/:id/lines/:lineId` | Position entfernen |
| POST | `/api/invoices/:id/lines/reorder` | Positionen umsortieren |

### 2.3 Payments (`/api/invoices/:id/payments`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/invoices/:id/payments` | Alle Zahlungseingänge |
| POST | `/api/invoices/:id/payments` | Zahlung erfassen |
| DELETE | `/api/invoices/:id/payments/:paymentId` | Zahlung löschen |

### 2.4 Dashboard/Statistik

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/invoices/stats` | Offene Beträge (Ausgang/Eingang), überfällige Rechnungen, Umsatz Monat/Jahr |

### 2.5 Generate-from-Timesheets Logik

```
POST /api/invoices/generate-from-timesheets
Body: { projectId, periodFrom, periodTo, invoiceType: "OUTGOING" }

1. Alle APPROVED WeeklyTimesheets im Zeitraum für das Projekt laden
2. Je nach billingMode des Projekts:
   - HOURLY_PACKAGE:
     - Pro KW eine Line: "Wochenpaket KW {n}" → weeklyPackagePrice
     - Falls Netto-Stunden > weeklyPackageHours: Überstunden-Line
       "Überstunden KW {n}: X Std × overtimeRatePerHour"
   - UNIT_BASED: Keine Auto-Generierung (manuell hinzufügen)
   - MIXED: Wochenpaket-Lines auto + Einheiten manuell
3. Subtotal, Tax, Total berechnen
4. Invoice erstellen mit Status DRAFT
5. paymentTermDays vom Kunden übernehmen (falls gesetzt)
```

### 2.6 Generate für Eingangsrechnungen (Subunternehmen)

```
POST /api/invoices/generate-from-timesheets
Body: { projectId, periodFrom, periodTo, invoiceType: "INCOMING", subcontractorId }

1. Alle APPROVED Timesheets der Monteure dieses Subs im Zeitraum laden
2. Pro Monteur + KW: Netto-Stunden × Worker.hourlyRate (oder dailyRate)
3. Lines erstellen: "Monteur {Name}, KW {n}: X Std × Y €/Std"
4. Invoice mit Bezug auf Subcontractor erstellen
```

### 2.7 PDF-Generierung

Standard-Layout (wird später durch Kundenvorlage ersetzt):
- **Header**: Firmendaten (aus Env/Config), Rechnungsnummer, Datum
- **Empfänger**: Kundenname + Adresse (OUTGOING) / Sub-Name (INCOMING)
- **Projekt-Referenz**: Projektnummer + Titel
- **Tabelle**: Pos | Beschreibung | Menge | Einheit | Einzelpreis | Gesamt
- **Summenblock**: Netto | MwSt (19%) | Brutto
- **Zahlungshinweis**: "Zahlbar innerhalb von {n} Tagen" + Bankverbindung
- **Footer**: Steuernummer, Amtsgericht, Geschäftsführer (aus Config)

---

## 3. Frontend

### 3.1 Rechnungen-Übersicht (`/invoices`)

- **Zwei Tabs**: "Ausgangsrechnungen" / "Eingangsrechnungen"
- Tabelle: Rechnungs-Nr. | Kunde/Sub | Projekt | Zeitraum | Netto | Brutto | Status | Fällig am
- Filter: Status, Projekt, Zeitraum
- Statusbadges: Entwurf (grau), Versendet (blau), Teilbezahlt (gelb), Bezahlt (grün), Storniert (rot)
- Buttons: "Neue Rechnung", "Aus Stundenzetteln generieren"
- Überfällige Rechnungen: Fälligkeitsdatum rot markiert

### 3.2 Rechnung erstellen – Dialog "Aus Stundenzetteln"

- Projekt auswählen (Dropdown)
- Zeitraum (von/bis Datum)
- Typ: Ausgangsrechnung / Eingangsrechnung
- Bei Eingang: Subunternehmen auswählen
- "Generieren" → API-Call → Weiterleitung zum Entwurf

### 3.3 Rechnungs-Detail (`/invoices/[id]`) – 3 Tabs

#### Tab 1: Positionen
- Tabelle mit Drag&Drop für Reihenfolge:
  | Pos | Beschreibung | Menge | Einheit | Einzelpreis | Gesamt |
- Inline-Edit oder Dialog für Positionen
- "Position hinzufügen" Button (Typ wählbar: Wochenpaket, Überstunden, Einheit, Frei)
- **Summenblock unten**: Netto | + MwSt {rate}% | = Brutto
- Buttons: "PDF Vorschau", "Als versendet markieren"

#### Tab 2: Zahlungen
- Tabelle: Datum | Betrag | Methode | Referenz
- "Zahlung erfassen" Dialog: Betrag, Datum, Methode (Dropdown: Überweisung, Bar, PayPal, Sonstige), Referenz
- Fortschrittsbalken: Bezahlt / Gesamt
- Wenn vollständig bezahlt → Auto-Status PAID

#### Tab 3: Details & Notizen
- Rechnungsdetails: Nummer (readonly), Typ, Status, Ausstelldatum, Fälligkeitsdatum
- Projekt-Link (anklickbar)
- Kunde/Sub-Link (anklickbar)
- Teilrechnung: Nummer + Prozentsatz
- Notizen (extern auf Rechnung) + Interne Notizen
- "Rechnung stornieren" Button (mit Bestätigung)
- "Rechnung duplizieren" Button

### 3.4 Teilrechnungen / Abschlagsrechnungen

- Beim Erstellen: Checkbox "Teilrechnung"
- Wenn ja: Nummer (1., 2., 3. Abschlag) + Prozentsatz des Gesamtauftrags
- In der Übersicht: Teilrechnungen gruppiert unter dem Projekt sichtbar
- Schlussrechnung: Zeigt bisherige Abschläge und berechnet Restbetrag

### 3.5 Sidebar erweitern

Neuer Bereich "Finanzen":
- **Rechnungen** → `/invoices`

### 3.6 Dashboard erweitern

Neue Karten:
- "Offene Ausgangsrechnungen": Anzahl + Gesamtbetrag
- "Überfällige Rechnungen": Anzahl (rot wenn > 0)

---

## 4. Seed-Daten

### 3 Ausgangsrechnungen:
1. RE-2026-0001: Projekt "Videoüberwachung Hafenterminal", KW 25, Status SENT, 2 Wochenpaket-Lines + 1 Überstunden-Line, Fällig in 14 Tagen
2. RE-2026-0002: Projekt "Elektroinstallation Neubau Süd", KW 25, Status PAID (mit Payment-Eintrag)
3. RE-2026-0003: Projekt "Hafenterminal", 1. Abschlagsrechnung (30%), Status DRAFT

### 2 Eingangsrechnungen:
1. ER-2026-0001: Von "Elektro Kovačević d.o.o.", Projekt Hafenterminal, KW 25, Status SENT
2. ER-2026-0002: Von "Baltic Power Solutions", Projekt Neubau Süd, KW 25, Status PAID

---

## 5. Business-Regeln

1. **Rechnungsnummer**: Auto-generiert RE-YYYY-NNNN (Ausgang) / ER-YYYY-NNNN (Eingang)
2. **Nur DRAFT editierbar**: Positionen, Beträge, Notizen nur im Entwurf änderbar
3. **Fälligkeitsdatum**: Automatisch berechnet aus issueDate + paymentTermDays (vom Kunden oder manuell)
4. **Summen**: Automatisch bei Positions-Änderungen neu berechnet (subtotal = Σ line.total, taxAmount = subtotal × taxRate/100, total = subtotal + taxAmount)
5. **Status-Auto-Update**: Wenn paidAmount >= total → PAID, wenn paidAmount > 0 aber < total → PARTIALLY_PAID
6. **Teilrechnungen**: Schlussrechnung subtrahiert Summe bisheriger Abschläge desselben Projekts
7. **Stornierung**: Rechnung wird auf CANCELLED gesetzt, Beträge auf 0 – keine Löschung

---

## 6. Technische Hinweise

- PDF: Bestehenden `pdfkit`-Service erweitern (oder neuen InvoicePdfService)
- Firmendaten für PDF-Header: Aus ENV-Variablen laden (COMPANY_NAME, COMPANY_ADDRESS, COMPANY_TAX_NUMBER, COMPANY_BANK_IBAN, etc.) – Defaults setzen für Dev
- Drag&Drop für Positionen: Bestehende dnd-Bibliothek oder einfache Move-Up/Down-Buttons
- Alle Beträge mit 2 Dezimalstellen formatieren (€)
- Pagination/Filter/Sort wie gehabt
- Alle Endpoints mit JwtAuthGuard (nur Admin/PM, keine Worker)

---

## 7. Ausführungsreihenfolge

1. Prisma-Schema + Migration
2. Backend: Invoices-Module (Controller, Service, DTOs), PDF-Service, Stats
3. Frontend: API-Client (`lib/invoices.ts`), Texte
4. Frontend: Seiten + Komponenten
5. Seed-Daten
6. Sidebar + Dashboard
7. Docker Build + Smoke-Test
