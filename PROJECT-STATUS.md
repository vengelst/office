# Office App – Projekt-Status

**Stand:** 09. August 2026  
**Repository:** github.com/vengelst/office  
**Branch:** `main`  
**Letzter Commit:** `d6d5d4c` – Kunden-PL Zustell-E-Mail / Stundenzettel-PDF-Versand  
**Produktion:** https://office.vivahome.de (`/opt/office` auf vivahome.de)

> Ausführliche Feature-Liste und Architektur: **`STATUS.md`**  
> Item-Modus-Spezifikation: **`SPEZ-arbeitsitems.md`**  
> Deployment: **`DEPLOYMENT.md`**

---

## Implementierte Module (produktionsreif)

| # | Modul | Beschreibung |
|---|-------|-------------|
| 1 | Projektbasis | NestJS API, Next.js Web, PostgreSQL, MinIO, Docker, JWT-Auth |
| 2 | Kundenverwaltung | CRUD, Filialen, Kontakte, Bank, OCR-Visitenkarten, Drucken, Google Contacts Sync |
| 3 | Projektverwaltung | CRUD, 7-Tab-Detail, Baustellen, Zuweisungen, Kalender |
| 4 | Monteure / Teams / Subs | Workers, Qualifikationen, Subunternehmen, Teams |
| 5 | Zeiterfassung | PIN-Login, Clock-In/Out, Stundenzettel, PDF, Signaturen, Live-Stempeluhr |
| 6 | Abrechnungen | Ein-/Ausgangsrechnungen, Positionen, PDF, Zahlungsstatus |
| 7 | Fahrzeuge | CRUD, Zuweisungen, TÜV-/Versicherungswarnungen, Dokumente |
| 8 | Dokumente | Ordner, Versionen, Thumbnails, Kamera, Lightbox, Drive-Sync |
| 9 | Storage / Drive / E-Mail | Lesbare MinIO-Pfade, Google Drive DWD, SMTP-Config |
| 10 | Kiosk (Web) | Monteur-Stempeluhr **oder** Kunden-PL-Abzeichnung (`/kiosk/pl`), PIN, GPS |
| 11 | OCR | PaddleOCR-Microservice (Visitenkarten + Text) |
| 12 | Auto-Recherche | Research-Microservice (Playwright + LLM), Vorschau-Dialog |
| 13 | Equipment | Werkzeuge/Geräte, Zuordnung, Wartung, Fotos |
| 14 | Kommunikation | Historie am Kunden inkl. Spracheingabe |
| 15 | To-Dos | Prioritäten, Zuordnungen, Dashboard-Widget |
| 16 | Ausschreibungen | Submission-Suche via Research-Service |
| 17 | Einstellungen | Firmen-Stammdaten, Pausen, Storage, Cloud, System-Status |
| 18 | Mobile Kiosk-App | Expo/Android APK (`de.vivahome.kiosk`), Download unter `/download` |
| 19 | Arbeitsitems | PDF-/Excel-Import, Büro-Tab, Monteur Web/PWA/Kiosk, Kunden-PL (Kiosk-PIN + Zustell-E-Mail) |

---

## Tech-Stack

- **Backend:** NestJS, Prisma ORM (v5.22), PostgreSQL 16, MinIO
- **Frontend Web:** Next.js 14 (App Router), shadcn/ui, Tailwind, React Hook Form + Zod
- **Frontend Mobile:** React Native / Expo SDK 53, EAS Build (lokal)
- **Auth:** JWT (User + Worker-PIN), Rollen inkl. `CUSTOMER_PL`
- **PDF:** pdfkit · **E-Mail:** nodemailer · **Cloud:** Google Drive / People API
- **Neben-Services:** `ocr-service`, `research-service` (eigene Repos, Docker-Netz `vivahome`)
- **Deployment:** Production auf vivahome.de (Docker Compose + Nginx + TLS)

---

## Offene Punkte / Backlog

### Hohe Priorität

1. **Google People API aktivieren** – People API + DWD-Scope `contacts` für Service Account (Contacts-Sync noch nicht produktiv)
2. ~~**APK persistent machen**~~ – Bind-Mount `/opt/office/data/kiosk.apk` → Web `public/kiosk.apk`
3. **PDF-Import Feinschliff** – Minimal-Modus + Templates/OCR live; optional Zone-Editor, Progress bei sehr großen PDFs
4. **Einheitsbasierte Abrechnung** – `billingMode: UNIT_BASED` existiert; Abrechnung aus geprüften Arbeitsitems noch nicht verdrahtet
5. **Kunden-PL Kiosk Item-Board** – Spec: `claude-auftraege/claude-arbeitsitems-11-kiosk-pl-item-board.md`
6. **Offline-Stempeln** · **Mobile Push/Biometrie/Branding** · **Reporting/Charts** – geplant

### Mittlere Priorität

7. **DATEV-Export** – geplant, noch nicht implementiert
8. **Rechnungsvorlage** – eigene PDF-Vorlage hochladen
9. **Große Dateien aufteilen** – u. a. `invoices.service.ts`, `contacts-tab.tsx`, `timesheets/[id]/page.tsx`

### Niedrige Priorität / bewusst zurückgestellt

10. **Mahnwesen** – bewusst kein Mahnwesen
11. **Fahrtenbuch / Tankkosten / Schäden** – Fahrzeug-Erweiterungen später
12. **Nacht-/Wochenend-Zuschläge** – bewusst keine Zuschläge

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
└── 20260809120000_add_customer_pl_notification_email
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
claude-arbeitsitems-01 … 08 (PDF/Templates/OCR) – erledigt
claude-arbeitsitems-09-kiosk-pl-timesheets.md – erledigt (Kiosk-PIN)
claude-arbeitsitems-10-pl-timesheet-email.md – erledigt (Zustell-E-Mail + PDF-Mail)
claude-arbeitsitems-11-kiosk-pl-item-board.md – offen (Item-Board am /kiosk/pl)
```

---

## Workflow

- **Kleine Fixes:** Cursor direkt → commit/push → Server-Deploy
- **Große Features:** Spec in `claude-auftraege/`, dann Cloud-Auftrag
- Testen immer auf dem Server, nicht lokal mit Produktiv-Docker
