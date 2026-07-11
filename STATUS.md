# Office App – Projektstatus

**Stand:** 11. Juli 2026  
**Server:** office.vivahome.de  
**Technologie:** Next.js 14 (Frontend) + NestJS (Backend) + PostgreSQL + MinIO + Docker  
**Repository:** github.com/vengelst/office

---

## Architektur

```
office/
├── apps/
│   ├── api/          # NestJS Backend (Port 3801)
│   │   └── src/
│   │       ├── auth/             # JWT-Authentifizierung + Login
│   │       ├── customers/        # Kundenverwaltung (CRUD, Kontakte, Filialen, E-Mails, Bank)
│   │       ├── projects/         # Projektverwaltung (CRUD, Baustellen, Zuweisungen)
│   │       ├── workers/          # Monteurverwaltung (CRUD, Qualifikationen, Dokumente)
│   │       ├── vehicles/         # Fahrzeugverwaltung
│   │       ├── subcontractors/   # Subunternehmen
│   │       ├── teams/            # Teamverwaltung
│   │       ├── invoices/         # Rechnungen (ein-/ausgehend, PDF-Export)
│   │       ├── timesheets/       # Stundenzettel (Wochen-Übersicht, PDF-Export)
│   │       ├── time-entries/     # Zeiteinträge (Stempeln, Baustellenfotos)
│   │       ├── documents/        # Dokumentensystem (Upload, Versionen, Ordner)
│   │       ├── google-drive/     # Google Drive Sync + Google Contacts Sync
│   │       ├── ocr/              # OCR-Anbindung (PaddleOCR Microservice)
│   │       ├── break-rules/      # Pausenregelungen
│   │       ├── dashboard/        # Dashboard-Statistiken
│   │       └── common/           # Shared Utilities (Storage-Pfade, Slugs)
│   └── web/          # Next.js Frontend (Port 3800)
│       └── src/
│           ├── app/              # Seiten (App Router)
│           ├── components/       # UI-Komponenten
│           └── lib/              # API-Clients, Typen, Utilities
├── prisma/           # Datenbankschema + Migrationen
├── docker/           # Dockerfiles für Produktion
└── packages/
    └── types/        # Geteilte TypeScript-Typen
```

---

## Module & Features

### 1. Kundenverwaltung (`/customers`)
- **CRUD** für Kunden mit Kundennummer (K-YYYY-NNNN)
- **Ansprechpartner** mit Visitenkarten-Scan (OCR), Formular, Inline-Bearbeitung
- **Niederlassungen** (Filialen) mit Adressdaten
- **E-Mail-Adressen** (mehrere pro Kunde, primäre markierbar)
- **Bankverbindungen** (max. 2 pro Kunde)
- **Visitenkarten-Tab** – eigener Bereich für gescannte Visitenkarten (Galerie + Lightbox)
- **Dokumente-Tab** – Universelle Dokumentenverwaltung (ohne Visitenkarten)
- **Drucken** – Dropdown mit "Aktuelle Ansicht" oder "Gesamtübersicht" (alle Daten auf einer Seite)
- **Google Contacts Sync** – Ansprechpartner werden automatisch in Google Contacts angelegt/aktualisiert/gelöscht (via People API + DWD) ⚠️ **Noch nicht aktiviert** – People API + DWD-Scope müssen in Google Admin eingerichtet werden

### 2. Projektverwaltung (`/projects`)
- **CRUD** für Projekte mit Projektnummer (P-YYYY-NNNN)
- **7-Tab Detailansicht**: Stammdaten, Baustellen, Zuweisungen, Zeitplan, Zeiteinträge, Rechnungen, Dokumente
- **Baustellen** mit Adressen und Geo-Daten
- **Mitarbeiter-Zuweisungen** (Monteure zu Projekten)
- **Projektkalender** – Monats-/Wochenansicht

### 3. Monteurverwaltung (`/workers`)
- **CRUD** für Monteure mit Mitarbeiternummer
- **Qualifikationen** und Zertifikate mit Ablaufdaten
- **Dokumentenverwaltung** (Ausweise, Führerscheine, Arbeitsgenehmigungen)
- **Verfügbarkeit** und Teamzuordnung

### 4. Fahrzeugverwaltung (`/vehicles`)
- **CRUD** für Firmenfahrzeuge (Kennzeichen, Marke, Modell)
- **Zuordnung** zu Monteuren
- **Ablaufwarnungen** (TÜV, Versicherung)
- **Dokumentenverwaltung** (Fahrzeugschein, Versicherungspolice)

### 5. Subunternehmen (`/subcontractors`)
- **CRUD** für Subunternehmen
- **Kontaktdaten** und Dokumentenverwaltung

### 6. Teamverwaltung (`/teams`)
- **CRUD** für Teams
- **Teamleiter-Zuordnung** und Mitgliederverwaltung

### 7. Rechnungswesen (`/invoices`)
- **Eingangs- und Ausgangsrechnungen**
- **Positionseditor** mit Drag&Drop-Sortierung
- **PDF-Export** (automatisch generiert)
- **Zahlungsverwaltung** (Teilzahlungen, Statustracking)
- **Statusmanagement**: Entwurf → Gesendet → Bezahlt → Storniert

### 8. Zeiterfassung (`/timesheets`, `/time-entries`)
- **Stundenzettel** pro Mitarbeiter/Woche
- **Zeiteinträge** mit Start-/Endzeit, Projekt, Baustelle
- **Baustellenfotos** bei Zeiterfassung (automatisch dem Projekt zugeordnet)
- **PDF-Export** für Stundenzettel
- **Kiosk-Modus** (`/kiosk/terminal`) – Tablet-Zeiterfassung auf der Baustelle mit PIN
- **Worker-App** (`/worker-app`) – Monteur-Dashboard mit eigenen Zeiten

