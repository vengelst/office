# Cloud-Auftrag #19: Docs-Pagination-UI, God-File-Splits, Dark-Logo

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`) und Next.js-Web (`apps/web`).
Produktion: `office.vivahome.de` (`/opt/office`).

Drei Themen aus Code-Review / Backlog:

1. Dokument-Pagination UI – API ist seit #16 paginiert; UI lädt noch `limit: 100` ohne Blätter-Steuerung
2. God-File-Splits ohne Verhaltensänderung: `timesheets.service.ts`, `projects.service.ts`, `backups.service.ts`
3. Helles Logo für Dark Mode (`company_logo_dark_key`) analog Standard-Logo

**Keine** Business-Logik-Änderungen. Verhalten der gesplitteten Module bleibt unverändert.

---

## Ziel

Nach Abschluss:

1. `documents-tab-v2` + globale Documents-Page: `page`/`limit`/`totalPages`, Blätter-UI, Filter setzt `page=1`
2. Drei God-Services klar geschnitten; Module/DI angepasst; öffentliche Controller-API unverändert
3. AppSetting `company_logo_dark_key`, Upload/Stream, Settings Company zweiter Upload, AppBrand Dark→dark logo (Fallback standard); Print/PDF weiter standard
4. `api` + `web` Build/`tsc` grün

---

## Nicht-Ziele

- PIN-Login / Time-Entries-Rollen
- Multi-Tenant / LicenseServer
- Backup-Format ändern
- Verhaltensänderungen an Business-Logik

---

## 1. Dokument-Pagination UI

### 1.1 Scope

- `apps/web/src/components/documents/documents-tab-v2.tsx`
- `apps/web/src/app/(authenticated)/documents/page.tsx`
- ggf. Texte unter `apps/web/src/lib/texts/documents.ts` (`pagination.prev/next/of/showing/page`)

API (`DocumentsService.findAll`) und `documentsApi.list` liefern bereits `{ data, total, page, limit, totalPages }`.

### 1.2 Verhalten

- State `page` (default 1), sinnvolles `limit` (z. B. 25 global, 25–50 Entity-Tab)
- Request mit `page` + `limit`
- UI analog Kundenliste: „X · Seite n von m“ + Zurück/Weiter
- Filter/Suche/Ordnerwechsel setzt `page=1`
- `expiring()`-Modus auf der globalen Page darf unpaginiert bleiben (wie API)

---

## 2. God-File-Splits

Öffentliche Methoden von `TimesheetsService` / `ProjectsService` / `BackupsService` bleiben für Controller nutzbar (Fassade ok). Module registrieren neue Provider.

### 2.1 `timesheets.service.ts`

Vorschlag:

- `timesheet-shared.ts` – Konstanten, Selects, Typen
- `timesheet-generation.service.ts` – generate, updateDay, Aggregate/Recompute-Helfer
- `timesheet-workflow.service.ts` – submit/approve/reject/archive/sign + PDF-Export/E-Mail
- `timesheets.service.ts` – Liste/Detail, Scope, Fassade

### 2.2 `projects.service.ts`

Vorschlag:

- `project-shared.ts` – Konstanten, Selects, Typen
- `project-resources.service.ts` – Sites, Equipment, Email-Recipients, Notes
- `project-assignments.service.ts` – Assignments + Availability-Helfer
- `projects.service.ts` – CRUD, Status, Timeline, listUsers/listWorkers, Fassade

### 2.3 `backups.service.ts`

Vorschlag:

- `backup-export.service.ts` – `exportModule` (+ ggf. Tar-Helfer)
- `backup-import.service.ts` – `importModule`
- `backups.service.ts` – Config, Jobs, Cron, runBackup, restore, Retention (orchestriert)

**Nicht** das Backup-Dateiformat ändern.

---

## 3. Helles Logo Dark Mode

### 3.1 API (`company.controller.ts`)

- AppSetting-Key: `company_logo_dark_key`
- Storage-Key-Präfix z. B. `company-logo-dark.<ext>`
- Endpoints analog Standard-Logo:
  - `POST /company/logo-dark` – Upload
  - `GET /company/logo-dark` – Key
  - `GET /company/logo-dark/file` – öffentlicher Stream (`@Public()`)

### 3.2 Web Settings

- `settings.ts`: `companyLogoDarkUrl`, `uploadCompanyLogoDark`, `getCompanyLogoDarkKey`
- `/settings/company`: zweiter Upload-Block „Logo Dark Mode“

### 3.3 AppBrand

- Dark Mode (`useTheme` / `resolvedTheme === 'dark'`): dark logo laden
- Fallback: Standard-Logo (wie bisher), ggf. heller Slot-Hintergrund für dunkle Logos
- `CompanyLogoPrint` / PDF: **weiterhin Standard-Logo** (`company_logo_key`)

---

## Abschlusskriterien

- [ ] Branch von `main`, Commits, PR gegen `main`
- [ ] Docs-Pagination UI in Tab + globaler Page
- [ ] Drei God-Files gesplittet, Verhalten unverändert, Builds grün
- [ ] Dark-Logo API + Settings + AppBrand
- [ ] `pnpm` Build / `tsc` für api + web grün
- [ ] Kurzer Report
- [ ] Diese Auftragsdatei mitcommitten

---

## Prompt (Kurzfassung für Cloud)

Lies diese Datei strikt. Drei Themen: (1) Dokument-Pagination UI page/limit/totalPages + Blätter, Filter→page=1; (2) Split timesheets/projects/backups.service ohne Verhaltensänderung; (3) company_logo_dark_key Upload/Stream, Settings zweiter Upload, AppBrand Dark→dark logo Fallback standard, Print/PDF standard. Kein PIN/Multi-Tenant/Backup-Format. Branch, PR, Build grün, Report.
