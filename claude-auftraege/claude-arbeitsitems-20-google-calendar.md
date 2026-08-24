# Cloud-Auftrag #20: Google Calendar Sync (Office → Google)

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`) und Next.js-Web (`apps/web`).
Produktion: `office.vivahome.de` (`/opt/office`).

Analog zu Google Contacts (#Contacts-Settings): Termine in Office pflegen und
**einseitig** in den Google-Kalender des impersonierten Kontos schreiben.

Credentials: **dieselben** wie Drive (Service Account JSON + Impersonation unter
Speicher & Cloud). Neuer Toggle `google_calendar_enabled`. Scope:
`https://www.googleapis.com/auth/calendar`.

**Nicht** die bestehende Projekt-Timeline `/projects/calendar` ändern.

---

## Ziel

Nach Abschluss:

1. Prisma-Modell `CalendarEvent` + Migration
2. `GoogleCalendarService` (SA + DWD, Scope calendar) + Settings API `/settings/calendar`
3. CRUD-Modul `calendar-events` mit Sync Office → Google (`primary`, Europe/Berlin)
4. Web: Settings-Seite + neue Termin-UI-Route (z. B. `/calendar`)
5. Docs/Backlog aktualisiert (Calendar nicht mehr „bewusst nicht“)
6. `api` + `web` Build/`tsc` grün

---

## Nicht-Ziele

- Bidirektionaler Sync (Google → Office)
- Multi-User-Kalender / mehrere Kalender-IDs
- Änderungen an `/projects/calendar` (Projekt-Timeline)
- Separate Credentials neben Drive SA + Impersonation

---

## 1. Prisma

Modell `CalendarEvent`:

- `title`, `description?`, `location?`
- `startAt`, `endAt`, `allDay` (default false)
- optional `projectId` → Project (SetNull)
- `googleEventId?`, `syncToGoogle` (default true)
- `createdById?`, `createdAt`, `updatedAt`
- Indexes: `(startAt, endAt)`, `projectId`, `createdById`

Migration: `YYYYMMDDHHMMSS_add_calendar_events`

---

## 2. GoogleCalendarService + Settings

Analog `google-contacts.service.ts` / `contacts-settings.controller.ts`:

- Setting-Key `google_calendar_enabled`
- Credentials aus `google_drive_service_account_json` + `google_drive_impersonate_email`
- Scope `https://www.googleapis.com/auth/calendar`
- Kalender-ID `primary`, Timezone `Europe/Berlin`
- Methoden: `getConfig`, `saveConfig`, `testConnection`, `createEvent`, `updateEvent`, `deleteEvent`
- Controller: `GET/PUT /settings/calendar`, `POST /settings/calendar/test`
- Rollen: SUPERADMIN, OFFICE

---

## 3. CRUD `calendar-events`

- Nest-Modul mit list/get/create/update/delete
- Filter: `from`, `to`, `projectId`, Pagination
- Bei create/update/delete: Sync nach Google wenn `syncToGoogle` (fire-and-forget + Log)
- Feature-Flag `calendar` (Default true) + Nav `/calendar`

---

## 4. Web

- `/settings/calendar` – Toggle, Test, Hinweise (Calendar API + DWD-Scope)
- `/calendar` – Terminliste + Dialog create/edit (Titel, Zeiten, Ort, optional Projekt, Sync-Checkbox)
- Settings-Übersicht + Sidebar-Nav ergänzen
- **Nicht** `/projects/calendar` anfassen

---

## 5. Docs

- `offen-backlog.md`, `PROJECT-STATUS.md`, `STATUS.md`: Calendar Sync als implementiert; Google Admin (Calendar API + DWD) noch manuell
- Rule `.cursor/rules/offen-backlog.mdc` anpassen

---

## Abnahme

- [ ] Migration vorhanden und Client generiert
- [ ] Settings Calendar API + UI
- [ ] Termine CRUD + Google Sync (Office → primary)
- [ ] Projekt-Timeline unverändert
- [ ] tsc/build api + web grün
