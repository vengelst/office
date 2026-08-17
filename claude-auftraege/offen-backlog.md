# Office – Offener Backlog (später aufgreifen)

Stand: 2026-08-17 · Time-Entries-Rollen geschlossen; Rest bleibt offen.

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

## 2. PIN-Login härten

**Problem:** PIN-Login lädt alle aktiven PIN-Hashes und vergleicht sequentiell mit bcrypt → skaliert schlecht, CPU-lastig.

**Ziel:**
- Lookup ohne Full-Scan (z. B. Worker-/User-Zuordnung vor Compare, oder kurzer Index + Rate-Limit)
- Enges Rate-Limit pro IP/Gerät beibehalten/verschärfen
- Kein Breaking Change am PIN-Flow für Kiosk/Monteur
- Klartext `pinPlain` bleibt Büro-Anzeige; Login weiter über Hash

**Einstieg:**
- `apps/api/src/auth/auth.service.ts` (`pinLogin` / `userPinLogin`)
- Worker-PIN / User-PIN Models (Indexes für `isActive` bereits vorhanden)

---

## 3. Produktisierung Managed Single-Tenant (Install / AVV / License später)

**Variante A:** Eine Instanz pro Kunde (eigene DB, MinIO, Domain, Secrets).

| Teil | Status | Hinweis |
|------|--------|---------|
| Feature-Flags (DB) | erledigt (#18) | Module pro Instanz freischalten |
| Install-/Update-Skript | offen | Docker Compose + `install.sh` / `update.sh` für Kunden-Linux |
| AVV-Vorlage | offen | Vertrag Auftragsverarbeitung (Hosting) |
| Support-Zugang | offen | kein Backdoor; optional freischaltbarer Support-Admin |
| LicenseKey / LicenseServer | später | erst bei Self-Host / Missbrauchsrisiko |

**Keine Multi-Tenant-Shared-DB** vorerst – Isolation = getrennte Stacks.

---

## Optional später (nicht priorisiert)

- Kunden-PL-Kiosk ebenfalls DE/SK/SL
- Mobile-App: Locale-Umschalter statt immer DE/SK dual; SL ergänzen
- UX: Hinweis, wenn Zuweisung erst in der Zukunft startet („erst ab … stempelfähig“)

---

## Bewusst nicht jetzt

- Weitere God-File-Feinschliffe außer bei Bedarf
- Online-Lizenzserver
- Multi-Tenant `tenantId`

---

## Wiederaufgreifen

In Cursor: Rule **„Office Offener Backlog“** aktivieren / @-erwähnen, oder diese Datei öffnen und Cloud-Auftrag daraus formulieren.
