# Claude Code – Auftrag #2: Arbeitsitems Web Büro

## Kontext

Repo: Office-Monorepo. **Auftrag #1 ist deployed** (`eab73e3`): NestJS-API unter `apps/api/src/work-items/` inkl. Import, Blocks, Customer-PL, Workflow.

**Spez:** `SPEZ-arbeitsitems.md`  
**API-Doku:** `apps/api/src/work-items/README.md`  
**Beispiel-Excel:** `arbeitsitems-import-beispiel.xlsx`

Dieser Auftrag: **nur Web-UI für internes Büro** (Next.js in `apps/web`).  
Kein Mobile, keine Kunden-PL-eigene App-Oberfläche (kann später Auftrag 4), keine Monteur-App.

---

## Ziel

Büro kann im Projekt:

1. Item-Modus aktivieren (`itemBased`)
2. Blöcke anlegen und Block-PDFs zuordnen/hochladen
3. Items + Material per Excel importieren (Beispiel-Datei)
4. Items filtern/listen (Board/Tabelle) und Detail inkl. Material sehen
5. Kunden-PL zuordnen (`CUSTOMER_PL`-User)

---

## 1. API-Client

Neu: `apps/web/src/lib/work-items.ts` (Stil wie `projects.ts` / `workers.ts`)

Typen + Methoden für:

- Blocks CRUD
- Work-Items list/get/patch/delete, materials get/put
- Import + preview (multipart `files`)
- Item time summary
- Customer-PL list/candidates/add/remove
- Status-Labels DE (OPEN→Offen, IN_PROGRESS→In Arbeit, REVIEW→Kontrolle, REWORK→Nacharbeit, APPROVED→Geprüft)

`itemBased` über bestehendes `projectsApi.update` / PATCH.

Nutze `apiClient` aus `api-client.ts`. Für Multipart: bestehendes Upload-Pattern aus `documents.ts` / `upload.ts` studieren und analog umsetzen.

---

## 2. Texte

In `apps/web/src/lib/texts.ts` Abschnitt `workItems` (bzw. unter `projects.workItems`) ergänzen – alle UI-Strings zentral, kein Hardcode Deutsch außer ggf. Status-Mapping das auch dort liegt.

---

## 3. Projekt-Detail: neuer Tab „Arbeitsitems“

Datei: `apps/web/src/app/(authenticated)/projects/[id]/page.tsx`

- Neuen Tab `arbeitsitems` / „Arbeitsitems“ einbauen (bestehende Tabs-Pattern beibehalten)
- Tab-Inhalt als eigene Komponente(n) unter `apps/web/src/components/projects/tabs/…`

### 3.1 Kopfbereich im Tab

- Switch/Checkbox **„Item-basiertes Projekt“** → PATCH `itemBased`
- Wenn aus: Hinweis „Aktivieren, um Blöcke/Items zu nutzen“; darunter trotzdem Vorschau/Import deaktivieren oder nur Hinweis
- Wenn an: volle UI

### 3.2 Unterbereiche (sinnvolle Sections/Subtabs, Touch-tauglich ≥44px)

**A) Blöcke & PDFs**
- Liste Blocks (`blockKey`, Name, Item-Anzahl, PDF-Status)
- Block anlegen
- PDF hochladen und dem Block zuordnen (Document-Upload über bestehendes Documents-API + `pdfDocumentId` am Block setzen – siehe API UpdateBlock)
- Optional: Dateiname/`pdfFile`-Hinweis für Import-Matching

**B) Import**
- Datei-Upload (xlsx) – Mehrfachdateien ok falls API `files` erwartet
- Button Preview → Ergebnis anzeigen (Counts, Warnungen)
- Button Import ausführen → Toast + Liste neu laden
- Link/Hinweis auf Vorlage `arbeitsitems-import-beispiel.xlsx`

**C) Items-Board / Liste**
- Filter: Status, Block, Suche `q` (Kennung)
- Tabelle/Cards: itemKey, title, floor/area/room, status-badge, block
- Klick → Detail-Drawer oder Unterseite

**D) Item-Detail**
- Metadaten (Kennung, Typ, RC, Raum, Arbeitsumfang DE/SK)
- Materialtabelle
- PDF-Seite-Hinweis / Link zum Block-PDF wenn vorhanden
- Aktive Zuordnungen / letzte Reports falls API liefert (read-only für Büro)
- Item-Zeit-Zusammenfassung (`GET /work-items/:id/time`) wenn vorhanden

**E) Kunden-PL**
- Liste zugewiesener Customer-PLs
- Hinzufügen aus Candidates
- Entfernen

---

## 4. UX / Design-Regeln (bestehendes System)

- Desktop + Tablet + Handy bedienbar
- Tabs/Sections statt Endlosformular
- shadcn/ui wie im Rest der App
- Bestehende Badges/Toasts/ConfirmDialogs nutzen
- Kein neues Design-System, kein purple/glow
- Drucken optional später – nicht nötig

---

## 5. Project-Form / Liste (klein)

- In Projekt-Stammdaten oder Liste optional Badge „Items“ wenn `itemBased` – nur wenn wenig Aufwand
- `itemBased` im Create/Edit-DTO-Typen von `lib/projects.ts` ergänzen falls fehlend

---

## 6. Explizit NICHT

- Keine Monteur-App-Änderungen
- Keine Kunden-PL-Login-UI / Board für PL (Auftrag 4)
- Keine Fertigmeldung/Fotos im Büro-Tab (nur Anzeige)
- Kein PDF-OCR
- Keine API-Schema-Änderungen außer klaren Bugfixes die UI blockieren
- Kein Refactor irrelevanter Module

---

## 7. Abnahme

- [ ] Tab „Arbeitsitems“ sichtbar in Projektdetail
- [ ] itemBased toggeln speichert
- [ ] Block anlegen funktioniert
- [ ] Excel-Import (Beispiel) lädt Items+Material
- [ ] Filter/Liste/Detail/Material sichtbar
- [ ] Kunden-PL zuordnen/entfernen
- [ ] `pnpm --filter @office/web build` grün (oder projektübliches Build)
- [ ] Keine Regression an bestehenden Projekt-Tabs

---

## 8. Commit

Commit-Message:
`feat(web): Arbeitsitems-Tab für Büro (Import, Blöcke, Kunden-PL)`

Kein git push (macht Operator).

Ende Auftrag #2.
