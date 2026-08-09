# Cloud-Auftrag #16: Performance – texts splitten, lazy Tabs, Documents/Submissions Pagination

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de` (`/opt/office`).

Code-Review (2026-08-10) hat drei priorisierte Performance-/Wartungsthemen ergeben:

1. `apps/web/src/lib/texts.ts` (~2708 Zeilen) – Monolith, Merge-Konflikte, kein Domain-Splitting
2. Detailseiten laden alle Tabs eagerly (kein `next/dynamic`) → große Client-Chunks
3. `DocumentsService.findAll` und `SubmissionsService.findAll` ohne Pagination → unbounded Responses

**Produktionsstatus:** Stack läuft (web/api/postgres/minio healthy). Kein Feature-Umbau – nur Wartung/Performance.

---

## Ziel

Nach Abschluss:

1. **texts** in Domain-Module unter `apps/web/src/lib/texts/` geschnitten; `texts.ts` bleibt als kompatibler Aggregator (`export const texts = {…}`), bestehende `import { texts } from '@/lib/texts'` funktionieren weiter.
2. **Customer- und Project-Detail** laden Tabs per `next/dynamic` (ssr: false wo nötig), mit schlankem Loading-Fallback.
3. **Documents-Liste** und **Submissions-Liste** paginiert analog Kundenliste (`page`/`limit`/`total`/`totalPages`, Cap ≤100).
4. Web-Clients (`documents.ts`, Documents-UI, Submissions-UI) an die neue Response-Form angepasst – **kein** Breaking ohne Adapter.

---

## Nicht-Ziele

- PIN-Login-Umbau / Time-Entries-Rollen (separater Auftrag)
- God-Services (invoices/timesheets/projects) splitten
- LicenseKey / Feature-Flags / Multi-Tenant
- Mobile-App außer wenn Build wegen Shared Types bricht
- Komplette Migration aller 100+ Dateien auf Domain-Imports (optional nur bei angefassten Detail-Pages)

---

## 1. texts.ts splitten

### 1.1 Struktur

```
apps/web/src/lib/texts/
  index.ts          # optional re-exports
  app.ts            # app, nav, login, header, common, map
  dashboard.ts
  customers.ts
  projects.ts
  workers.ts
  subcontractors.ts
  teams.ts
  timesheets.ts
  customer-pl.ts
  time-clock.ts
  invoices.ts
  break-rules.ts
  worker-app.ts
  offline-clock.ts
  settings.ts
  vehicles.ts
  documents.ts
  kiosk.ts
  equipment.ts
  communication.ts
  todos.ts
```

Top-Level-Keys aus aktuellem `texts`-Objekt (Zeilen-Orientierung):

| Key | ca. Start |
|-----|-----------|
| app, nav, login, header | 6–47 |
| dashboard | 48 |
| customers | 99 |
| projects | 384 |
| workers | 883 |
| subcontractors | 1129 |
| teams | 1230 |
| timesheets | 1277 |
| customerPl | 1433 |
| timeClock | 1563 |
| invoices | 1579 |
| breakRules | 1804 |
| workerApp | 1849 |
| offlineClock | 1894 |
| settings | 1908 |
| vehicles | 2119 |
| documents | 2263 |
| kiosk | 2388 |
| map | 2482 |
| equipment | 2489 |
| communication | 2602 |
| todos | 2645 |
| common | 2702 |

### 1.2 Aggregator

`apps/web/src/lib/texts.ts` (oder `texts/index.ts` + Re-Export aus bisherigem Pfad):

```ts
import { app, nav, login, header, common, map } from './texts/app';
import { dashboard } from './texts/dashboard';
// …
export const texts = {
  app, nav, login, header, dashboard, customers, /* … */ common,
};
```

**Pflicht:** `import { texts } from '@/lib/texts'` muss unverändert funktionieren (tsconfig paths prüfen).

### 1.3 Qualität

- Keine Textänderungen (1:1 verschieben)
- Keine neuen Dependencies
- Typecheck / Next-Build muss grün sein

---

## 2. Lazy Tabs auf Detailseiten

### 2.1 Scope (mindestens)

- `apps/web/src/app/(authenticated)/customers/[id]/page.tsx`
- `apps/web/src/app/(authenticated)/projects/[id]/page.tsx`

Optional (wenn wenig Aufwand, gleiche Pattern):

- `workers/[id]/page.tsx`
- `subcontractors/[id]/page.tsx`

### 2.2 Pattern

```tsx
import dynamic from 'next/dynamic';

