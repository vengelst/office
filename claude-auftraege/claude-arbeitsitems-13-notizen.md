# Cloud-Auftrag #13 – Self-Check / Notizen

## Fortschritt-Technik (gewählt)

**IndexedDB-Queue + FIFO-Sync:** Stempel-Events (`CLOCK_IN`/`CLOCK_OUT`) landen bei Netzfehler in IndexedDB (`office-offline-clock`). Sync bei `online` / Focus / `visibilitychange` / 45 s-Intervall, **ein** Request gleichzeitig. Server-Idempotenz über `TimeEntry.clientEventId` (UUID v4, unique, optional).

## Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Offline Clock-In Worker-Dashboard + Kiosk → lokal, UI eingestempelt + „ausstehend“ | ✅ | `offlineAwareClockIn` + Banner + optimistischer Status |
| 2 | Online danach → TimeEntry mit `occurredAtClient`; Queue leer | ✅ | FIFO-Sync entfernt Eintrag nach 200/Idempotent-OK |
| 3 | Doppel-Sync / Retry → kein zweiter IN (gleiche `clientEventId`) | ✅ | `findByClientEventId` + Unique P2002-Replay |
| 4 | Clock-Out offline nach lokalem IN → Paarung + Brutto plausibel | ✅ | Queue FIFO; OUT wartet hinter IN |
| 5 | Online-Happy-Path unverändert schnell | ✅ | Kein Queue-Umweg bei sofortigem 200 |
| 6 | API ohne `clientEventId` (alte APK) funktioniert | ✅ | Feld optional; Alt-Pfad unverändert |
| 7 | Work-Items / PL-Kiosk unverändert; SW cached keine API | ✅ | SW: `/api/**` nie; Shell nur Navigation |
| 8 | `@office/api` + `@office/web` Build grün | ✅ | siehe Build-Hinweis |
| – | Kein Offline-Items / PL / Mobile-APK-UI | ✅ | Out of Scope |

## Geänderte Dateien

### Neu
- `prisma/migrations/20260809190000_add_time_entry_client_event_id/migration.sql`
- `apps/web/src/lib/offline-clock-queue.ts`
- `apps/web/src/components/offline-clock-banner.tsx`
- `claude-auftraege/claude-arbeitsitems-13-notizen.md`

### Erweitert
- `prisma/schema.prisma` – `TimeEntry.clientEventId String? @unique`
- `apps/api/src/time-entries/dto/clock-in.dto.ts` / `clock-out.dto.ts` – optionales `clientEventId`
- `apps/api/src/time-entries/time-entries.service.ts` – Idempotent Replay + Konflikt-Regeln
- `apps/web/src/lib/timesheets.ts` – `workerApi`/`kioskApi` clockIn/Out → Offline-Wrapper
- `apps/web/src/app/worker-app/dashboard/page.tsx` – Banner, optimistischer Status, Toast
- `apps/web/src/app/kiosk/terminal/page.tsx` – Banner, Offline-Confirm
- `apps/web/src/lib/texts.ts` – `offlineClock.*`, `savedPending`
- `apps/web/public/sw.js` – Cache `vh-shell-v2`, Shell-Routen, nie `/api/**`

## Testpfad (Produktion nach Deploy)

1. Chrome DevTools → Network Offline → Worker-App (vorher online PIN) → Ein → Banner „ausstehend“ → Online → Live-Stempeluhr prüfen
2. Kiosk `/kiosk/terminal` ebenso mit festem Projekt
3. Sync zweimal auslösen → nur ein `TimeEntry` mit gleicher `clientEventId`
4. Token löschen bei wartender Queue → Hinweis „Bitte erneut anmelden – Stempelungen warten“
5. Alte APK / Request ohne `clientEventId` → weiterhin OK

## Bewusst nicht

- Offline Arbeitsitems / Fotos / PDF
- Offline-PIN / Projektkatalog
- Kunden-PL-Kiosk Offline
- Background Sync API / Push
- Mobile-APK-UI
- Batch-Endpoint `POST /time-entries/sync`
