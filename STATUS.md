# Office App – Projektstatus

**Stand:** 20. August 2026  
**Server:** office.vivahome.de (109.199.112.176)  
**Technologie:** Next.js 14 (Frontend) + NestJS (Backend) + PostgreSQL + MinIO + Docker  
**Repository:** github.com/vengelst/office  
**Server-Pfad:** `/opt/office`  
**Kurzstatus / Session-Übergabe:** `PROJECT-STATUS.md` und `claude-auftraege/offen-backlog.md`

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
│   │       ├── research/         # Auto-Recherche Proxy (→ research-service)
│   │       ├── equipment/        # Werkzeug- & Gerätemanagement
│   │       ├── communications/   # Kommunikationshistorie
│   │       ├── todos/            # To-Do-System
│   │       ├── submissions/      # Ausschreibungs-Modul
│   │       ├── app-settings/     # Firmen-Stammdaten
│   │       ├── break-rules/      # Pausenregelungen
│   │       ├── dashboard/        # Dashboard-Statistiken
│   │       ├── system-status/    # Server-Status-Dashboard
│   │       └── common/           # Shared Utilities (Storage-Pfade, Slugs)
│   ├── web/          # Next.js Frontend (Port 3800)
│   │   └── src/
│   │       ├── app/              # Seiten (App Router)
│   │       │   ├── (authenticated)/  # Geschützte Bereiche
│   │       │   ├── download/     # APK-Download-Seite
│   │       │   ├── kiosk/        # Kiosk-Modus (Web)
│   │       │   └── worker-app/   # Monteur-Web-Dashboard
│   │       ├── components/       # UI-Komponenten
│   │       └── lib/              # API-Clients, Typen, Utilities
│   └── mobile/       # React Native / Expo App (Android)
│       ├── app/                  # Expo Router Screens
│       │   ├── (auth)/login.tsx  # PIN-Login
│       │   └── (app)/index.tsx   # Zeiterfassungs-Dashboard
│       ├── lib/                  # API-Client, Auth-Context, GPS, Utils
│       ├── assets/               # App-Icons, Splash
│       └── eas.json              # EAS Build-Konfiguration
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
- **Stundenzettel** pro Mitarbeiter/Woche (Einreichen → Abzeichnung → PDF)
- **Digitale Signaturen** (WORKER / SUPERVISOR / MANAGER / CUSTOMER)
- **Zeiteinträge** mit Start-/Endzeit, Projekt, Baustelle
- **Baustellenfotos** bei Zeiterfassung (automatisch dem Projekt zugeordnet)
- **PDF-Export** + Ablage am Projekt; nach Kunden-PL-Approve zusätzlich **E-Mail mit PDF-Anhang**
- **Kiosk Monteur** (`/kiosk/terminal`) – Tablet-Zeiterfassung / Items mit Worker-PIN; UI DE / SK / SL
- **Kiosk Kunden-PL** (`/kiosk/pl`) – PIN → eingereichte Wochenzettel sehen, unterschreiben & abzeichnen; Item-Board
- **Worker-App** (`/worker-app`) – Monteur-Dashboard mit eigenen Zeiten; Offline-Stempel-Queue
- **Live-Stempeluhr** (`/time-clock/live`) – Echtzeit-Anzeige aller aktiven Monteure
- **Stempel-Rechte** – nur eigene Worker-ID bzw. Office/PM/SUPERADMIN (kein `CUSTOMER_PL`)

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

### 12. Werkzeug- & Gerätemanagement (`/equipment`)
- **CRUD** für Werkzeuge und Geräte (Inventarnummer, Seriennummer, Kategorie)
- **Zuordnung** zu Monteuren und Projekten
- **Wartungsintervalle** und Prüftermine
- **Foto-Upload** für Geräte
- **Statustracking**: Verfügbar, Im Einsatz, In Wartung, Defekt

### 13. Kommunikationshistorie
- **Kommunikationseinträge** pro Kunde (Telefonat, E-Mail, Besuch, Meeting, Sonstiges)
- **Spracheingabe/Diktat** – Text per Mikrofon diktieren (Web Speech API)
- **Zuordnung** zu Ansprechpartnern
- **Chronologische Ansicht** auf der Kunden-Detailseite

### 14. To-Do-System (`/todos`)
- **CRUD** für To-Dos mit Priorität (Niedrig, Mittel, Hoch, Dringend)
- **Zuordnung** zu Kunden, Projekten, Monteuren
- **Fälligkeitsdaten** und Statusmanagement
- **Dashboard-Widget** mit offenen To-Dos

