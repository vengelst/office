# Office – Offener Backlog (später aufgreifen)

Stand: **2026-08-27** · **Version 1.0.1 (Production)** · Tag [`v1.0.1`](https://github.com/vengelst/office/releases/tag/v1.0.1) · Branch `main`

Handbuch Stammdaten: **`HANDBUCH.md`** · Feature-Status: **`STATUS.md`** · Kurzstatus: **`PROJECT-STATUS.md`**

---

## Release 1.0.0 – was sich geändert hat (Kurz)

| Bereich | Inhalt |
|---------|--------|
| Kiosk #21a–c | Clock-In nur mit gültiger Projektzuweisung; PIN-Kiosk-Freigabe + Gültigkeit; Foto-Kommentar im Bild |
| Master-Monteur | Stempeln ohne Zuweisung auf ACTIVE/PLANNED-Projekte |
| Stundenzettel | Anlegen/Öffnen, KW-Bereich, volle Woche Mo–So, manuelle Tage, Neu laden aus Stempelungen |
| Backup | Zeitplan Europe/Berlin; UI-Hinweise |
| Betrieb | Kein `prisma db seed` mehr beim Prod-API-Start |
| Contacts | Google Contacts produktiv |
| Docs | README / STATUS / PROJECT-STATUS / dieses Backlog + **HANDBUCH.md** |

Prod: `office.vivahome.de` · Branch `main` · Kiosk: `work.vivahome.de`

---

## Session-Notiz Cursor 27.08.2026 (Abend)

- Cloud-Auftrag **#24** KI-Kontakt-Import **umgesetzt**: Settings → KI, Preview/Commit, NL-Web-Anreicherung, `CustomerBranch` + `branchId`, Bulk ohne Google-Sync
- Spec: `claude-arbeitsitems-24-ki-kontakt-import.md`

## Session-Notiz Cursor 27.08.2026

- SPIE-Outreach manuell auf Prod importiert (`K-2026-0012`); Skript `scripts/import-spie-outreach.cjs`
- Deploy-Falle behoben: immer `--env-file .env.production` (sonst API/Web „leer“)
- Cloud-Auftrag **#24** KI-Kontakt-Import Spec startklar

## Session-Notiz Cursor 26.08.2026 (Übergabe)

- Backlog/Status auf **v1.0.1** nachgezogen; GPS/#22/#23 als erledigt dokumentiert
- Cloud-Auftrag **#20** Google Calendar Phase 1 Spec startklar
- Regel: **Push + Deploy immer durch den Agenten** (`.cursor/rules/deploy-workflow.mdc`), bis Benutzer widerruft
- Nächster Schritt Office: Google Admin Calendar-Scope, dann Cloud #20

## Session 24.–26.08.2026 – nach v1.0.0 / Release 1.0.1 (live auf Prod)

| Thema | Commits (Auswahl) | Status |
|-------|-------------------|--------|
| GPS-Übersicht, Live nur Master, Kiosk-Log-Schalter | `7e0d3bd` | live |
| GPS Monteur-Filter, Karten-Spur, Speicherintervall | `cdddb82` | live |
| GPS Projekt-/Datumsfilter; Kommentar-Position im Foto | `50bbc73` | live |
| Baustellenfotos als Tab (Monteur + Projekt) | `a11467c` | live |
| Foto-Kommentar lesbar; GPS bei Login/Logout/Foto/Aktionen | `f88e22d`, `653dfe4` | live |
| Kiosk: Flash/Fullscreen/401-Loop/Foto-Tipp/Master-Projektwahl | `59e6b44` … `18171a1` | live |
| Handbuch PDF (Kopf, Seitenzahlen, Screenshots, druckfreundlich) | `71c7d63` … `5392eea` | live |
| SMTP-DTO Whitelist | `6be5334` | live |
| **#22** Master-Tätigkeitsbereiche (Katalog, Kiosk-Wechsel, Stundenzettel) | `627b2b2` | live |
| **#23** Stempeluhr Zeitraum, Pause Start/Stopp, Korrekturen | `57ce4e6` | live |
| UI-Splits (Kiosk/Timesheet/Equipment/Worker), App-Icon, Foto-Feinschliff | `1c4cd51` … `8fd0b49` | live |
| Release-Tag **v1.0.1** | `27f1f23` … | live |

**Nächste Cloud-Aufträge:**
- `#20` Google Calendar Phase 1 – Spec startklar in `claude-arbeitsitems-20-google-calendar.md`
- `#24` KI-Kontakt-/Interessenten-Import – **umgesetzt** (2026-08-27)

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
- **Google Contacts:** Config unter **Einstellungen → Google Contacts**; SA/Impersonation von **Speicher & Cloud**
- **Google Calendar:** Phase 1 (Office → Google, ein Workspace-Konto) – Auftrag `#20`

**2026-08-21 – Contacts produktiv:**
- People API + DWD `contacts` bereits OK (Prod-Test)
- `google_contacts_enabled=true` gesetzt; Impersonation `vivahome@vivahome.de`
- SA: `office-drive-sync@vivahome-office.iam.gserviceaccount.com`

**2026-08-24 – Kiosk #21a–c + 1.0.0:**
- Clock-In nur mit gültiger Projektzuweisung (Datum)
- Monteur-PIN: Kiosk-Freigabe + validFrom/validTo
- Baustellenfoto: Kommentar wird ins Bild eingebrannt
- Master-Monteur, Stundenzettel-Bearbeitung, Backup Berlin, Seed nicht in Prod-Start
- Release-Tag **v1.0.0** (Ende Beta / Produktivstart)

**Noch zu tun (Priorität):**
1. **Google Admin (manuell, Voraussetzung für #20-Test):** Calendar API aktivieren + DWD-Scope `https://www.googleapis.com/auth/calendar` für SA `office-drive-sync@vivahome-office.iam.gserviceaccount.com`
2. **Cloud-Auftrag `#20`** – Termine + Sync Office → Google (`claude-arbeitsitems-20-google-calendar.md`) – Spec startklar
3. Phase 2 optional: Rück-Sync / Kalender pro Mitarbeiter
4. Optional: UNIT_BASED-Abrechnung aus geprüften Arbeitsitems
5. Optional später: Kiosk-Konfig im Office (statt nur Tablet-Setup)

~~#22 Master-Tätigkeitsbereiche~~ ✅ · ~~#23 Stempeluhr Zeitraum / Pause / Korrekturen~~ ✅ (in v1.0.1)

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

## ~~3. Google Contacts~~ ✅ 2026-08-21

**App-Seite:** Einstellungen → Google Contacts (`/settings/contacts`)  
People API + DWD `contacts` OK; Sync-Flag auf Prod aktiv. Pro Kontakt Checkbox `syncToGoogle`.

---

## 3b. Google Calendar – Phase 1 (Auftrag #20)

**Google Admin (manuell):** Calendar API + DWD-Scope `https://www.googleapis.com/auth/calendar` für SA `office-drive-sync@vivahome-office.iam.gserviceaccount.com`  
**App:** siehe `claude-arbeitsitems-20-google-calendar.md`  
**Phase 2:** Rück-Sync / Kalender pro User – bewusst später

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
- Google Calendar Phase 2 (Rück-Sync, Kalender pro Mitarbeiter)
- Weitere God-File-Feinschliffe außer bei Bedarf
- Multi-Tenant `tenantId`

---

## Wiederaufgreifen

In Cursor: Rule **„Office Offener Backlog“** aktivieren / @-erwähnen, oder diese Datei öffnen.
