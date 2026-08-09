# Cloud-Auftrag #18: Prisma-Indexes, JSDoc P2, God-File-Splits, Feature-Flags

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`) und Next.js-Web (`apps/web`).
Produktion: `office.vivahome.de` (`/opt/office`).

Vier Wartungs-/Fundamente-Themen aus Code-Review und Backlog:

1. Fehlende Prisma-Indexes auf häufig gefilterten FK-/Status-Feldern
2. Restliche P2-JSDoc-Dateiköpfe für große Web-UI-Dateien (≥200 Zeilen)
3. God-File-Splits (Wartbarkeit): `invoices.service.ts`, `contacts-tab.tsx`, `settings/system/page.tsx`
4. Feature-Flags in DB (`AppSetting` key `feature_flags`) inkl. Settings-UI und Guards

**Keine** Business-Logik-Änderungen außer Feature-Guard. Verhalten der aufgeteilten Module bleibt unverändert.

---

## Ziel

Nach Abschluss:

1. Migration + `schema.prisma` mit sinnvollen Indexes; `prisma migrate deploy` lauffähig
2. Alle großen Web-UI-Dateien ≥200 Zeilen ohne Dateikopf erhalten einen deutschen Modul-Kopf
3. Die drei God-Files sind in klar getrennte Module/Komponenten geschnitten (öffentliche API/Exports bleiben kompatibel)
4. Feature-Flags: Defaults alle `true`, GET/PUT API (PUT nur SUPERADMIN), UI `/settings/features`, Nav ausblenden + API 403 wenn Flag false
5. `api` + `web` Build/`tsc` grün

---

## Nicht-Ziele

- PIN-Login / Time-Entries-Rollen
- Multi-Tenant / LicenseServer
- ENV-basierte Feature-Flags
- Verhaltensänderungen an Business-Logik außer Feature-Guard
- Weitere God-Files (z. B. `timesheets/[id]/page.tsx`) – optional später

---

## 1. Prisma Indexes (§3)

### 1.1 Migration

Neue Migration unter `prisma/migrations/<timestamp>_add_query_indexes/` mit `CREATE INDEX` (idempotent wo sinnvoll mit Prisma-konformen Indexnamen).

### 1.2 Mindestens folgende Indexes (soweit noch fehlend)

| Model | Index |
|-------|-------|
| CustomerBranch | `customerId` |
| CustomerContact | `customerId`, `branchId` |
| CustomerEmail | `customerId` |
| CustomerBankAccount | `customerId` |
| CustomerNote | `customerId` |
| CustomerCallLog | `customerId`, `contactId` |
| ProjectSite | `projectId` |
| ProjectEquipment | `projectId` |
| ProjectStatusHistory | `projectId` |
| ProjectNote | `projectId` |
| ProjectAssignment | `projectId`, `workerId`, `[projectId, active]` |
| ProjectEmailRecipient | `projectId` |
| Subcontractor | `active`, `deletedAt`, `[active, deletedAt]` |
| WorkerPin | `workerId`, `[workerId, isActive]` |
| UserPin | `userId`, `[userId, isActive]` |
| Vehicle | `active`, `subcontractorId` |
| WorkerVehicleAssignment | `workerId`, `vehicleId` |
| WorkerLanguage | `workerId` |
| WorkerCertification | `workerId` |
| WorkerTeamMember | `workerId`, `teamId` |
| GpsEvent | `workerId`, `recordedAt` |
| BreakRule | `projectId`, `active` |
| WeeklyTimesheet | `status`, `projectId`, `[status, projectId]` |
| WeeklyTimesheetDay | `weeklyTimesheetId` |
| WeeklyTimesheetSignature | `weeklyTimesheetId` |
| Invoice | `issueDate`, `dueDate` |
| InvoiceLine | `invoiceId` |
| InvoicePayment | `invoiceId` |
| TimeEntry | `projectId` |
| EmailLog | `relatedEntityType, relatedEntityId`, `createdAt` |

Bereits vorhandene Indexes nicht doppelt anlegen. `schema.prisma` synchron mit `@@index([...])` pflegen.

### 1.3 Deploy

Migration muss mit `npx prisma migrate deploy` (bzw. im Docker-Start) lauffähig sein.

---

## 2. JSDoc P2 – Dateiköpfe

Für alle Dateien unter `apps/web/src/` mit ≥200 Zeilen, die noch keinen Block-Dateikopf (`/** … */`) haben:

```ts
/**
 * Seite/Komponente: <kurz> (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */
