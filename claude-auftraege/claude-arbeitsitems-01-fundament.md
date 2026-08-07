# Claude Code – Auftrag #1: Arbeitsitems Fundament (DB + API)

## Kontext

Repo: Office-Monorepo (`apps/api` NestJS, `apps/web` Next.js, `apps/mobile` Expo, `prisma/`).  
Produktion läuft; bestehende Module nicht regressiv brechen.

**Spezifikation (verbindlich):** `SPEZ-arbeitsitems.md`  
**Beispiel-Import:** `arbeitsitems-import-beispiel.xlsx` (Blätter `Items` + `Material`)

Dieser Auftrag ist **nur Fundament**: Prisma-Schema + Migration + NestJS-API.  
**Kein** Web-UI, **kein** Mobile-UI, **keine** Abrechnungslogik, **kein** PDF-OCR.

---

## Ziel

Nach Abschluss muss die API:

1. Item-basierte Projekte modellieren und speichern können
2. Items + Material aus der Beispiel-Excel importieren können
3. Kern-Statusübergänge und Zuordnungen per API unterstützen
4. Item-Zeitsessions starten/stoppen können (Grundlage für spätere App)

---

## 1. Prisma – Enums & Schema

### 1.1 RoleCode erweitern

```prisma
enum RoleCode {
  SUPERADMIN
  OFFICE
  PROJECT_MANAGER
  WORKER
  CUSTOMER_PL   // NEU – Kunden-Projektleiter, getrennt von intern
}
```

Seed/Migration: Rolle `CUSTOMER_PL` anlegen (Name z. B. „Kunden-PL“).

### 1.2 Neue Enums

```prisma
enum WorkItemStatus {
  OPEN          // Offen
  IN_PROGRESS   // In Arbeit
  REVIEW        // Kontrolle
  REWORK        // Nacharbeit
  APPROVED      // Geprüft
}

enum WorkItemReportType {
  COMPLETED     // Fertigmeldung
  REWORK        // Nacharbeit
}

enum WorkItemReviewAction {
  APPROVE       // Geprüft / OK
  FORCE_COMPLETE // PL setzt selbst fertig
}
```

### 1.3 Project erweitern

- `itemBased Boolean @default(false)` – Projekt arbeitet mit Work Items
- Relation zu Blocks, WorkItems, CustomerPlAssignments

### 1.4 Neue Modelle (Felder mindestens wie spezifiziert)

**ProjectBlock**
- id, projectId, blockKey (unique je project), name?, pdfDocumentId? (optional String-Ref auf Document-ID), createdAt, updatedAt
- @@unique([projectId, blockKey])

**WorkItem**
- id, projectId, blockId?
- itemKey (unique je project)
- title?
- floor?, area?, room?, type?, rc?, detail?
- planPage Int?, sheetNo Int?, sheetTotal Int?
- pdfFile?, pdfPage Int?
- workScopeDe?, workScopeSk?
- status WorkItemStatus @default(OPEN)
- importedAt DateTime?, createdAt, updatedAt
- @@unique([projectId, itemKey])
- Indexes: projectId+status, blockId, itemKey

**WorkItemMaterial**
- id, workItemId
- sortOrder Int @default(0)
- qty String?          // "1", "2", "n. Detail"
- qtyUnit String?      // "Stk.", "Satz"
- materialDe String
- materialSk String?
- createdAt DateTime @default(now())
- Index workItemId

**ProjectCustomerPlAssignment**
- id, projectId, userId
- active Boolean @default(true)
- createdAt
- @@unique([projectId, userId])
- user muss Rolle CUSTOMER_PL haben (in Service validieren)

**WorkItemAssignment**
- id, workItemId, workerId
- startedAt DateTime @default(now())
- endedAt DateTime?
- active Boolean @default(true)
- @@index([workItemId, active])
- @@index([workerId, active])