### 15. Ausschreibungs-Modul (`/submissions` / Submissions)
- **Ausschreibungssuche** via Auto-Recherche
- **Kontaktpersonensuche** via Website-URL

### 16. Google Maps Satellitenvorschau
- **Eingebettete Kartenansicht** bei Kunden, Projekten und Subunternehmen
- **Satellitenansicht** mit Marker auf der Adresse

### 17. Auto-Recherche (Research-Microservice)
- **Separater Python/FastAPI Microservice** mit Playwright-Crawling
- **LLM-gestützte Extraktion** von Firmendaten aus Websites
- **Vorschau-Dialog** mit selektiver Übernahme der extrahierten Daten
- **Proxy** im NestJS-Backend (`/research`)
- ⚠️ **Repository:** Ausgelagert in eigenes Repository (`address_pull`)

### 18. Einstellungen (`/settings`)
- **Struktur**: Pausenregeln, E-Mail, Storage, Cloud und System unter einem Settings-Menüpunkt
- **Firmen-Stammdaten** (`/settings/company`) – Logo, Adresse, Steuernummer, Kontaktdaten
- **Server-Status Dashboard** (`/settings/system`) – System-, DB-, Storage- und Service-Metriken, OS-Updates, Docker-Speicher, Host-Prozesse via SSH

### 19. Monteur-Kiosk-App (Android – `apps/mobile`)
- **React Native / Expo** – Native Android-App (kein iOS)
- **PIN-Login** – 6-stellige PIN-Eingabe mit haptischem Feedback
- **Zeiterfassungs-Dashboard** – Clock-In/Out, Live-Timer, Projektauswahl
- **GPS-Tracking** – Standort wird bei Stempeln mitgesendet
- **Foto-Upload** – Baustellenfotos mit Kommentaren
- **Tagesübersicht** – Liste aller Zeiteinträge des Tages
- **APK-Download** – Verfügbar unter `office.vivahome.de/download`
- **Build**: Lokal mit EAS CLI (`eas build --platform android --profile preview --local`)
- **Paket**: `de.vivahome.kiosk` (kiosk.apk, ~118 MB)

### 20. Arbeitsitems – Monteur-Oberfläche im Web + PWA
- **Feature-Parität zur APK** (SPEZ-arbeitsitems.md §13): Liste (aktuelles Item,
  eigene, offener Pool, Suche nach Kennung), Detail (Metadaten, Umfang DE+SK,
  Material DE+SK optional), Nehmen, Item-Zeit start/stop, Block-PDF, Fertig (≥2 Fotos),
  Nacharbeit – alles mit denselben Monteur-Endpunkten (Worker-Token)
- **Zwei Einstiege, eine Implementierung**: `/worker-app/work-items` (persönliches
  Gerät, auch iPhone/iPad) und `/kiosk` (Tablet, festes Projekt) nutzen die
  gemeinsamen Komponenten unter `apps/web/src/components/worker-work-items/`
- **Einstieg nur** wenn eingestempelt **und** Projekt im Item-Modus (`itemBased`)
- **PWA**: `manifest.webmanifest` + Icons + Apple-Meta, schlanker Service Worker
  (nur Build-Assets, kein Offline für API); Installation über Safari
  („Zum Home-Bildschirm“) bzw. Chrome („App installieren“)
- **`/download`**: APK für Android, PWA-Anleitung für iPhone/iPad
- **PDF-Primärimport + Templates/OCR (08.08.2026):** Mehrseiten-PDF → Vorschau →
  Commit (1 Seite = 1 Order); optional Kartentyp-Template mit OCR-Extraktion
  (Kennung/Arbeitsinhalt); Excel nur Fallback; Material optional
  (`SPEZ-arbeitsitems.md` §10). Zone-Editor / LLM-Fallback noch offen

### 21. Kunden-PL – Kiosk-Abzeichnung + Zustell-E-Mail (09.08.2026)
- **Kein Office-App-Zugang nötig** – Abzeichnung primär am Kiosk
- **UserPin** (6-stellig), global eindeutig vs. Worker-PIN; setzen unter Projekt → Arbeitsitems → Kunden-PL
- **Kiosk-Setup:** Modus Monteur | Kunden-PL → `/kiosk/pl`
- Flow: PIN → SUBMITTED-Zettel → Stundenliste → SignatureCanvas → `sign(CUSTOMER)` + `approve`
- **Zustell-E-Mail** (`notificationEmail` an `ProjectCustomerPlAssignment`, sonst Fallback Login-E-Mail)
- Nach Approve: PDF speichern **und** Mail mit Anhang (SMTP unter Einstellungen → E-Mail)
- Aufträge: `#9` Kiosk-PIN, `#10` Zustell-E-Mail (`claude-auftraege/claude-arbeitsitems-09/10-*.md`)

