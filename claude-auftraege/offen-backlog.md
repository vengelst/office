# Office – Offener Backlog (später aufgreifen)

Stand: **2026-08-21** (Cloud-Auftrag #20 Google Calendar).

---

## Session 21.08.2026 – Google Calendar (#20)

| Thema | Status |
|-------|--------|
| Prisma `CalendarEvent` + Migration `20260821180000_add_calendar_events` | implementiert |
| `GoogleCalendarService` + Settings `/settings/calendar` | implementiert |
| CRUD `calendar-events` + Sync Office → Google (`primary`, Europe/Berlin) | implementiert |
| Web: `/settings/calendar` + Termin-UI `/calendar` | implementiert |
| Projekt-Timeline `/projects/calendar` | unverändert |

**Credentials:** Drive-SA + Impersonation (Speicher & Cloud). Toggle `google_calendar_enabled`.

**Noch manuell (Google Admin):**
1. Cloud Console → **Google Calendar API** aktivieren
2. Admin Console → DWD-Scope `https://www.googleapis.com/auth/calendar` für denselben SA wie Drive
3. In Office: Einstellungen → Google Calendar → Sync an → Verbindungstest

---

## Session 17.–20.08.2026 – was erledigt wurde

| Thema | Commit | Status |
|-------|--------|--------|
| Stempel-API: Rollen + eigene `workerId` | `488ad20` | live auf Prod |
| Doku: eigene App, kein Multi-Instanz/AVV; PIN bleibt | `d4905d8` | live |
| Google Contacts: Einstellungen-UI (Toggle, Test, Hinweise) | `2092ef1` | live auf Prod |

**Produktentscheidungen (fest):**
- Office = **eigene Vivahome-App** (keine Kunden-Mehrfachinstanzen)
- **PIN-Login bleibt** (Monteur + Kunden-PL)
- **Google Calendar:** Office → Google (primary), kein Bidirektional / kein Multi-User-Kalender
- **Google Contacts:** nur Contacts; Config unter **Einstellungen → Google Contacts**; SA/Impersonation von **Speicher & Cloud**

**Noch zu tun (nächstes Wiederaufgreifen):**
1. Google Admin: People API + DWD-Scope `contacts` (falls noch nicht) → Contacts Sync testen
2. Google Admin: Calendar API + DWD-Scope `calendar` → Calendar Sync testen
3. Optional: UNIT_BASED-Abrechnung aus geprüften Arbeitsitems

Prod: `office.vivahome.de` · Branch `main`

---

Erledigt zuvor (#16–#19): Logo, Perf, JSDoc, Indexes, Feature-Flags, Splits, Docs-Pagination, Dark-Logo.
Erledigt #20: Google Calendar Sync (Office → Google).

Erledigt am 2026-08-10:

| Thema | Commit / Hinweis |
|-------|------------------|
| Stempel-PIN am Monteur dauerhaft sichtbar | `f954311` – `WorkerPin.pinPlain` + `GET /workers/:id/pin`; Anzeige auf Monteur-Detail. Alte PINs ohne Klartext: einmal neu setzen. |
| Kiosk-Sprachen DE / SK / SL | `9696e9d` (+ Build-Fixes) – Sprachumschalter auf PIN-Screen; Terminal + Arbeitsitems folgen Locale (`office_kiosk_lang`). Setup/Kunden-PL bleiben Deutsch. Mobile-App weiter DE/SK dual. |

Erledigt am 2026-08-17:

| Thema | Hinweis |
|-------|---------|
| Time-Entries-Rollen absichern | `@Roles(SUPERADMIN, OFFICE, PROJECT_MANAGER, WORKER)` auf Stempel-Endpoints; `assertOwnWorker` blockiert User ohne Office/PM/SUPERADMIN (inkl. `CUSTOMER_PL`). Worker nur eigene `workerId`. |

Erledigt am 2026-08-17 (Contacts-UI, deployed):

| Thema | Hinweis |
|-------|---------|
| Contacts-Einstellungen | `/settings/contacts` – `google_contacts_enabled`; Test gegen People API; Credentials = Drive-SA + Impersonation |

---

## Betriebshinweise (Kiosk / Stempeln) – oft nachgefragt

### Admin-PIN
- **Nicht** in den Office-Einstellungen, sondern nur auf **Kiosk einrichten** (`/kiosk/setup`): Feld „Admin-PIN (4–6 Ziffern)“.
- Wird lokal am Gerät in `localStorage` (`office_kiosk_config`) gespeichert.
- Zum Verlassen des Kiosks: Terminal → **Setup** → dieselbe PIN.

### Projekt dem Kiosk zuweisen
1. Im Office ein Projekt auf Status **ACTIVE** setzen (nur aktive Projekte erscheinen).
2. `/kiosk/setup` neu laden → Dropdown „Projekt zuweisen“ → Admin-PIN → Kiosk starten.
3. Zuordnung gilt **pro Gerät**, nicht global.

### Monteur kann Projekt sehen, aber nicht einstempeln
- Entscheidend ist die **Zuweisung** (`ProjectAssignment`), nicht nur Projekt-Status.
- App teilt Zuweisungen: `startDate <= heute` → stempelfähig; `startDate > heute` → nur „Zukünftige Projekte“, Stempel-Button disabled.
- **Beispiel Luxemburg (P-2026-0001):** Projekt ab 2026-08-10 ACTIVE, vier Monteure aber mit Zuweisungs-Start **2026-08-11** → erst ab dem 11. stempelfähig, oder Start-Datum der Zuweisungen auf heute korrigieren.

---

## ~~1. Time-Entries-Rollen absichern~~ ✅ 2026-08-17

**War:** Stempel-Endpoints ohne klare `@Roles`; `assertOwnWorker` nur für Worker-Tokens → jeder User-JWT (inkl. `CUSTOMER_PL`) konnte fremde `workerId` stempeln.

**Jetzt:**
- Controller: Stempel/Status/Foto nur `SUPERADMIN` | `OFFICE` | `PROJECT_MANAGER` | `WORKER`
- Service: User ohne Office/PM/SUPERADMIN → `ForbiddenException`; Worker nur eigene ID
- `GET live` unverändert nur Office/PM/SUPERADMIN; Kiosk `project-status` weiter API-Key

**Einstieg (Referenz):**
- `apps/api/src/time-entries/time-entries.controller.ts`
- `apps/api/src/time-entries/time-entries.service.ts` (`assertOwnWorker`)

---

## 2. PIN-Login (besteht – Härtung optional)

**Status:** PIN-Login für Monteur (Kiosk/App) und Kunden-PL ist **gewollt und bleibt**. Klartext `pinPlain` = Büro-Anzeige; Login weiter über Hash.

**Optional später (Skalierung):** Lookup ohne Full-Scan aller bcrypt-Hashes + Rate-Limit – nur relevant, wenn die PIN-Anzahl spürbar wächst. Kein Breaking Change am Flow.

**Einstieg (bei Bedarf):**
- `apps/api/src/auth/auth.service.ts` (`pinLogin` / `userPinLogin`)

---

## 3. Google Contacts – UI live, Google Admin noch offen

**App-Seite:** Einstellungen → Google Contacts (`/settings/contacts`)
- Toggle `google_contacts_enabled`
- Verbindungstest People API
- Credentials: Service Account + Impersonation aus **Speicher & Cloud** (nicht separat)

**Google-Seite (manuell, einmalig):**
1. Cloud Console → People API aktivieren (Projekt Vivahome Office)
2. Admin Console → DWD → Scope `https://www.googleapis.com/auth/contacts` für denselben SA wie Drive

Danach Sync anschalten und testen. Pro Kontakt weiter Checkbox `syncToGoogle`.

---

## 4. Google Calendar – App fertig, Google Admin noch offen

**App-Seite:** Einstellungen → Google Calendar (`/settings/calendar`)
- Toggle `google_calendar_enabled`
- Verbindungstest Calendar API
- Credentials: Service Account + Impersonation aus **Speicher & Cloud**
- Termine: UI `/calendar` (nicht Projekt-Timeline)

**Google-Seite (manuell, einmalig):**
1. Cloud Console → Google Calendar API aktivieren
2. Admin Console → DWD → Scope `https://www.googleapis.com/auth/calendar` für denselben SA wie Drive

Nur Office → Google, Kalender `primary`, Timezone Europe/Berlin. Kein Bidirektional.

---

## ~~5. Produktisierung Managed Single-Tenant~~ – nicht geplant

**Klarstellung (17.08.2026):** Office ist **eine eigene App** für Vivahome – **keine** Auslieferung mehrerer Kunden-Instanzen.

Feature-Flags (#18) bleiben sinnvoll für Module in **dieser** Instanz an/aus.

---

## Optional später (nicht priorisiert)

- Kunden-PL-Kiosk ebenfalls DE/SK/SL
- Mobile-App: Locale-Umschalter statt immer DE/SK dual; SL ergänzen
- UX: Hinweis, wenn Zuweisung erst in der Zukunft startet („erst ab … stempelfähig“)
- PIN-Login-Lookup ohne Full-Scan – nur bei spürbarer Last / vielen PINs
- UNIT_BASED-Abrechnung aus geprüften Arbeitsitems
- Bidirektionaler Calendar-Sync / Multi-User-Kalender

---

## Bewusst nicht jetzt

- Managed Multi-Instanz / Install-Skript / AVV / Online-Lizenzserver
- Bidirektionaler Google Calendar Sync / Multi-User-Kalender
- Weitere God-File-Feinschliffe außer bei Bedarf
- Multi-Tenant `tenantId`

---

## Wiederaufgreifen

In Cursor: Rule **„Office Offener Backlog“** aktivieren / @-erwähnen, oder diese Datei öffnen.
