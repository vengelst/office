# Claude Code – Auftrag #4: Kunden-PL Oberfläche (Web)

## Kontext

Aufträge #1–#3 sind live. Spez: `SPEZ-arbeitsitems.md` Abschnitte 4.2, 7, 9.  
API-PL-Endpoints existieren bereits (`apps/api/src/work-items/customer-pl-work-items.controller.ts`).

**Rolle:** `CUSTOMER_PL` – **eigene Rolle**, getrennt von internem `PROJECT_MANAGER`.  
Kein Zugriff auf internes Office außer was für PL-Prüfung und Wochen-Stundenzettel nötig ist.

---

## Ziel

Ein Benutzer mit Rolle `CUSTOMER_PL` kann nach Web-Login:

1. Nur seine zugewiesenen item-basierten Projekte sehen
2. Item-Board: offen / in Arbeit / Kontrolle / Nacharbeit / geprüft
3. Item in Kontrolle **prüfen (approve)** oder **selbst fertigsetzen (force-complete)**
4. Item-Detail inkl. Fotos der Fertigmeldung sehen
5. **Stundenzettel der Monteure je Woche abzeichnen** (approve) – nur Projekte, denen er als Kunden-PL zugeordnet ist

PIN für Kunden-PL: in diesem Auftrag **Web-Login (E-Mail/Passwort)** wie normale User. Worker-PIN bleibt Monteuren. (PIN für CUSTOMER_PL später optional.)

---

## 1. API – Stundenzettel für CUSTOMER_PL (nötig)

Aktuell: `TimesheetsController` nur `SUPERADMIN|OFFICE|PROJECT_MANAGER`.

Erweitern:

- `CUSTOMER_PL` darf:
  - `GET /timesheets` – **nur** Timesheets von Projekten mit aktiver `ProjectCustomerPlAssignment` für diesen User
  - `GET /timesheets/:id` – nur wenn Projekt zugewiesen
  - `POST /timesheets/:id/approve` – nur wenn Projekt zugewiesen
  - Optional PDF `GET` wenn bestehend und ungefährlich
- **Nicht** erlauben für CUSTOMER_PL: generate, delete/archive (falls destruktiv), beliebige Korrekturen an Tagen – außer approve ist spez-konform. Reject nur wenn bestehender Flow und spez nicht widerspricht; Spez sagt „abzeichnen“ → Fokus **approve**.

Service-seitig: Helper `assertCustomerPlProjectAccess(userId, projectId)` analog Work-Items wiederverwenden/teilen.

Work-Item-PL-Endpoints sind schon da – nur sicherstellen, dass Seed/Rolle und Guards passen.

---

## 2. Web – Navigation & Rechte

- Auth-Context: Rollen des Users auslesen (wie vorhanden)
- Sidebar für `CUSTOMER_PL` **stark eingeschränkt**, z. B. nur:
  - PL-Übersicht / Meine Projekte (neu)
  - Stundenzettel (gefiltert)
- Interne Nav-Punkte (Kunden, Settings, Rechnungen, …) **ausblenden**
- Direkte URL zu internen Seiten: API liefert 403; Frontend Redirect auf PL-Home wenn Rolle nur CUSTOMER_PL

---

## 3. Web – PL Item-Board

Neue Routen unter `apps/web/src/app/(authenticated)/…`, z. B.:

- `/pl` oder `/pl/projects` – Liste `GET /pl/projects`
- `/pl/projects/[projectId]` – Board `GET /pl/projects/:projectId/work-items`
  - Status-Zähler / Filter (OPEN, IN_PROGRESS, REVIEW, REWORK, APPROVED)
  - Tabelle/Cards: Kennung, Ort, Status, zugewiesene Monteure, letzte Meldung
- `/pl/work-items/[id]` oder Drawer:
  - Detail `GET /pl/work-items/:id`
  - Fotos anzeigen (Document-Download: ggf. Endpoint für CUSTOMER_PL freigeben **nur** für Fotos der Reports dieses Items / oder bestehende Download-Rechte erweitern projektbezogen – minimal & sicher)
  - Buttons: **Geprüft / OK** → `POST .../reviews/approve`
  - **Selbst fertigsetzen** → ConfirmDialog → `force-complete`
  - Nacharbeit: Hinweis „beim Monteur“, kein Pool-Reset durch PL außer force-complete/approve laut API

Texte in `texts.ts` (Abschnitt `customerPl` / `pl`).

Stil: bestehende shadcn-Patterns, Touch ≥44px, wie Büro-Work-Items-Tab.

---

## 4. Web – Stundenzettel-Abzeichnung

- Bestehende Timesheets-UI wiederverwenden wo möglich
- Für CUSTOMER_PL: Liste nur freigegebene Projekte; Detail mit **Abzeichnen/Approve**
- Keine Generieren-Buttons für CUSTOMER_PL

Falls die bestehende Seite zu „office-lastig“ ist: schlanke PL-Variante unter `/pl/timesheets` die `timesheetsApi` nutzt.

---

## 5. API-Client

`apps/web/src/lib/work-items.ts` um PL-Methoden ergänzen falls fehlend:

- `plProjects()`, `plWorkItems(projectId, query)`, `plWorkItem(id)`, `approve(id)`, `forceComplete(id)`

Timesheets: Rollenfilter eher backend; Frontend blendet Aktionen.

---

## 6. Dokument-/Foto-Zugriff (minimal)

Wenn PL Fotos der Fertigmeldung nicht laden kann (403):  

- Entweder Download für `CUSTOMER_PL` erlauben, wenn DocumentLink zu `WORK_ITEM_REPORT` eines Items in seinem Projekt gehört  
- Oder PL-Detail liefert temporäre URLs  

Kein breites Document-Freischalten.

---

## 7. Explizit NICHT

- Keine Monteur-App-Änderungen (außer du findest Blocker)
- Kein PDF-OCR, keine Abrechnung aus APPROVED
- Kein volles Office für CUSTOMER_PL
- Kein Worker-PIN für Kunden-PL in diesem Auftrag
- Kein Mobile-Kunden-PL

---

## 8. Abnahme

- [ ] User nur `CUSTOMER_PL`: Login → reduzierte Nav
- [ ] Sieht nur zugewiesene Projekte
- [ ] Board filtert Status; approve / force-complete funktioniert
- [ ] Fotos der Fertigmeldung sichtbar (oder klar dokumentiert wenn Blocker)
- [ ] Timesheet approve nur für eigene Projekte; 403 sonst
- [ ] Interner Office-User unverändert
- [ ] `pnpm --filter @office/api build` und `@office/web build` grün

---

## 9. Commit

`feat: Kunden-PL Board und Wochen-Stundenzettel-Abzeichnung`

inkl. `claude-auftraege/claude-arbeitsitems-04-customer-pl.md`  
Kein push.

Ende Auftrag #4.