**WorkItemSession**
- id, workItemId, workerId
- startedAt DateTime
- endedAt DateTime?
- // Dauer = endedAt - startedAt wenn endedAt gesetzt
- @@index([workItemId, workerId])
- @@index([workerId, endedAt])

**WorkItemReport**
- id, workItemId, workerId
- type WorkItemReportType
- comment String?
- reportedAt DateTime @default(now())
- // Fotos: über DocumentLink entityType=WORK_ITEM_REPORT entityId=report.id
- // oder WorkItemReportPhoto mit documentId – wähle konsistent zum bestehenden Document-System

**WorkItemReview**
- id, workItemId, reviewerUserId
- action WorkItemReviewAction
- comment String?
- reviewedAt DateTime @default(now())

Relationen in `User`, `Worker`, `Project`, `DocumentLink` (entityType um `WORK_ITEM` / `WORK_ITEM_REPORT` erweitern, falls Enum/String-Konvention) sauber einhängen.

---

## 2. Domänenregeln (API muss erzwingen)

Aus `SPEZ-arbeitsitems.md`:

1. **Nehmen:** Worker nimmt Item → Assignment aktiv, Status `IN_PROGRESS` (wenn vorher OPEN oder freigegeben).
2. **Mehrere Monteure:** erlaubt. **Eine** Fertigmeldung reicht → alle aktiven Assignments enden, Status `REVIEW` (Variante B).
3. **Fertigmeldung:** mind. **2 Fotos** (besser 2–3) Pflicht; sonst 400.
4. **Nacharbeit:** Status `REWORK`, Assignments bleiben aktiv beim/den Monteuren.
5. **PL APPROVE:** Status `APPROVED`, alle Assignments beenden.
6. **PL FORCE_COMPLETE:** Status `APPROVED`, Assignments beenden.
7. **Aktuelles Item / Session:**  
   - `POST .../sessions/start` beendet ggf. offene Session desselben Workers und startet neue.  
   - `POST .../sessions/stop` oder Clock-Out-Hook: offene Sessions enden.  
   - Für Auftrag 1: explizite start/stop Endpoints reichen; optional Clock-Out in `time-entries` so erweitern, dass offene WorkItemSessions des Workers geschlossen werden (wenn wenig invasiv).
8. Item-Zeit läuft **nicht** über Nacht ohne Session.

---

## 3. NestJS-Modul

Neues Modul `apps/api/src/work-items/` (oder `project-work-items/`):

- `work-items.module.ts`
- Controllers sinnvoll splitten z. B.:
  - Blocks, Items, Materials, Import, Assignments, Sessions, Reports, Reviews, Customer-PL assignments
- Services mit Prisma
- DTOs mit class-validator
- In `app.module.ts` registrieren

### Empfohlene Endpoints (REST, Prefix `/api`)

**Büro / Admin (JWT + OFFICE/SUPERADMIN/PROJECT_MANAGER):**

- `PATCH /projects/:id` um `itemBased` setzen zu können (bestehenden Projects-Controller erweitern, nicht doppelt)
- `POST /projects/:projectId/blocks`
- `GET /projects/:projectId/blocks`
- `PATCH /projects/:projectId/blocks/:blockId` (pdfDocumentId/pdfFile setzen)
- `POST /projects/:projectId/work-items/import` – multipart: Excel/CSV Items + optional Material sheet/file
- `GET /projects/:projectId/work-items` – Filter: status, blockKey, q=itemKey
- `GET /work-items/:id` – inkl. materials, active assignments, latest reports
- `POST /projects/:projectId/customer-pls` – body `{ userId }`
- `GET /projects/:projectId/customer-pls`
- `DELETE /projects/:projectId/customer-pls/:userId`

**Worker (bestehende Worker-Auth / JWT je nach Projektkonvention – an `worker-auth` / time-entries anlehnen):**

