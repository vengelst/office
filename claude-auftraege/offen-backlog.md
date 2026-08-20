# Office – Offener Backlog (später aufgreifen)

Stand: **2026-08-20** (Projektwechsel – Session festhalten).

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
- **Google Calendar:** bewusst nicht
- **Google Contacts:** nur Contacts; Config unter **Einstellungen → Google Contacts**; SA/Impersonation von **Speicher & Cloud**

**Noch zu tun (nächstes Wiederaufgreifen):**
1. Google Admin: People API aktivieren + DWD-Scope `https://www.googleapis.com/auth/contacts` für denselben Service Account wie Drive
2. In Office: Einstellungen → Google Contacts → Sync an → Verbindungstest
3. Danach optional: UNIT_BASED-Abrechnung aus geprüften Arbeitsitems

Prod: `office.vivahome.de` · Branch `main` · letzter Feature-Commit Contacts: `2092ef1`

---

Erledigt zuvor (#16–#19): Logo, Perf, JSDoc, Indexes, Feature-Flags, Splits, Docs-Pagination, Dark-Logo.

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

## ~~4. Produktisierung Managed Single-Tenant~~ – nicht geplant

**Klarstellung (17.08.2026):** Office ist **eine eigene App** für Vivahome – **keine** Auslieferung mehrerer Kunden-Instanzen.

Feature-Flags (#18) bleiben sinnvoll für Module in **dieser** Instanz an/aus.

---

## Optional später (nicht priorisiert)

- Kunden-PL-Kiosk ebenfalls DE/SK/SL
- Mobile-App: Locale-Umschalter statt immer DE/SK dual; SL ergänzen
- UX: Hinweis, wenn Zuweisung erst in der Zukunft startet („erst ab … stempelfähig“)
- PIN-Login-Lookup ohne Full-Scan – nur bei spürbarer Last / vielen PINs
- UNIT_BASED-Abrechnung aus geprüften Arbeitsitems

---

## Bewusst nicht jetzt

- Managed Multi-Instanz / Install-Skript / AVV / Online-Lizenzserver
- Google Calendar Sync
- Weitere God-File-Feinschliffe außer bei Bedarf
- Multi-Tenant `tenantId`

---

## Wiederaufgreifen

In Cursor: Rule **„Office Offener Backlog“** aktivieren / @-erwähnen, oder diese Datei öffnen.