### 9. Dokumentensystem (`/documents`)
- **Universelle Dokumentenverwaltung** für alle Entitäten
- **Ordner** – Logische Gliederung pro Entität
- **Versionierung** – Dokumente können ersetzt werden (Historie bleibt)
- **Ablaufwarnungen** – Dokumente mit Ablaufdatum
- **Thumbnails** – Automatische Vorschaubilder für Bilder
- **Grid/Listen-Ansicht** + Suche + Drag&Drop-Upload
- **Kamera-Aufnahme** direkt aus der App
- **Lightbox** – Vollbild-Vorschau für Bilder

### 10. OCR-System
- **Selbstgehosteter PaddleOCR Microservice** (`ocr-service` Container, Port 8000)
- **Visitenkarten-Erkennung** – Extrahiert Name, Firma, Telefon, E-Mail, Adresse
- **Allgemeiner Text-OCR** – `/ocr/text` Endpoint für beliebige Bilder
- **Anbindung** über Docker-Netzwerk (`vivahome` external network)

### 11. Google Drive Sync
- **Automatische Synchronisierung** von Dokumenten nach Google Drive
- **Ordnerstruktur**: `Kunden / {Firma [K-Nr]} / {Dokumenttyp} / {Datei}`
- **Hauptordner**: Kunden, Projekte, Monteure, Fahrzeuge, Subunternehmen
- **Domain-Wide Delegation** mit Impersonation (vivahome@vivahome.de)
- **CONTACT-Uploads** werden korrekt dem übergeordneten Kunden zugeordnet

---

## Offene Aufgaben

### ⚠️ Google People API aktivieren
1. Google Cloud Console → Projekt "Vivahome Office" → People API aktivieren
2. Google Admin Console → Sicherheit → API-Steuerung → DWD → Scope `https://www.googleapis.com/auth/contacts` hinzufügen für Service Account `office-drive-sync@vivahome-office.iam.gserviceaccount.com`

### Dateien die aufgeteilt werden sollten
| Datei | Zeilen | Empfehlung |
|---|---|---|
| `invoices.service.ts` | 1163 | PDF-Logik, Berechnungen, CRUD trennen |
| `contacts-tab.tsx` | 1063 | Scan-Logik, Formular, AuthImage auslagern |
| `timesheets/[id]/page.tsx` | 810 | Formular-Komponenten extrahieren |

---

## Deployment

### Server
- **Host:** vivahome.de (root-Zugang via SSH)
- **Pfad:** `/opt/office`
- **URL:** https://office.vivahome.de

### Deployment-Befehl
```bash
cd /opt/office && git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```
**WICHTIG:** Immer `--env-file .env.production` verwenden, sonst sind die Umgebungsvariablen leer!

### Docker-Container
| Container | Beschreibung | Port |
|---|---|---|
| `office-api` | NestJS Backend | 127.0.0.1:5701 |
| `office-web` | Next.js Frontend | 127.0.0.1:5700 |
| `office-postgres` | PostgreSQL Datenbank | intern |
| `office-minio` | MinIO Object Storage | intern |
| `ocr-service` | PaddleOCR Microservice | 127.0.0.1:5800 |

### Netzwerk
- Shared Docker Network: `vivahome` (external) – für Kommunikation zwischen office-api und ocr-service
- Nginx Reverse Proxy auf dem Host für HTTPS-Terminierung

---

## Technische Details

### Authentifizierung
- JWT-basiert mit Access-Token (8h Gültigkeit)
- Rollen: SUPERADMIN, ADMIN, USER
- Kiosk-Modus: PIN-basierte Authentifizierung für Monteure

### Datenbank
- PostgreSQL mit Prisma ORM (v5.22.0)
- Migrationen in `prisma/migrations/`
- Seed-Daten in `prisma/seed.ts`

### Storage
- **MinIO** – Primärer Dokumentenspeicher (S3-kompatibel)
- **Google Drive** – Sekundärer Sync (automatisch, async, non-blocking)
- Lesbare Pfade: `kunden/firma-K0001/vertraege/Vertrag_2026.pdf`

### Frontend
- Next.js 14 mit App Router
- Tailwind CSS + shadcn/ui Komponenten
- Responsive Design (Desktop + Tablet)

---

## Letzte Änderungen (Chronologisch)

1. **Google Contacts Sync** – Ansprechpartner werden in Google Contacts synchronisiert
2. **Drucken-Dropdown** – "Aktuelle Ansicht" oder "Gesamtübersicht" drucken
3. **CONTACT → Kunden-Ordner** – Visitenkarten von Kontakten landen im Kundenordner in Drive
4. **Visitenkarten-Tab** – Eigener Tab für Visitenkarten (nicht unter Dokumente)
5. **Visitenkarte am Kontakt** – Bild wird auf der Kontaktkarte angezeigt mit Lightbox
6. **PaddleOCR Microservice** – Selbstgehosteter OCR-Service statt Google Cloud Vision
7. **OCR Visitenkarten-Scanner** – Visitenkarte fotografieren → Kontaktdaten werden extrahiert
8. **Domain-Wide Delegation** – Google Drive Uploads über Impersonation
9. **Drive Hauptordner** – Automatische Erstellung der 5 Hauptkategorien
10. **Dokumentensystem v2** – Ordner, Versionen, Ablaufwarnungen, Grid/List-Ansicht