const ContactsTab = dynamic(
  () => import('@/components/customers/tabs/contacts-tab').then((m) => m.ContactsTab),
  { loading: () => <Skeleton className="h-40 w-full" />, ssr: false },
);
```

- Nur **Tab-Inhalte** lazy, nicht Page-Shell / Formular des aktiven Master-Tabs (Master darf eager bleiben).
- Named Exports korrekt auflösen (`.then(m => m.X)`).
- Keine Verhaltensänderung der Tabs.

---

## 3. Documents Pagination

### 3.1 API

Datei: `apps/api/src/documents/documents.service.ts` → `findAll`

Analog `CustomersService.findAll`:

```ts
page?: number;   // default 1
limit?: number;  // default 25, max 100
// bestehende Filter: entityType, entityId, folderId, documentType, search
```

Return:

```ts
{ data, total, page, limit, totalPages }
```

Controller `GET /documents`: Query-Params `page`, `limit` durchreichen.

**Sonderfall Entity-Listen** (`findByEntity` / Tabs mit `entityType`+`entityId`):

- Ebenfalls paginiert **oder** für Entity-Context höheren Default (`limit` default 50) – aber immer Cap 100.
- Frontend Documents-Tab muss Paginierung (oder „Mehr laden“) unterstützen.

`expiring()` darf vorerst unpaginiert bleiben (kleine Menge), aber `take: 100` als Safety-Cap setzen.

### 3.2 Web

- `apps/web/src/lib/documents.ts`: Typ `PaginatedDocuments`, `list()` anpassen.
- `documents-tab-v2.tsx`, globale Documents-Page, ältere `documents-tab.tsx` falls noch genutzt: Response `.data` nutzen; einfache Pagination-UI (wie Kundenliste) oder Infinite „Mehr laden“.
- **Rückwärtskompatibilität:** Wenn UI noch Array erwartet, Adapter in `list()`:

```ts
// bevorzugt: immer Paginated zurückgeben und UI anpassen
```

UI **muss** angepasst werden – kein silent Array-Break.

---

## 4. Submissions Pagination

### 4.1 API

`apps/api/src/submissions/submissions.service.ts` `findAll`:

- Params: `customerId?`, `status?`, `page?`, `limit?` (default 25, max 100)
- Return: `{ data, total, page, limit, totalPages }`

Controller Query-Params ergänzen.

### 4.2 Web

- Submissions-Tab / Search-Dialog / API-Client anpassen.
- Bei Kunden-Detail mit typisch wenigen Ausschreibungen: default limit 50 ok, trotzdem paginiert.

---

## 5. Abnahme

- [ ] `pnpm --filter @office/web build` bzw. Typecheck grün
- [ ] `pnpm --filter @office/api build` grün
- [ ] `import { texts } from '@/lib/texts'` weiterhin gültig; keine fehlenden Keys
- [ ] Customer-/Project-Detail: Tabs laden lazy (Network: separate Chunks beim Tab-Wechsel oder beim Mount der dynamischen Imports)
- [ ] `GET /api/documents?page=1&limit=25` liefert Meta + `data`
- [ ] `GET /api/submissions?page=1&limit=25` analog
- [ ] Documents-UI und Submissions-UI zeigen weiterhin Daten, kein leeres Array durch `.data`-Vergessen
- [ ] Commit auf Feature-Branch, PR gegen `main` mit kurzer Summary

---

## Deploy-Hinweis

Nach Merge: wie üblich auf Server  
`git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d`  
(Deploy macht der Betreiber / Folge-Agent nach Review – Cloud-Agent merged nicht selbst nach `main` ohne Auftrag.)

---

## Reihenfolge der Umsetzung

1. texts split (rein mechanisch, hoher Konflikt-Nutzen)
2. Documents + Submissions Pagination (API zuerst, dann Web)
3. dynamic() Tabs Customer + Project
4. Smoke: Build + manuelle Logik-Prüfung der Response-Shapes
