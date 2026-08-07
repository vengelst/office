# Modul `work-items` – Arbeitsitems

Umsetzung von `SPEZ-arbeitsitems.md` (Fundament: Schema, API, Excel-Import).
Kein Web-/Mobile-UI, keine Abrechnung, kein PDF-OCR.

## Modelle

`ProjectBlock`, `WorkItem`, `WorkItemMaterial`, `WorkItemAssignment`,
`WorkItemSession`, `WorkItemReport`, `WorkItemReview`, `ProjectCustomerPlAssignment`
sowie `Project.itemBased` und die Rolle `RoleCode.CUSTOMER_PL`.

Fotos hängen über `DocumentLink` am Item (`entityType = WORK_ITEM`) und an der
Rückmeldung (`entityType = WORK_ITEM_REPORT`).

## Statusfluss

```
OPEN --claim--> IN_PROGRESS --reports/complete (min. 2 Fotos)--> REVIEW --approve--> APPROVED
                     ^                                                  |
                     +---------------- reports/rework -> REWORK <--------+
```

* Mehrere Monteure je Item sind erlaubt; **eine** Fertigmeldung genügt
  (Variante B) – alle aktiven Zuordnungen und offenen Sessions enden.
* Nacharbeit lässt die Zuordnung bestehen.
* `force-complete` des Kunden-PL setzt aus jedem Status außer `APPROVED` auf `APPROVED`.
* Item-Zeit läuft nur über Sessions; das Ausstempeln (`POST /api/time-entries/clock-out`)
  schließt offene Item-Sessions des Monteurs.

## Endpoints (Prefix `/api`)

### Büro / Admin – `SUPERADMIN`, `OFFICE`, `PROJECT_MANAGER`

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET/POST | `/projects/:projectId/blocks` | Blöcke lesen/anlegen |
| PATCH/DELETE | `/projects/:projectId/blocks/:blockId` | Block pflegen/löschen |
| GET/POST | `/projects/:projectId/work-items` | Items listen (Filter `status`, `blockKey`, `q`) / anlegen |
| POST | `/projects/:projectId/work-items/import` | Excel-/CSV-Import (Multipart-Feld `files`) |
| POST | `/projects/:projectId/work-items/import/preview` | Import nur prüfen |
| GET/PATCH/DELETE | `/work-items/:id` | Detail / Metadaten / löschen |
| GET/PUT | `/work-items/:id/materials` | Materialliste lesen/ersetzen |
| GET | `/work-items/:id/time` | Item-Zeit je Monteur |
| GET/POST | `/projects/:projectId/customer-pls` | Kunden-PL-Zuordnungen |
| GET | `/projects/:projectId/customer-pls/candidates` | Auswählbare `CUSTOMER_PL`-User |
| DELETE | `/projects/:projectId/customer-pls/:userId` | Zuordnung inaktiv setzen |

`itemBased` wird über den bestehenden `PATCH /projects/:id` gesetzt.

### Monteur – Worker-Token (PIN) oder Benutzer-Token mit verknüpftem Monteur

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/workers/me/work-items` | Eigene Items, offener Pool, laufende Session |
| GET | `/workers/me/work-items/:id` | Item-Detail |
| POST | `/work-items/:id/claim` | Item nehmen |
| POST | `/work-items/:id/sessions/start` | Aktuelles Item (beendet offene Sessions) |
| POST | `/work-items/:id/sessions/stop` | Session beenden |
| POST | `/work-items/:id/reports/complete` | Fertigmeldung, Multipart-Feld `photos`, min. 2 Fotos |
| POST | `/work-items/:id/reports/rework` | Nacharbeit melden |

`GET /worker-auth/me` liefert je Zuweisung `project.itemBased` mit – die
Monteur-App blendet den Arbeitsitems-Bereich damit ohne Extra-Call ein.
Block-PDFs sind für Monteure derzeit **nicht** abrufbar: `/documents/:id/download`
ist auf `SUPERADMIN`/`OFFICE`/`PROJECT_MANAGER` beschränkt. Die App zeigt bis
auf Weiteres nur die Planreferenz (`block.blockKey`, `pdfFile`, `pdfPage`).

### Kunden-PL – Rolle `CUSTOMER_PL` (bzw. `SUPERADMIN`), nur zugewiesene Projekte

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/pl/projects` | Eigene item-basierte Projekte |
| GET | `/pl/projects/:projectId/work-items` | Board-Daten inkl. Status-Zähler |
| GET | `/pl/work-items/:id` | Item-Detail inkl. Foto-IDs |
| POST | `/work-items/:id/reviews/approve` | Kontrolle bestanden |
| POST | `/work-items/:id/reviews/force-complete` | PL setzt selbst fertig |

## Import

* Akzeptiert `.xlsx`/`.xlsm` (Blätter `Items` und `Material`) und CSV.
* Upsert je `(projectId, itemKey)`; **Materialzeilen eines enthaltenen Items
  werden ersetzt** (kein Merge).
* Unbekannter `blockKey` legt den Block an; importierte Items starten in `OPEN`
  ohne Zuordnung. `setItemBased` (Default `true`) schaltet das Projekt auf
  item-basiert, `dryRun` schreibt nichts.

### Nachweis mit der Beispieldatei

`arbeitsitems-import-beispiel.xlsx` (auch unter `docs/import-vorlagen/`) gegen
den reinen Parser geprüft – ohne Datenbank ausführbar:

```bash
pnpm --filter @office/api build
node -e "
const fs = require('fs');
const { parseWorkItemFiles } = require('./apps/api/dist/work-items/work-item-import.parser.js');
parseWorkItemFiles([{ filename: 'x.xlsx', buffer: fs.readFileSync('arbeitsitems-import-beispiel.xlsx') }])
  .then(r => console.log(r.items.map(i => i.itemKey), r.materials.length, r.warnings));
"
# → [ '05-A-01', '05-A-02', '05-B-01' ] 13 []
```

Gegen eine laufende Datenbank:

```bash
curl -X POST "$API/api/projects/$PROJECT_ID/work-items/import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@arbeitsitems-import-beispiel.xlsx"
```