---

## Offene Aufgaben

### Priorität (siehe `offen-backlog.md` / `PROJECT-STATUS.md`)
1. **Google Contacts produktiv schalten** – Einstellungen → Google Contacts; People API + DWD-Scope `contacts` in Google Admin; dann Sync aktivieren und testen
2. **Google Calendar produktiv schalten** – Einstellungen → Google Calendar; Calendar API + DWD-Scope `calendar` in Google Admin; dann Sync aktivieren und testen
3. **UNIT_BASED Abrechnung** – aus geprüften Arbeitsitems verdrahten

PIN-Login bleibt (Monteur + Kunden-PL). Managed Multi-Instanz / AVV: **nicht geplant** (eigene App). Google Calendar: App fertig (Office → Google, primary); Bidirektional bewusst nicht.

### ⚠️ Google People API aktivieren
1. Google Cloud Console → Projekt "Vivahome Office" → People API aktivieren
2. Google Admin Console → Sicherheit → API-Steuerung → DWD → Scope `https://www.googleapis.com/auth/contacts` hinzufügen für Service Account `office-drive-sync@vivahome-office.iam.gserviceaccount.com`

### ⚠️ Google Calendar API aktivieren
1. Google Cloud Console → Google Calendar API aktivieren
2. Google Admin Console → DWD → Scope `https://www.googleapis.com/auth/calendar` für denselben Service Account
3. Office: Einstellungen → Google Calendar → Sync an → Verbindungstest; Termine unter `/calendar`

### Mobile App – Nächste Schritte
- **Push-Notifications** – z.B. für Erinnerungen, Projektänderungen
- **Biometrische Authentifizierung** (optional, Fingerprint)
- **App-Branding** – Eigenes Icon/Splash statt Platzhalter
- ~~**APK dauerhaft verfügbar machen**~~ – erledigt: Bind-Mount `/opt/office/data/kiosk.apk` → Web-Container `public/kiosk.apk`

### Dateien die aufgeteilt werden sollten
| Datei | Empfehlung |
|---|---|
| `invoices.service.ts` | PDF-Logik, Berechnungen, CRUD trennen |
| `contacts-tab.tsx` | Scan-Logik, Formular, AuthImage auslagern |
| `timesheets/[id]/page.tsx` | Formular-Komponenten extrahieren |

### Erledigt 17.08.2026 – Stempel-API-Rollen
- Stempel-Endpoints (`clock-in/out`, Status, Foto) nur für `WORKER` (eigene ID) sowie `SUPERADMIN` / `OFFICE` / `PROJECT_MANAGER`
- `CUSTOMER_PL` und andere User-Rollen können keine fremde `workerId` mehr stempeln

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
| `office-minio` | MinIO Object Storage | 127.0.0.1:5702 (API), 5703 (Console) |
| `ocr-service` | PaddleOCR Microservice | 127.0.0.1:5800 |
| `research-service` | Auto-Recherche (Python/FastAPI) | intern (separates Repo) |

### Netzwerk
- Shared Docker Network: `vivahome` (external) – für Kommunikation zwischen office-api, ocr-service und research-service
- Nginx Reverse Proxy auf dem Host für HTTPS-Terminierung

### APK-Deployment
Die `kiosk.apk` ist **nicht** im Docker-Image enthalten (zu groß). Persistenz über Bind-Mount in `docker-compose.prod.yml`:

```
/opt/office/data/kiosk.apk  →  /app/apps/web/public/kiosk.apk (ro)
```

Neue APK nach lokalem EAS-Build:
```bash
scp apps/mobile/kiosk.apk root@vivahome.de:/opt/office/data/kiosk.apk
# Container neu starten nur nötig, wenn die Datei vorher fehlte (Mount-Typ):
# docker compose -f docker-compose.prod.yml --env-file .env.production up -d web
```

**Wichtig:** Die Host-Datei muss **vor** dem ersten `up` existieren – sonst erzeugt Docker ein Verzeichnis statt einer Datei.

---

## Technische Details

### Authentifizierung
- JWT-basiert mit Access-Token (8h Gültigkeit)
- Rollen: `SUPERADMIN`, `OFFICE`, `PROJECT_MANAGER`, `WORKER`, `CUSTOMER_PL`
- Stempel-API: Worker nur eigene `workerId`; Office/PM/SUPERADMIN dürfen für Monteure stempeln; `CUSTOMER_PL` ausgeschlossen
- Kiosk-Modus: PIN-basierte Authentifizierung für Monteure (Web + Native App) und Kunden-PL (`UserPin`)

