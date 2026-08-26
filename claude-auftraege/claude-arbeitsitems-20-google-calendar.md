# Cloud-Auftrag #20: Google Calendar – Termine in Office + Sync Office → Google

**Status:** Spec startklar (2026-08-26) · Prod = **v1.0.0** · Branch `main`  
**Voraussetzung für grünen Verbindungstest (manuell, nicht Teil dieses Auftrags):** Google Admin – Calendar API + DWD-Scope `calendar` (siehe unten). Ohne Admin-Schritt: Code + Builds trotzdem grün; nur Settings-Test schlägt fehl.

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`) und Next.js-Web (`apps/web`).  
Produktion: `office.vivahome.de` (`/opt/office`), Branch `main`.

**Google-Anbindung (bereits produktiv):**
- Service Account: `office-drive-sync@vivahome-office.iam.gserviceaccount.com`
- Impersonation: `vivahome@vivahome.de` (AppSettings unter Speicher & Cloud)
- Drive + Contacts (People API) funktionieren via Domain-Wide Delegation
- Contacts-Sync ist aktiv (`google_contacts_enabled=true`)

**Vorbild (1:1 spiegeln):**
- `apps/api/src/google-drive/google-contacts.service.ts`
- `apps/api/src/google-drive/contacts-settings.controller.ts`
- Sync-Hooks in `apps/api/src/customers/customers.service.ts`
- Web: `apps/web/src/app/(authenticated)/settings/contacts/` (+ Settings-Nav/Texte)

**Ist-Zustand Kalender:** `/projects/calendar` ist nur eine **Projekt-Timeline** (plannedStart/End), keine Termin-Entität, kein Google Calendar. Unverändert lassen.

**Nicht Teil dieses Auftrags:** GPS, Baustellenfotos, Kiosk – bereits live; nicht anfassen außer Kollision.

---

## Ziel

Nach Abschluss:

1. Eigenes Modell **Office-Termine** (CRUD) in der App
2. Sync **Office → Google Calendar** (primärer Kalender des Impersonation-Users), analog Contacts
3. Einstellungen **Google Calendar** (Toggle + Verbindungstest), Credentials = Speicher & Cloud
4. Web-UI: Termine anlegen/bearbeiten/löschen + Kalenderansicht
5. `api` + `web` Build/`tsc` grün; Prisma-Migration enthalten

---

## Nicht-Ziele (Phase 2 / Auftrag #21 später)

- Bidirektionaler Sync (Google → Office)
- Kalender **pro Mitarbeiter** / OAuth pro User
- Google Calendar Attendees / Meet-Links / Serientermine (RRULE) – optional nur wenn trivial
- UNIT_BASED-Abrechnung
- Umbau der bestehenden Projekt-Timeline (`/projects/calendar`) – bleibt wie sie ist; neue Route z. B. `/calendar` oder `/appointments`

---

## Produktentscheidungen (fest für diesen Auftrag)

| Punkt | Entscheidung |
|-------|----------------|
| Konto | Ein Workspace-User: Impersonation aus `google_drive_impersonate_email` |
| Richtung | Nur Office → Google |
| Zielkalender | `primary` des Impersonation-Users |
| Was ist ein Termin | Freie Termine (`CalendarEvent` / `Appointment`) mit Titel, Start, Ende, optional Beschreibung, optional `projectId` / `customerId` |
| Sync-Flag | `syncToGoogle` (Default `true` wenn Calendar-Integration enabled) + `googleEventId` |
| Feature-Flag | `google_calendar_enabled` (AppSetting), analog Contacts |

---

## 1. Prisma

Neues Modell z. B. `CalendarEvent`:

- `id`, `title`, `description?`
- `startsAt` (DateTime), `endsAt` (DateTime)
- `allDay` Boolean default false
- `projectId?`, `customerId?` (optional FKs, onDelete SetNull)
- `createdById?` → User
- `syncToGoogle` Boolean default true
- `googleEventId` String? (Google event id)
- `createdAt`, `updatedAt`

Migration unter `prisma/migrations/…_add_calendar_events/`.

Indexes: `startsAt`, `projectId`, `customerId`.

---

## 2. API – Google Calendar Service

Neue Dateien unter `apps/api/src/google-drive/` (oder `google-calendar/` im gleichen Modul):

- `google-calendar.service.ts` – analog `google-contacts.service.ts`
  - Auth: JWT + DWD, Scope `https://www.googleapis.com/auth/calendar`
  - Credentials: `google_drive_service_account_json` + `google_drive_impersonate_email`
  - Methoden: `getConfig`, `saveConfig({enabled})`, `testConnection`, `createEvent`, `updateEvent`, `deleteEvent`
  - `testConnection`: z. B. `calendarList.get({ calendarId: 'primary' })` oder `events.list` mit `maxResults: 1`
