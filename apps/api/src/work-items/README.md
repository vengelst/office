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
| GET | `/workers/me/work-items/:id` | Item-Detail (inkl. `hasPdf`) |
| GET | `/workers/me/work-items/:id/pdf` | Block-PDF dieses Items (Stream) |
| POST | `/work-items/:id/claim` | Item nehmen |
| POST | `/work-items/:id/sessions/start` | Aktuelles Item (beendet offene Sessions) |
| POST | `/work-items/:id/sessions/stop` | Session beenden |
| POST | `/work-items/:id/reports/complete` | Fertigmeldung, Multipart-Feld `photos`, min. 2 Fotos |
| POST | `/work-items/:id/reports/rework` | Nacharbeit melden |

`GET /worker-auth/me` liefert je Zuweisung `project.itemBased` mit – die
Monteur-App blendet den Arbeitsitems-Bereich damit ohne Extra-Call ein.

#### Block-PDF für Monteure

`GET /workers/me/work-items/:id/pdf` ist genauso eng geschnitten wie der
Foto-Endpunkt des Kunden-PLs – **kein** genereller Dokument-Download für die
Rolle `WORKER`, `/documents/:id/download` bleibt unverändert auf
`SUPERADMIN`/`OFFICE`/`PROJECT_MANAGER` begrenzt.

* Der Aufrufer nennt nur das **Item**; die Dokument-ID kommt ausschließlich aus
  `item.block.pdfDocumentId` (`WorkItemsService.findWorkerPdf`). Eine
  Dokument-ID von außen gibt es nicht.
* Zugriff hat, wer eine aktive `WorkItemAssignment` an diesem Item **oder** eine
  aktive `ProjectAssignment` am Projekt des Items hat
  (`assertWorkerItemAccess`, identisch zu `GET /workers/me/work-items/:id`) –
  sonst `403`.
* Ohne Block-PDF: `404 „Kein PDF verknüpft“`. Einzelseiten je Item (SPEZ 10.2)
  sind noch nicht modelliert, es gibt daher bewusst keinen Fallback.
* Gestreamt wird über `DocumentsService.getDownload()` (interner Service-Aufruf,
  kein Umweg über den `DocumentsController`).
* `?inline=1` liefert `Content-Disposition: inline`, sonst `attachment`.

`findOne` liefert zusätzlich `hasPdf: boolean` (abgeleitet aus
`block.pdfDocumentId`), damit die Monteur-App den Button „Plan / PDF“ ohne
Extra-Call ein- oder ausblenden kann. Die Planreferenz (`block.blockKey`,
`pdfFile`, `pdfPage`) bleibt als Textzeile daneben stehen.

Die Monteur-App kann den Endpunkt nicht direkt verlinken (ein externer Viewer
schickt kein Bearer-Token): `openWorkItemPdf` in
`apps/mobile/lib/work-items.ts` lädt die Datei nativ in den App-Cache und
öffnet sie per Android-`ACTION_VIEW` auf einer `content://`-URI
(`FLAG_GRANT_READ_URI_PERMISSION`); ohne installierten PDF-Betrachter greift
der Teilen-Dialog.

##### Smoke-Test

```bash
# 200 + application/pdf: Monteur mit Projekt-/Itemzuordnung, Block hat ein PDF
curl -D- -o plan.pdf "$API/api/workers/me/work-items/$ITEM_ID/pdf?inline=1" \
  -H "Authorization: Bearer $WORKER_TOKEN"

# 403 „Kein Zugriff auf dieses Item“: Item eines fremden Projekts
curl -i "$API/api/workers/me/work-items/$FOREIGN_ITEM_ID/pdf" \
  -H "Authorization: Bearer $WORKER_TOKEN"

# 404 „Kein PDF verknüpft“: Item ohne Block oder Block ohne pdfDocumentId
curl -i "$API/api/workers/me/work-items/$ITEM_WITHOUT_PDF/pdf" \
  -H "Authorization: Bearer $WORKER_TOKEN"

# 403: Büro-Download bleibt rollenbasiert – Worker-Token hat hier nichts zu suchen
curl -i "$API/api/documents/$PDF_DOCUMENT_ID/download" \
  -H "Authorization: Bearer $WORKER_TOKEN"
```

### Kunden-PL – Rolle `CUSTOMER_PL` (bzw. `SUPERADMIN`), nur zugewiesene Projekte

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/pl/projects` | Eigene item-basierte Projekte |
| GET | `/pl/projects/:projectId/work-items` | Board-Daten inkl. Status-Zähler |
| GET | `/pl/work-items/:id` | Item-Detail inkl. Foto-IDs |
| GET | `/pl/work-items/:id/photos/:documentId` | Foto einer Rückmeldung (Stream) |
| POST | `/work-items/:id/reviews/approve` | Kontrolle bestanden |
| POST | `/work-items/:id/reviews/force-complete` | PL setzt selbst fertig |

Der Foto-Endpunkt ist bewusst eng geschnitten: `/documents/:id/download` bleibt
für `CUSTOMER_PL` gesperrt; gestreamt wird nur ein Dokument, das per
`DocumentLink` am Item (`WORK_ITEM`) oder an einer seiner Rückmeldungen
(`WORK_ITEM_REPORT`) hängt – und nur, wenn das Projekt zugewiesen ist
(`assertCustomerPlPhotoAccess`).

### Stundenzettel des Kunden-PLs

Der Kunden-PL zeichnet Wochenstunden ab (SPEZ-arbeitsitems.md 4.2/8.1). Dafür
ist er in `TimesheetsController` **nur** für diese Endpunkte freigeschaltet:

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/timesheets` | Liste – gefiltert auf zugewiesene Projekte |
| GET | `/timesheets/:id` | Detail – 403 bei fremdem Projekt |
| GET | `/timesheets/:id/pdf` | PDF – 403 bei fremdem Projekt |
| POST | `/timesheets/:id/approve` | Abzeichnen (nur aus Status `SUBMITTED`) |

Generieren, Tageskorrektur, Einreichen, Zurückweisen, Archivieren und
Unterschreiben bleiben den internen Rollen vorbehalten. Die Einschränkung
berechnet `TimesheetsService.projectScopeFor()` aus
`WorkItemsService.findCustomerPlProjectIds()` – interne Rollen erhalten
`null` (keine Einschränkung), sodass sich für das Büro nichts ändert.

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