### Datenbank
- PostgreSQL mit Prisma ORM (v5.22.0)
- Migrationen in `prisma/migrations/`
- Seed-Daten in `prisma/seed.ts`

### Storage
- **MinIO** – Primärer Dokumentenspeicher (S3-kompatibel)
- **Google Drive** – Sekundärer Sync (automatisch, async, non-blocking)
- Lesbare Pfade: `kunden/firma-K0001/vertraege/Vertrag_2026.pdf`

### Frontend (Web)
- Next.js 14 mit App Router
- Tailwind CSS + shadcn/ui Komponenten
- Responsive Design (Desktop + Tablet)

### Frontend (Mobile)
- React Native mit Expo SDK 53
- Expo Router (File-based Routing)
- expo-secure-store (Token-Speicher), expo-location (GPS), expo-image-picker (Fotos), expo-haptics
- Build: EAS CLI lokal (`--local`), APK-Output → `apps/mobile/kiosk.apk`
- API-URL: `https://office-api.vivahome.de/api` (in `eas.json` konfiguriert)

---

## Änderungshistorie (Chronologisch)

### Phase 1 – Basis (bis ~8. Juli 2026)
1. **Dokumentensystem v2** – Ordner, Versionen, Ablaufwarnungen, Grid/List-Ansicht
2. **Drive Hauptordner** – Automatische Erstellung der 5 Hauptkategorien
3. **Domain-Wide Delegation** – Google Drive Uploads über Impersonation
4. **OCR Visitenkarten-Scanner** – Visitenkarte fotografieren → Kontaktdaten werden extrahiert
5. **PaddleOCR Microservice** – Selbstgehosteter OCR-Service statt Google Cloud Vision
6. **Visitenkarte am Kontakt** – Bild wird auf der Kontaktkarte angezeigt mit Lightbox
7. **Visitenkarten-Tab** – Eigener Tab für Visitenkarten (nicht unter Dokumente)
8. **CONTACT → Kunden-Ordner** – Visitenkarten von Kontakten landen im Kundenordner in Drive
9. **Drucken-Dropdown** – "Aktuelle Ansicht" oder "Gesamtübersicht" drucken
10. **Google Contacts Sync** – Ansprechpartner werden in Google Contacts synchronisiert

### Phase 2 – Erweiterungen (9.–10. Juli 2026)
11. **syncToGoogle Toggle** – Checkbox bei Kontakten, ob in Google Contacts sync
12. **Auto-Recherche Microservice** – Playwright + LLM für Firmen-Recherche via Website
13. **Research-Integration** – Vorschau-Dialog mit selektiver Datenübernahme
14. **Firmen-Stammdaten** – Company-Info-Seite unter Einstellungen (Logo, Adresse, Steuernummer)
15. **Nationalität-Dropdown** – Vorschläge aus bisherigen Einträgen bei Monteur-Formular
16. **Security-Härtung** – JWT-Prüfung, Session-Validierung, Rate-Limiting, API-Key-Guard
17. **JSDoc-Dokumentation** – Alle Services, Controller und Frontend-Komponenten dokumentiert

### Phase 3 – Neue Module (10.–11. Juli 2026)
18. **Google Maps Satellitenvorschau** – Bei Kunden, Projekten, Subunternehmen
19. **Ausschreibungs-Modul** – Submission-Suche und Kontaktpersonensuche via URL
20. **Werkzeug- & Gerätemanagement** – CRUD, Zuordnung, Wartung, Fotos
21. **Kommunikationshistorie** – Einträge mit Spracheingabe/Diktat (Web Speech API)
22. **To-Do-System** – CRUD mit Prioritäten, Zuordnungen, Dashboard-Widget

### Phase 4 – Server & Mobile (11.–13. Juli 2026)
23. **Server-Status Dashboard** – System-, DB-, Storage-Metriken, OS-Updates, Docker-Speicher, Host-Prozesse via SSH
24. **Monteur-Kiosk-App (Phase 1)** – Expo-Projekt, PIN-Login (React Native / Android)
25. **Monteur-Kiosk-App (Phase 2)** – Vollständiges Dashboard: Clock-In/Out, Live-Timer, GPS, Projektauswahl, Foto-Upload, Tagesübersicht
26. **APK-Build** – Lokaler Build mit EAS CLI, APK auf Server deployed
27. **Download-Seite** – `office.vivahome.de/download` mit Installationsanleitung und QR-Code
28. **Diverse Bugfixes** – Dialog-Close bei Select-Dropdowns, Kommunikation-Payload null-Werte, TS-Compiler-Fehler
