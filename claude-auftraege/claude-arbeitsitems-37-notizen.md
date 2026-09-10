# #37 Notizen – Personal-App statt Kiosk (Phase 1)

**Branch:** `cursor/37-personal-app-statt-kiosk-2fc9`  
**Spec:** `claude-arbeitsitems-37-personal-app-statt-kiosk.md`

## Phase 1 geliefert

1. **Live-Anwesenheit (scoped)**  
   - API: `GET /time-entries/live/scoped?projectId=`  
   - Rollen: `WORKER`, `CUSTOMER_PL`  
   - Scope: Worker → `ProjectAssignment` (+ eigenes aktuelles Projekt); PL → `ProjectCustomerPlAssignment`  
   - Response inkl. optionaler `activity`  
   - UI: Worker-Dashboard + Kunden-PL `/pl` (Komponente `LivePresenceList`)

2. **CUSTOMER_PL ohne Kiosk**  
   - PIN-Login: `/pl/login` via `POST /auth/user-pin-login`  
   - Link von Worker-PIN-Seite und Kiosk-Landing  
   - E-Mail-Login → `/pl` auch auf `work.*` (nicht mehr Kiosk-Setup)

3. **Kiosk weich abgekündigt**  
   - Soft-Landing auf `/kiosk` mit Banner + Links  
   - Setup mit „Veraltet / Notfall“-Hinweis  
   - Middleware erlaubt `/worker-app` und `/pl*` auf `work.vivahome.de`

4. **Tests**  
   - Unit: `apps/api/src/time-entries/live-scoped.spec.ts` (Scope + Forbidden)

## Web ↔ Android Checkliste

| Feature | Web Personal-App | Android (`apps/mobile`) | Phase |
|--------|------------------|-------------------------|-------|
| PIN-Login Worker | ✅ `/worker-app` | ✅ | 1 |
| Stempeln + GPS | ✅ | ✅ | 1 |
| Tätigkeit (MIXED/HOURLY) | ✅ | ✅ | 1 |
| Timesheet-Signatur Worker | ✅ | ✅ | 1 |
| Work-Items | ✅ | ✅ | 1 |
| **Live-Anwesenheit** | ✅ scoped API + UI | ❌ konsumiert API noch nicht | **2** |
| PL/Kunde PIN + Approve | ✅ Web `/pl` | Web-PWA reicht | 2 optional |

## Phase 2 (Follow-up)

- Live-Anwesenheit in Android (API bereits scoped, nur UI/Client)
- UX-Angleich Worker-Web ↔ Android (Texte, Leerzustände)
- Optional Feature-Flag: Kiosk-Terminal aus

## Phase 3 (Follow-up)

- Hard-Delete `/kiosk/**` bzw. Redirect-only
- Nginx/`work.` auf Personal-App-Login
- Toter Code + E2E-Kiosk-Tests entfernen

## Regression bewusst unangetastet

- Clock-In/Out, MIXED-Tätigkeitsgate, Worker-Timesheet-Signatur, PL-Approve
