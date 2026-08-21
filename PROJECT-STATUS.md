# Office App – Projekt-Status

**Stand:** 21. August 2026 (Cloud-Auftrag #20 Google Calendar)  
**Repository:** github.com/vengelst/office  
**Branch:** `main`  
**Letzter Feature-Fokus:** Google Calendar Sync (Office → Google)  
**Produktion:** https://office.vivahome.de (`/opt/office` auf vivahome.de)

> Ausführliche Feature-Liste: **`STATUS.md`**  
> Session-/Backlog-Übergabe: **`claude-auftraege/offen-backlog.md`**  
> Item-Modus: **`SPEZ-arbeitsitems.md`** · Deployment: **`DEPLOYMENT.md`**

### Letzte Arbeit (21.08.2026) – Kurz

1. **Google Calendar** – `CalendarEvent`, Settings `/settings/calendar`, Termine `/calendar`, Sync Office → `primary` (Europe/Berlin)
2. Credentials = Drive-SA + Impersonation; Google Admin (Calendar API + DWD) noch manuell
3. Projekt-Timeline `/projects/calendar` unverändert

### Session davor (17.–20.08.2026)

1. **Stempel-Sicherheit** – `CUSTOMER_PL` / fremde `workerId` gesperrt (`488ad20`)
2. **Produktklarstellung** – eigene App; kein Multi-Instanz/AVV; PIN bleibt
3. **Google Contacts Settings** – UI live (`2092ef1`); produktiv erst nach People API + DWD-Scope in Google Admin

---

## Implementierte Module (produktionsreif)

| # | Modul | Beschreibung |
|---|-------|-------------|
| 1 | Projektbasis | NestJS API, Next.js Web, PostgreSQL, MinIO, Docker, JWT-Auth |
| 2 | Kundenverwaltung | CRUD, Filialen, Kontakte, Bank, OCR-Visitenkarten, Drucken, Google Contacts Sync |
| 3 | Projektverwaltung | CRUD, 7-Tab-Detail, Baustellen, Zuweisungen, Kalender/Timeline |
| 4 | Monteure / Teams / Subs | Workers, Qualifikationen, Subunternehmen, Teams |
| 5 | Zeiterfassung | PIN-Login, Clock-In/Out, Stundenzettel, PDF, Signaturen, Live-Stempeluhr, Offline-Queue |
| 6 | Abrechnungen | Ein-/Ausgangsrechnungen, Positionen, PDF, Zahlungsstatus |
| 7 | Fahrzeuge | CRUD, Zuweisungen, TÜV-/Versicherungswarnungen, Dokumente |
| 8 | Dokumente | Ordner, Versionen, Thumbnails, Kamera, Lightbox, Drive-Sync |
| 9 | Storage / Drive / E-Mail | Lesbare MinIO-Pfade, Google Drive DWD, SMTP-Config |
| 10 | Kiosk (Web) | Monteur-Stempeluhr (DE/SK/SL) **oder** Kunden-PL-Abzeichnung (`/kiosk/pl`), PIN, GPS |
| 11 | OCR | PaddleOCR-Microservice (Visitenkarten + Text) |
| 12 | Auto-Recherche | Research-Microservice (Playwright + LLM), Vorschau-Dialog |
| 13 | Equipment | Werkzeuge/Geräte, Zuordnung, Wartung, Fotos |
| 14 | Kommunikation | Historie am Kunden inkl. Spracheingabe |
| 15 | To-Dos | Prioritäten, Zuordnungen, Dashboard-Widget |
| 16 | Ausschreibungen | Submission-Suche via Research-Service |
| 17 | Einstellungen | Firmen-Stammdaten, Pausen, Storage/Drive, **Google Contacts**, **Google Calendar**, System-Status, Feature-Flags |
| 18 | Mobile Kiosk-App | Expo/Android APK (`de.vivahome.kiosk`), Download unter `/download` |
| 19 | Arbeitsitems | PDF-/Excel-Import, Büro-Tab, Monteur Web/PWA/Kiosk, Kunden-PL (Kiosk-PIN + Zustell-E-Mail) |
| 20 | Feature-Flags | Module pro Instanz freischaltbar (#18) |
| 21 | Termine / Google Calendar | CRUD `/calendar`, Sync Office → Google primary (#20) |

---

## Tech-Stack

- **Backend:** NestJS, Prisma ORM (v5.22), PostgreSQL 16, MinIO
- **Frontend Web:** Next.js 14 (App Router), shadcn/ui, Tailwind, React Hook Form + Zod
- **Frontend Mobile:** React Native / Expo SDK 53, EAS Build (lokal)
- **Auth:** JWT (User + Worker-PIN), Rollen: `SUPERADMIN`, `OFFICE`, `PROJECT_MANAGER`, `WORKER`, `CUSTOMER_PL`
- **PDF:** pdfkit · **E-Mail:** nodemailer · **Cloud:** Google Drive / People API / Calendar API
- **Neben-Services:** `ocr-service`, `research-service` (eigene Repos, Docker-Netz `vivahome`)
- **Deployment:** Production auf vivahome.de (Docker Compose + Nginx + TLS)

---

## Offene Punkte / Backlog

### Hohe Priorität

1. **Google Contacts produktiv** – People API + DWD-Scope `contacts` in Google Admin; dann Sync testen
2. **Google Calendar produktiv** – Calendar API + DWD-Scope `calendar` in Google Admin; dann Sync testen
3. **Einheitsbasierte Abrechnung** – `billingMode: UNIT_BASED` existiert; Abrechnung aus geprüften Arbeitsitems noch nicht verdrahtet

### Erledigt / bewusst nicht (Auswahl)

- ~~Time-Entries-Rollen~~ – 17.08.2026  
- ~~Contacts-Einstellungen-UI~~ – 17.08.2026 (`/settings/contacts`) – Google Admin noch offen  
- ~~Google Calendar App-Seite~~ – 21.08.2026 (`/settings/calendar`, `/calendar`) – Google Admin noch offen; kein Bidirektional  
- ~~Managed Install / AVV~~ – nicht geplant  
- PIN-Login bleibt  
- Stempel-PIN sichtbar · Kiosk DE/SK/SL · Indexes / Feature-Flags / Splits (#18–#19)

### Mittlere Priorität

- Mobile Push / Biometrie / Branding · Reporting/Charts
- **DATEV-Export** – geplant, noch nicht implementiert
- **Rechnungsvorlage** – eigene PDF-Vorlage hochladen
- **Große Dateien aufteilen** – u. a. `invoices.service.ts`, `contacts-tab.tsx`, `timesheets/[id]/page.tsx`

### Niedrige Priorität / bewusst zurückgestellt

- **Mahnwesen** – bewusst kein Mahnwesen
- **Fahrtenbuch / Tankkosten / Schäden** – Fahrzeug-Erweiterungen später
- **Nacht-/Wochenend-Zuschläge** – bewusst keine Zuschläge
- Kunden-PL-Kiosk i18n · Mobile Locale + SL · UX-Hinweis bei zukünftiger Zuweisung
- Bidirektionaler Calendar-Sync / Multi-User-Kalender

---

## Datenbank (Prisma-Migrationen)

```
prisma/migrations/
├── 20260629085329_init
├── 20260630081922_add_projects_module
├── 20260630120000_add_customer_module
├── 20260630200608_add_workers_module
├── 20260630212811_add_timesheets_module
├── 20260630220641_add_invoices_module
├── 20260630223422_extend_vehicles
├── 20260630225651_improve_documents
├── 20260701192000_add_drive_fields
├── 20260710123000_add_app_settings
├── 20260711064500_add_google_contact_id
├── 20260711091500_add_performance_indexes
├── 20260711133500_add_subcontractor_type
├── 20260711140000_add_sync_to_google
├── 20260711160000_add_submissions
├── 20260711163000_add_equipment
├── 20260711170000_add_communication_entries
├── 20260711173000_add_todos
├── 20260807040000_work_items_fundament
├── 20260807040100_seed_role_customer_pl
├── 20260808140000_add_work_card_template
├── 20260809100000_add_user_pin
├── 20260809120000_add_customer_pl_notification_email
├── 20260809190000_add_time_entry_client_event_id
└── 20260821180000_add_calendar_events
```

---

## Deployment (Produktion)

```bash
cd /opt/office && git pull && \
  docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

| Dienst | Port (Host) |
|---|---|
| Web | `127.0.0.1:5700` |
| API | `127.0.0.1:5701` |
| MinIO API / Console | `127.0.0.1:5702` / `5703` |
| OCR | `127.0.0.1:5800` |

Nginx: `office.vivahome.de` → Web/API, `minio.office.vivahome.de` → MinIO Console.

---

## Konfiguration (Docker Dev)

```
API:      localhost:3901  (Container intern 3801)
Web:      localhost:3900  (Container intern 3800)
Postgres: localhost:5433
MinIO:    localhost:9002 (API), 9003 (Console)
```

**Admin-Login (Seed):** admin@office.local / admin123  
Siehe auch `README.md` für Office-/PL-Accounts und PIN-Login.

---

## Aufträge (`claude-auftraege/`)

```
claude-fundament.md … claude-documents.md, drive-ordnerstruktur.md
claude-arbeitsitems-01 … 15 – erledigt (u. a. Offline, Sub-Kontakte, Druck/Backup)
claude-arbeitsitems-16 … 19 – Perf, JSDoc, Indexes/Flags, Docs-Pagination
offen-backlog.md – PIN bleibt; kein Multi-Instanz; Feature-Lücken siehe PROJECT-STATUS
```

---

## Workflow

- **Kleine Fixes:** Cursor direkt → commit/push → Server-Deploy
- **Große Features:** Spec in `claude-auftraege/`, dann Cloud-Auftrag
- Testen immer auf dem Server, nicht lokal mit Produktiv-Docker