- `POST /work-items/:id/claim` – nehmen
- `POST /work-items/:id/sessions/start` – aktuelles Item
- `POST /work-items/:id/sessions/stop`
- `POST /work-items/:id/reports/complete` – multipart/Fotos oder documentIds; min 2 Fotos
- `POST /work-items/:id/reports/rework` – comment optional, Fotos optional
- `GET /workers/me/work-items` – aktive + offene des Projekts (sinnvoll filtern)

**Kunden-PL (JWT, Rolle CUSTOMER_PL, nur zugewiesene Projekte):**

- `GET /pl/projects/:projectId/work-items` – Board-Daten
- `POST /work-items/:id/reviews/approve`
- `POST /work-items/:id/reviews/force-complete`

Auth-Guards/Roles wie im bestehenden Code (`Roles`, `RolesGuard`).  
Für Worker-Endpunkte bestehende Worker-JWT-Mechanismen wiederverwenden.

---

## 4. Import

- Endpoint akzeptiert `.xlsx` (Sheets `Items` + `Material`) und/oder CSV.
- Spalten exakt wie in SPEZ Abschnitt 11 / Beispiel-Excel.
- Upsert-Strategie: gleiches `(projectId, itemKey)` → update Metadaten; Materialzeilen für Item ersetzen oder merge (dokumentiere Wahl: **replace materials for item** ist ok).
- `blockKey` unbekannt → Block anlegen.
- Nach Import: status OPEN, keine Assignments.
- Dependency: `exceljs` oder `xlsx` im API-Paket – schlank halten.

**Manueller Nachweis:** Import von `arbeitsitems-import-beispiel.xlsx` gegen ein Testprojekt (Seed oder Script) dokumentieren / kurzes Script unter `apps/api/scripts/` oder README-Notiz im Modul.

---

## 5. Seed-Anpassungen

- Rolle `CUSTOMER_PL` seedén
- Optional: Demo-User `kunden-pl@office.local` mit dieser Rolle (Passwort analog Seed-Stil) – nur wenn Seed-Pattern das erlaubt
- Keine Massen-Items im Seed nötig, wenn Import getestet wird

---

## 6. Explizit NICHT in diesem Auftrag

- Keine Next.js-Seiten
- Keine Expo/Mobile-Änderungen
- Keine Wochen-Stundenzettel-UI-Änderungen (nur vorbereiten, falls ReviewerUser schon passt – nicht umbauen)
- Kein PDF-OCR
- Keine Rechnungsstellung aus APPROVED
- Keine Checklisten-UI

---

## 7. Qualitätsanforderungen

- TypeScript strikt, DTOs validiert
- Bestehende Builds: `pnpm --filter @office/api build` muss grün sein
- Prisma migrate mit sprechendem Namen z. B. `work_items_fundament`
- Kurze Modul-README oder Kommentar am Controller mit Endpoint-Übersicht
- Keine Secrets committen
- Code-Stil an bestehende Module anlehnen (customers/projects)

---

## 8. Abnahmekriterien

- [ ] Migration läuft clean
- [ ] Rolle `CUSTOMER_PL` existiert
- [ ] Beispiel-Excel importierbar → Items `05-A-01`, `05-A-02`, `05-B-01` + Materialzeilen in DB
- [ ] claim → IN_PROGRESS; complete mit <2 Fotos → 400; mit ≥2 Fotos → REVIEW und Assignments beendet
- [ ] rework → REWORK, Assignment bleibt
- [ ] approve / force-complete → APPROVED
- [ ] session start/stop speichert Intervalle
- [ ] API-Build erfolgreich

---

## 9. Vorgehen

1. Schema + Migration
2. Modul + Services + Controllers
3. Import implementieren und mit Beispiel-Excel verifizieren (lokal/Dev soweit möglich)
4. Kurz zusammenfassen was geändert wurde (Dateien, Endpoints)

Arbeite im Repo-Root `/Users/volkhardengelstadter/coding/office`.  
Änderungen committen ist dem Operator überlassen – **du commitest nicht**, außer der Operator fordert es explizit; hier: **bitte committen mit klarer Message**, Push macht Operator.

Ende Auftrag #1.
