# Claude / Cloud – Auftrag #8: Kartentyp-Templates + OCR-Extraktion

## Kontext

Repo: Office-Monorepo. **Auftrag #7 ist auf `main` deployed** (PDF-Primärimport Minimal-Modus).

**Spez:** `SPEZ-arbeitsitems.md` §10.2 Punkte 3–4, §15  
**Ideen:** `ideen.md` – Kartentyp-Template + OCR/LLM  
**Bestehend:**
- PDF-Import Preview/Commit: `work-item-pdf-import.service.ts`, `pdf-import-section.tsx`
- OCR-Proxy: `apps/api/src/ocr/` → PaddleOCR (`OCR_SERVICE_URL`), Muster `business-card.parser.ts`
- Kein LLM direkt in der API (kein OpenAI-Key) → **Extraktion = OCR + Template-Matcher** (Label/Regex). Kein neues LLM-Microservice in diesem Auftrag.

Produktion nicht regressiv brechen. Minimal-Modus ohne Template muss weiter funktionieren.

---

## Ziel

Büro kann:

1. **Kartentyp-Template** anlegen (Name, optional Kunde) und Felder definieren: mindestens `itemKey`, `workScopeDe`; optional `floor`, `room`, `title`
2. Template anhand **einer Beispielseite** kalibrieren: Seite → OCR → Text/Blöcke anzeigen → Felder zuordnen (Label-Hinweise + optional Regex)
3. Beim **PDF-Import-Preview** ein Template wählen → je Seite OCR → Felder vorausfüllen
4. Vorschau weiter editierbar; Commit unverändert Review-Gate
5. Ohne Template: bisheriges Verhalten (`Seite-NN`)

---

## 1. Prisma

Neues Modell `WorkCardTemplate`:

```prisma
model WorkCardTemplate {
  id          String   @id @default(cuid())
  name        String
  customerId  String?  // optional, FK Customer wenn vorhanden
  /// JSON: FieldMapping[]
  fields      Json
  /// optional: Beispiel-OCR-Snippet / Hinweise für UI
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  customer Customer? @relation(...) // nur wenn Relation sauber passt; sonst customerId ohne Relation
}
```

`FieldMapping` (JSON-Shape, in Code typisieren):

```ts
type WorkCardFieldTarget = 'itemKey' | 'workScopeDe' | 'workScopeSk' | 'title' | 'floor' | 'room';

interface WorkCardFieldMapping {
  target: WorkCardFieldTarget;
  /** Labels/Überschriften auf der Karte, z.B. ["Positions-ID","Kennung","Detail"] */
  labelHints: string[];
  /** Optional: Regex auf den Wert nach dem Label oder im Gesamttext */
  regex?: string;
  /** Optional: „nächste N Zeilen nach Label“ für lange Texte (workScope) */
  captureLines?: number; // default 1; für workScope z.B. 5
}
```

Migration + `prisma generate`. Seed optional: 1 Demo-Template „TAS-ähnlich“ mit sinnvollen labelHints/regex für `itemKey` (z.B. `\d{2}-[A-Z]-\d{2}`).

---

## 2. Backend – Templates CRUD

Modul unter `apps/api/src/work-items/` oder eigenes `work-card-templates/`.

| Methode | Route | Zweck |
|---|---|---|
| GET | `/work-card-templates` | Liste (Filter `customerId` optional) |
| GET | `/work-card-templates/:id` | Detail |
| POST | `/work-card-templates` | Anlegen |
| PATCH | `/work-card-templates/:id` | Ändern |
| DELETE | `/work-card-templates/:id` | Löschen |
| POST | `/work-card-templates/calibrate` | Beispielseite OCR → Rohtext + Vorschlag |

Rollen: wie Work-Items (`SUPERADMIN`, `OFFICE`, `PROJECT_MANAGER`).

### 2.1 Calibrate

Multipart `file` (Bild oder 1-Seiten-PDF, OCR-Limit beachten) → `OcrService.extractText` → Response:

```json
{
  "text": "...",
  "blocks": [...],
  "suggestedFields": [
    { "target": "itemKey", "labelHints": ["Positions-ID"], "regex": "\\d{2}-[A-Z]-\\d{2}", "sampleValue": "05-A-01" }
  ]
}
```

Vorschläge heuristisch (bekannte Labels DE: Positions-ID, Kennung, Arbeitsumfang, Geschoss, Raum). User speichert danach per POST/PATCH das finale `fields`-JSON.

---

## 3. Backend – PDF-Seiten rasterisieren + OCR beim Preview

### 3.1 Rasterizer

`pdf-lib` kann **nicht** rendern. Deshalb:

- `poppler-utils` (`pdftoppm`) in **Runtime**-Stage von `docker/Dockerfile.api` installieren (`apk add poppler-utils`)
- Service `PdfPageRasterService`: Buffer + pageNumber (1-basiert) → PNG/JPEG-Buffer (z.B. 150–200 DPI)
- Temp-Dateien unter `/tmp`, danach löschen
- Auch in Dev-Dockerfile/`docker-compose` beachten falls API dort anders startet – zumindest Prod-Dockerfile + Doku in Notizen, wenn Dev-Image alpine ohne Poppler: klare Fehlermeldung „pdftoppm fehlt“

### 3.2 Extractor

`WorkCardFieldExtractor` (analog Business-Card-Parser):

- Input: `OcrResult` + `WorkCardFieldMapping[]`
- Pro Mapping: Label-Zeile finden (case-insensitive, contains) → Wert aus derselben Zeile nach `:` / Rest, oder nächste `captureLines` Zeilen; optional `regex` Match
- Output: partial `{ itemKey?, workScopeDe?, … }` + confidence/warnings

### 3.3 Preview erweitern

`PdfImportPreviewDto` + Form-Feld:

- `templateId?: string`
- `extract?: boolean` (default true wenn templateId gesetzt)

Ablauf wenn `templateId` gesetzt:

1. Template laden
2. Für jede Seite im Bereich: rasterize → OCR → extract
3. `itemKey` = extrahiert oder Fallback `Seite-NN`
4. `title` = extrahiert oder `itemKey` oder `Seite N`
5. `workScopeDe` = extrahiert oder null
6. Warnings bei niedriger Confidence / fehlender Kennung
7. **Timeouts:** bei >15 Seiten OCR sequentiell oder kleine Parallelität (2–3); Preview darf länger dauern – Frontend Timeout erhöhen (z.B. 120–180s). Optional Query `maxExtractPages` (Default 50, Cap 200)

Commit-DTO: optional `floor`, `room`, `workScopeSk` mitschreiben wenn UI/Extractor sie liefert (Schema hat die Felder).

---

## 4. Frontend

### 4.1 Template-Verwaltung (Büro)

Einfache UI im Arbeitsitems-Tab oder Dialog von der PDF-Import-Section:

- Liste Templates, Anlegen/Bearbeiten/Löschen
- Formular: Name, optional Kunde, Field-Mappings (target Select + labelHints Text + regex + captureLines)
- **Kalibrieren:** Datei hochladen → OCR-Text anzeigen → „Vorschläge übernehmen“ → speichern

Texte in `texts.ts`.

### 4.2 PDF-Import-Section

- Dropdown **Kartentyp-Template** (optional „Kein Template“)
- Bei Vorschau: `templateId` mitsenden
- Längerer Loading-Hinweis („OCR je Seite – kann bei vielen Seiten dauern“)
- Tabelle: Kennung/Titel/Arbeitsinhalt vorausgefüllt, weiter editierbar
- Optional Spalten Floor/Room wenn vorhanden

Client: `apps/web/src/lib/work-items.ts` + neues `work-card-templates.ts` falls sinnvoll.

---

## 5. Explizit nicht tun

- Kein Drag&Drop-Zone-Editor auf dem Seitenbild (kann später)
- Kein neues LLM-/Research-Endpoint
- Keine Material-Extraktion
- Mobile/Kiosk unangetastet
- Excel-Import unangetastet (außer ggf. Hinweis „Template nur für PDF“)
- Kein Blind-Commit ohne Preview

---

## 6. Qualität / Docs

- Migration deploybar (`prisma migrate`)
- Dockerfile.api Runtime: `poppler-utils`
- `apps/api/src/work-items/README.md` um Templates + `templateId` am Preview ergänzen
- Self-Check: `claude-auftraege/claude-arbeitsitems-08-notizen.md`
- STATUS/`ideen.md` nicht zwingend – Cloud darf kurze Notiz; Follow-up aktualisiert Docs

---

## 7. Akzeptanzkriterien

| # | Kriterium |
|---|---|
| 1 | Template CRUD funktioniert (API + minimale UI) |
| 2 | Calibrate: Beispielseite → OCR-Text + speicherbare Field-Mappings |
| 3 | Preview **ohne** Template = wie Auftrag #7 |
| 4 | Preview **mit** Template füllt `itemKey`/`workScopeDe` aus OCR wo erkennbar |
| 5 | Fehlschlag OCR/Seite → Fallback Platzhalter + Warning, kein 500 für ganze Preview |
| 6 | Commit speichert editierte Werte inkl. optional floor/room |
| 7 | `pdftoppm` im API-Prod-Image verfügbar |
| 8 | Bestehende Rollen/Auth analog |

---

## 8. Commit

Branch von `main`, Feature-Commit z.B.:

`feat: Kartentyp-Templates und OCR-Extraktion für PDF-Arbeitsitems`

Push Branch; PR optional. Deploy folgt nach Merge durch Follow-up.
