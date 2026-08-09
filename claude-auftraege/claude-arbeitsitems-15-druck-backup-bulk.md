# Cloud-Auftrag #15: Druck, Backup/Restore, Mehrfach-Löschen

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de` (`/opt/office`).

## Ziel

Drei Blöcke:

1. **Druck** auf Detailseiten Kunde (Vorbild), Projekt, Monteur, Subunternehmen
2. **Backup/Restore** mit Schedule und Modul-Checkboxen
3. **Mehrfach-Löschen** auf Listen + DocumentsTabV2

## Nicht-Ziele

- Point-in-Time-Recovery (PITR)
- Kiosk / Mobile
- Seed-Spoil

---

## A) Druck

Vorbild: `apps/web/src/components/customers/customer-print-all.tsx` + Kunden-Detailseite.

### Anforderungen

- Sichtbarer Druck-Button in der Kopfzeile (Dropdown)
- Optionen: **Aktuelle Ansicht** (`window.print()`) und **Gesamtübersicht** (PrintAll + `print-all-mode`)
- `.no-print` an Aktionsbuttons
- Historie / Zuweisungen / Kontakte mitdrucken wo sinnvoll

### Dateien

- `project-print-all.tsx`, `worker-print-all.tsx`, `subcontractor-print-all.tsx`
- Detailseiten unter `projects/[id]`, `workers/[id]`, `subcontractors/[id]`
- CSS in `globals.css` (bestehend: `.print-all-mode`, `.no-print`)

---

## B) Backup / Restore

### Prisma

- `BackupConfig` (enabled, scheduleHour, scheduleMinute, retentionDays)
- `BackupJob` (status, trigger, filePath, fileSize, …)
- `RestoreLog` (modules JSON, status, details)

Migration: `20260809210000_add_backup_restore`

### API `/backups`

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/backups/config` | Konfiguration |
| PATCH | `/backups/config` | Speichern |
| GET | `/backups` | Job-Liste |
| POST | `/backups` | Manuelles Full-Backup |
| GET | `/backups/:id` | Detail |
| POST | `/backups/:id/restore` | Restore mit `modules[]` |
| DELETE | `/backups/:id` | Job + Dateien löschen |
| GET | `/backups/restores` | Restore-Protokoll |
| GET | `/backups/modules` | Modul-Liste |

Rollen: `SUPERADMIN`, `OFFICE` (wie Settings).

### Module

`todos`, `customers`, `projects`, `workers`, `teams`, `subcontractors`, `vehicles`, `equipment`, `timesheets`, `documents`, `invoices`

### Technik

- Full-Backup als JSON-Module unter `BACKUP_DIR` (Default `/data/backups`) + gzip-Archiv
- Nest `ScheduleModule` + Cron jede Minute (prüft Stunde/Minute)
- Volume `office_backups_data` in `docker-compose.prod.yml`
- UI: `/settings/backup`

---

## C) Mehrfach-Löschen

### Listen

Dokumente, Kunden, Projekte, Todos, Monteure, Subunternehmen, Equipment – plus `DocumentsTabV2`.

### API

`POST /:resource/bulk-delete` mit `{ ids: string[] }`, ruft bestehende `remove()`-Logik je ID auf.

### UI

Checkbox-Spalte, „Alle auswählen“, `BulkActionBar`, Bestätigungsdialog.

---

## Abnahme

- Migration deploybar (`prisma migrate deploy`)
- Druck auf Projekt/Monteur/Sub analog Kunde
- Backup manuell + Schedule + Restore mit Modul-Checkboxen
- Bulk-Delete auf allen genannten Listen
