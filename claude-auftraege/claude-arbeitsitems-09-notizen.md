# Cloud-Auftrag #9 – Self-Check / Notizen

## Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Büro kann Kunden-PL-User eine PIN setzen | ✅ | `PUT /users/:id/pin` + PIN-Button in Kunden-PL-Section (Projekt-Tab Arbeitsitems) |
| 2 | Kiosk-Setup Modus „Kunden-PL" + Projekt | ✅ | `KioskConfig.mode: 'worker' | 'customer_pl'`, Setup-UI mit Mode-Toggle |
| 3 | PIN → nur bei gültigem CUSTOMER_PL + Zuordnung sinnvoll nutzbar | ✅ | `POST /auth/user-pin-login` prüft aktive UserPin + Rolle CUSTOMER_PL |
| 4 | Liste der eingereichten Wochenzettel des Projekts | ✅ | Kiosk-PL zeigt `GET /timesheets?projectId=X&status=SUBMITTED` |
| 5 | Stunden-Tabelle sichtbar | ✅ | Detail-Ansicht mit Tagen, Brutto/Pause/Netto, Wochensumme |
| 6 | Digitale Unterschrift + Approve; PDF enthält Unterschrift | ✅ | SignatureCanvas → `sign(CUSTOMER)` → `approve`; bestehende PDF-Logik greift |
| 7 | Worker-Kiosk unverändert | ✅ | Separate Route `/kiosk/pl`, Terminal leitet bei `mode=customer_pl` um |
| 8 | PINs Worker/PL kollidieren nicht | ✅ | Globale Eindeutigkeit bei Worker-setPin und User-setPin per bcrypt-Vergleich |

## Geänderte Dateien

### Prisma / Backend
- `prisma/schema.prisma` – UserPin-Modell + User.pins Relation
- `prisma/migrations/20260809100000_add_user_pin/migration.sql` – DDL
- `apps/api/src/auth/auth.service.ts` – `userPinLogin()` Methode
- `apps/api/src/auth/auth.controller.ts` – `POST /auth/user-pin-login` Endpoint
- `apps/api/src/users/users.controller.ts` – `PUT /users/:id/pin` Endpoint
- `apps/api/src/users/users.service.ts` – `setPin()` mit globaler Eindeutigkeit
- `apps/api/src/workers/workers.service.ts` – globale PIN-Eindeutigkeit bei Worker-PIN

### Frontend
- `apps/web/src/lib/texts.ts` – `texts.kiosk.pl.*` + `texts.projects.workItems.customerPls.setPin/pin*`
- `apps/web/src/app/kiosk/setup/page.tsx` – `KioskMode` Typ, Mode-Toggle, Routing
- `apps/web/src/app/kiosk/terminal/page.tsx` – Redirect bei `mode=customer_pl`
- `apps/web/src/app/kiosk/pl/page.tsx` – **NEU**: Kunden-PL Kiosk-Terminal
- `apps/web/src/components/projects/tabs/work-items/customer-pls-section.tsx` – PIN-Button + Dialog

## Testpfad

1. **Admin: PIN setzen**
   - Projekt öffnen → Tab „Arbeitsitems" → Kunden-PL Section
   - KeyRound-Icon klicken → 6-stellige PIN eingeben → Speichern

2. **Kiosk Setup**
   - `/kiosk/setup` → Modus „Kunden-PL" wählen → Projekt + Admin-PIN → Starten
   - Leitet zu `/kiosk/pl`

3. **Kiosk PL: Anmelden**
   - PIN-Pad: 6-stellige Kunden-PL PIN eingeben
   - Login via `POST /auth/user-pin-login`
   - Token in separatem Key `office_kiosk_pl_token`

4. **Timesheets sichten**
   - Liste zeigt SUBMITTED-Stundenzettel des Projekts
   - Tippen → Detail mit Tages-Tabelle

5. **Unterschreiben & abzeichnen**
   - SignatureCanvas ausfüllen → „Unterschreiben & abzeichnen"
   - Ruft `sign(CUSTOMER)` + `approve` auf
   - Bestätigungsscreen → Auto-Logout

6. **Worker-Kiosk prüfen**
   - Setup Modus „Monteur" → `/kiosk/terminal` funktioniert wie bisher

## Offene Punkte / Bewusst nicht implementiert

- **Seed-Daten**: Kein automatischer Seed für Test-PIN (manuell über Admin-UI setzen)
- **APPROVED read-only**: In der Liste werden nur SUBMITTED-Zettel gezeigt (Spec sagt „ggf. auch APPROVED read-only anzeigen" – kann bei Bedarf ergänzt werden)
- **Keine Mobile-APK-Änderung** (wie gefordert)