```

Keine Logikänderungen. Kein Kommentar-Spam in Funktionskörpern.

---

## 3. God-File-Splits

### 3.1 `apps/api/src/invoices/invoices.service.ts`

Aufteilen in z. B.:

- `invoice-calc.util.ts` – Rundung, Totals, Line-Mapping, gemeinsame Typen/Selects
- `invoice-generation.service.ts` – Generierung aus Stundenzetteln
- `invoice-export.service.ts` – PDF speichern / Document-Links (MinIO)
- `invoices.service.ts` – CRUD, Status-Workflow, Payments (Fassade bleibt für Controller)

Verhalten und öffentliche Methoden von `InvoicesService` unverändert nutzbar für den Controller.

### 3.2 `apps/web/src/components/customers/tabs/contacts-tab.tsx`

Aufteilen in z. B.:

- Typen/Konstanten
- `AuthImage` / Checkbox-Helfer
- Scan-Dialog (OCR Visitenkarte)
- Formular-Dialog (CRUD)
- `contacts-tab.tsx` als Orchestrierung

Export `ContactsTab` und `ContactsExternalAction` bleiben am bisherigen Modulpfad (Re-Export ok).

### 3.3 `apps/web/src/app/(authenticated)/settings/system/page.tsx`

Abschnitte in `components/settings/system/*` auslagern (Summary, Resources, DB, Storage, Services, Updates, Docker, Processes, …). `page.tsx` orchestriert Laden/Refresh/Update-Dialog.

---

## 4. Feature-Flags in DB

### 4.1 Speicherung

- `AppSetting.key = 'feature_flags'`
- `value` = JSON-Objekt, Keys = Modul-Flags, Values = boolean
- **Defaults: alle `true`** (fehlende Keys → true)

Vorgeschlagene Flags (Kernmodule / Nav):

```ts
{
  customers: true,
  projects: true,
  workers: true,
  teams: true,
  subcontractors: true,
  vehicles: true,
  equipment: true,
  timeClock: true,
  timesheets: true,
  documents: true,
  invoices: true,
  todos: true
}
```

### 4.2 API

- `GET /feature-flags` – authentifiziert, liefert vollständiges Objekt (mit Defaults gemerged)
- `PUT /feature-flags` – nur `SUPERADMIN`, Body partiell oder vollständig, speichert gemerged

### 4.3 Guard

- Decorator z. B. `@RequireFeature('invoices')` + Guard
- Bei Flag `false` → HTTP 403
- An Controller/Routen der Kernmodule hängen (Modul-Root ausreichend)

### 4.4 Web-UI

- Seite `/settings/features` (Toggles, Speichern nur SUPERADMIN)
- Link auf Settings-Übersicht
- Sidebar/Nav: Einträge ausblenden, deren Flag false ist
- Optional Client-Hint: Feature-Flags einmal laden (Context/Hook)

### 4.5 Nicht

- Keine ENV-Flags
- Kein LicenseServer / Multi-Tenant

---

## Abschlusskriterien

- [ ] Branch von `main`, Commits, PR gegen `main`
- [ ] Indexes-Migration deploybar
- [ ] Drei God-Files gesplittet, Verhalten unverändert
- [ ] P2-Dateiköpfe für restliche ≥200-Zeilen-Dateien
- [ ] Feature-Flags API + UI + Nav + 403
- [ ] `pnpm` Build / `tsc` für api + web grün
- [ ] Kurzer Report
- [ ] Diese Auftragsdatei mitcommitten

---

## Prompt (Kurzfassung für Cloud)

Lies diese Datei strikt. Vier Themen: (1) Prisma Indexes Migration+schema, (2) JSDoc P2 Dateiköpfe für große Web-UI ≥200 Zeilen, (3) Split invoices.service / contacts-tab / settings/system/page ohne Verhaltensänderung, (4) Feature-Flags in AppSetting feature_flags JSON (Defaults true, GET/PUT SUPERADMIN-PUT, /settings/features, Nav aus + API 403). Kein PIN/Multi-Tenant/ENV-Flags. Branch, PR, Build grün, Report.