- `calendar-settings.controller.ts` – `GET/PUT /settings/calendar`, `POST /settings/calendar/test`
- Modul: in `GoogleDriveModule` Provider + Controller registrieren

Fehlerbehandlung: wie Contacts – loggen, Sync-Fehler sollen CRUD in Office nicht hart abbrechen (fire-and-forget oder try/catch + warn).

---

## 3. API – Termine-CRUD

Neues Modul `apps/api/src/calendar-events/` (Name klar und kollisionsfrei mit Projekt-Timeline):

- Controller: `@Roles(SUPERADMIN, OFFICE, PROJECT_MANAGER)` mindestens für CRUD
- Endpoints:
  - `GET /calendar-events?from=&to=&projectId=`
  - `GET /calendar-events/:id`
  - `POST /calendar-events`
  - `PATCH /calendar-events/:id`
  - `DELETE /calendar-events/:id`
- Nach Create/Update/Delete: Sync zu Google wenn enabled + `syncToGoogle` (Muster `syncContactToGoogle`)
- Bei Update: Google `events.patch`/`update` mit gespeicherter `googleEventId`
- Bei Delete oder `syncToGoogle` false: Event in Google löschen, `googleEventId` nullen

Google Event Mapping:

- `summary` ← title  
- `description` ← description (+ ggf. Link-Hinweis Office)  
- `start`/`end`: timed = `dateTime`+`timeZone: Europe/Berlin`; allDay = `date`  

---

## 4. Web – Settings

Analog `/settings/contacts`:

- Seite `/settings/calendar`
- Toggle, Verbindungstest, Hinweis auf DWD-Scope `calendar`, Credentials = Speicher & Cloud
- Nav-Eintrag in Settings-Übersicht + Texte in `apps/web/src/lib/texts/settings.ts` (DE; SK/SL falls Settings-i18n vorhanden, sonst wie Contacts-Muster)

---

## 5. Web – Termine-UI

- Route z. B. `/calendar` (oder `/appointments`) – **nicht** die bestehende Projekt-Timeline ersetzen
- Liste + Monats-/Wochenansicht (pragmatisch: vorhandene UI-Libs nutzen oder einfache Liste mit Datumsfilter + Dialog „Neuer Termin“)
- Formular: Titel, Start, Ende, Ganztägig, Beschreibung, optional Projekt/Kunde, Sync-Checkbox
- Nav: sinnvollen Eintrag in der Hauptnavigation (neben Projekte o. ä.)
- Client-API in `apps/web/src/lib/…`

Bestehende Seite `/projects/calendar` **unverändert lassen** (weiterhin Timeline).

---

## 6. Doku / Backlog anpassen

- `claude-auftraege/offen-backlog.md`: Google Calendar nicht mehr „bewusst nicht“; Phase-1 erledigt nach Merge; Phase-2 (Rück-Sync / pro User) optional listen
- `PROJECT-STATUS.md` / `STATUS.md` kurz aktualisieren
- Cursor-Rule `.cursor/rules/offen-backlog.mdc` Sync-Hinweis falls nötig

---

## Google Admin (außerhalb Code – Voraussetzung für Test „OK“)

Bereits geprüft: Contacts OK, Calendar Scope fehlt (`unauthorized_client`).

Manuell (Super-Admin Workspace):

1. Cloud Console → Projekt `vivahome-office` → **Google Calendar API** aktivieren  
2. Admin Console → Sicherheit → API-Steuerung → Domain-Wide Delegation → Client des SA `office-drive-sync@vivahome-office.iam.gserviceaccount.com` → Scope ergänzen:  
   `https://www.googleapis.com/auth/calendar`  
   (bestehende Drive-/Contacts-Scopes behalten)

Der Cloud-Agent implementiert den Code so, dass der Verbindungstest diese Voraussetzung prüft; ohne Admin-Schritt schlägt nur der Test fehl, Builds bleiben grün.

---

## Abnahme

- [ ] Migration läuft (`prisma migrate`)
- [ ] Settings Calendar: Toggle speichern, Test-Endpoint vorhanden
- [ ] Termin CRUD in API + Web
- [ ] Bei aktivem Sync: Create schreibt Google-Event-ID; Update/Delete spiegeln
- [ ] Projekt-Timeline `/projects/calendar` ungebrochen
- [ ] Typecheck/Build api + web OK
- [ ] Kein Bidirektional / Multi-User-Kalender in diesem Auftrag

---

## Hinweise

- `googleapis` ist bereits Dependency der API.
- Keine Secrets committen; SA-JSON bleibt in AppSettings.
- Stil/Patterns der bestehenden Contacts-Integration strikt spiegeln.
