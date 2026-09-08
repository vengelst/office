# Cloud-Auftrag #36: Expo-Mobile Phase 1 – Stempel-Parität (Android)

## Kontext

Entscheidung: **bestehende Expo-App** (`apps/mobile`, „VH Kiosk“) ausbauen – keine zweite App.  
Web-Kiosk bleibt für Tablet. Geofence = **Phase 2 später** (nicht dieser Auftrag).

Plan: `claude-auftraege/plan-expo-mobile-phase1-2.md`

**Ist:** PIN-Login, Clock-In/Out + GPS, Projektwahl, #30 Arbeitsdoku, Fotos, Work-Items, EAS Android-APK → Prod-API.

**Fehlt vs. Worker-Web:** Tätigkeiten (#34), Stundenzettel-Signatur (#33), periodischer GPS-Ping, Pause-UI, klare Stempel-Lock-Fehler.

## Ziel Phase 1

Monteure erledigen den Arbeitstag **vollständig in der Expo-App (Android)** gegen Prod-API.

1. Tätigkeiten: Pflicht/Wechsel bei Master oder `HOURLY_PACKAGE` (gleiche Gate-Logik wie Web `#34`)
2. Stundenzettel: Liste + Detail + digitale Unterschrift (`WORKER`)
3. Periodischer GPS-Ping während aktiver Schicht (Intervall aus Public-Kiosk-Settings wie Web)
4. Pause Start/Ende, falls API schon existiert – UI anbinden
5. Stempel-Lock / API-Fehler (409) verständlich anzeigen
6. Bestehendes (Clock, #30, Fotos, Work-Items) darf nicht regressieren
7. **Kein iOS** in diesem Auftrag (Phase 1b später); `platforms: ["android"]` belassen
8. **Kein Geofence**

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Scope Plattform | **nur Android** |
| Backend | Bestehende Endpoints; nur Mobile-Client erweitern (außer Bugfixes) |
| Gate Tätigkeiten | Wie Web: `masterEngineer` **oder** `billingMode === 'HOURLY_PACKAGE'` |
| Signatur | `POST /timesheets/:id/sign` nur `signerType: WORKER`; Canvas per Touch (react-native-svg / Skia / View-basiert – pragmatisch wählen) |
| API-Base | `EXPO_PUBLIC_API_URL` / EAS Prod `https://office.vivahome.de/api` |
| Navigation | Dashboard + neuer Bereich „Stundenzettel“; Tätigkeits-Select auf Stempel-Screen |

## Technische Hinweise

- `apps/mobile/lib/api.ts` um: activity-types, switch-activity, break, timesheets list/get/sign, billingMode an Assignments/Status (API liefert das schon für Web – Me/Status prüfen und typisieren)
- Gate-Util analog `apps/web/src/lib/activity-gate.ts` nach Mobile spiegeln (kleine shared Kopie ok)
- GPS-Ping: Hook analog `use-periodic-gps-ping` → `recordWorkerGps` / bestehendes `location.ts`
- Signatur: PNG/Base64 wie Web-DTO `signatureBase64`
- Version App: Patch erhöhen (z. B. 1.1.0 → 1.2.0) in `app.json` + `package.json`

## Akzeptanzkriterien

1. Clock-In ohne Tätigkeit auf HOURLY_PACKAGE → Fehler; mit Tätigkeit → ok + `currentActivity` sichtbar
2. switch-activity während Schicht funktioniert; in Pause disabled oder API-konform
3. Stundenzettel-Liste zeigt eigene Sheets; Signatur → `WORKER_SIGNED`; erneutes Stempeln derselben KW → klare Fehlermeldung
4. Während `clockedIn`: GPS-Pings in konfiguriertem Intervall
5. Pause-Buttons wenn API vorhanden und Status Pause kennt
6. #30 Modal nach Clock-Out weiter
7. `pnpm`/Typecheck Mobile grün; PR mit Testplan
8. Kein Prod-Docker nötig für reine Mobile-Änderungen; falls API-Touch: Deploy wie üblich mit `--env-file .env.production`

## Nicht in Scope

- iOS / App Store / TestFlight
- Geofence, Background „Immer“-Location für Zaun
- Web-Kiosk ersetzen
- Offline-Queue für switch-activity (wie Web: online)

## Tests

- Wo sinnvoll: kleine Unit-Tests für Gate-Kopie
- Manueller Testplan im PR (Android Emulator oder Gerät)

## Bezug

- P2 `#33`, P3 `#34` APIs bereits Prod
- Plan Phase 2 Geofence: erst nach stabiler Phase 1
