# Cloud-Auftrag #12 – Self-Check / Notizen

## Fortschritt-Technik (gewählt)

**Option A – Chunked Preview:** Client sendet `startPage`/`endPage` in Chunks à 8 Seiten bei OCR; UI zeigt „Seite X von N“ + Progressbar. Kein Redis/Bull, kein SSE. Einzelseiten-OCR-Fehler (`Promise.allSettled`) brechen den Rest nicht ab. Chunk-Timeout 180 s mit klarer Abort-Meldung.

## Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Preview+OCR zeigt Fortschritt (Seite X von N) bei großen PDFs | ✅ | Chunked Requests, Progressbar in `pdf-import-section` |
| 2 | Einzelseiten-OCR-Fehler brechen Preview nicht ab | ✅ | `allSettled` + Fallback-Kennung; UI zählt Fehler |
| 3 | Timeout-UX: klare Fehlermeldung | ✅ | Abort-Toast; Client prüft 50 MB vor OCR |
| 4 | Zone-Editor auf Template-Beispielseite (Drag-Rechtecke) | ✅ | `ZoneEditor` in Kalibrier-Dialog |
| 5 | Zones in `WorkCardTemplate.fields` (normiert 0–1) | ✅ | `zone?: {x,y,w,h}` in Mapping + DTO |
| 6 | Import: OCR-Blöcke in Zone bevorzugt, Fallback Label/Regex | ✅ | `extractWorkCardFields` + Bildmaße |
| 7 | Template ohne Zones verhält sich wie zuvor | ✅ | Zone-Pfad nur wenn `zone` + Bildgröße |
| 8 | Minimal-Modus ohne Template bleibt grün | ✅ | Unverändert (kein extract) |
| 9 | Block-PDF-Import-Pfad 50 MB (nicht global Documents) | ✅ | `DocumentsService.upload(..., { maxFileSize: 50MB })` |
| 10 | Raster: PDF einmal Temp schreiben (Session) | ✅ | `PdfPageRasterService.createSession` |
| 11 | `@office/api` + `@office/web` Build grün | ✅ | API nest build; Web next build (lucide/`@types/react` Isolation) |
| – | Kein LLM / Redis / Kiosk / Mobile / Billing | ✅ | Out of Scope |

## Build-Hinweis

Monorepo: Mobile (`@types/react@19`) wurde in `.pnpm/node_modules` gehoisted und kollidierte mit Web/lucide (`ReactNode` + `bigint`). Fix: `pnpm.packageExtensions` pinnt `@types/react@18.3.31` an `lucide-react` (Root-`package.json`).

## Geänderte Dateien

### Neu
- `apps/web/src/components/projects/tabs/work-items/zone-editor.tsx`
- `claude-auftraege/claude-arbeitsitems-12-notizen.md`

### Erweitert (API)
- `apps/api/src/work-card-templates/work-card-field.types.ts` – `zone`
- `apps/api/src/work-card-templates/work-card-field-extractor.ts` – Zone-Extraktion + `getPngDimensions`
- `apps/api/src/work-card-templates/dto/work-card-template.dto.ts` – Zone-DTO, labelHints optional
- `apps/api/src/work-card-templates/pdf-page-raster.service.ts` – Session / einmal Temp-PDF
- `apps/api/src/work-card-templates/work-card-calibrate.service.ts` – `pageImageDataUrl` + Maße
- `apps/api/src/work-items/work-item-pdf-import.service.ts` – Session, range*, 50 MB Upload-Option
- `apps/api/src/documents/documents.service.ts` – `MAX_BLOCK_PDF_FILE_SIZE` + `DocumentUploadOptions`

### Erweitert (Web)
- `apps/web/src/components/projects/tabs/work-items/pdf-import-section.tsx` – Chunked OCR + Progress
- `apps/web/src/components/projects/tabs/work-items/templates-section.tsx` – Zone-Editor-Integration
- `apps/web/src/lib/work-card-templates.ts` – Zone-Typen + Calibrate-Response
- `apps/web/src/lib/work-items.ts` – Chunk-Konstante, 50 MB, rangeStart/End
- `apps/web/src/lib/texts.ts` – Progress- und Zone-Texte
- `package.json` – `pnpm.packageExtensions` für lucide/`@types/react@18` (Build-Fix)

## Testpfad (Produktion nach Deploy)

1. Projekt → Arbeitsitems → PDF wählen (ggf. >10 MB, <50 MB) → Vorschau → Import (Commit darf nicht an Documents-10 MB scheitern)
2. Template wählen → OCR vorausfüllen bei ≥30 Seiten → Fortschrittsanzeige sichtbar
3. Template → Kalibrieren → Rechteck für `itemKey` ziehen → speichern → OCR-Import zuverlässiger auf Kennung
4. Template ohne Zone: Extraktion wie zuvor über Labels

## Bewusst nicht

- SSE / Poll-Jobs (Option B/C)
- LLM-Fallback, Redis/Bull
- Globales Anheben aller Document-Uploads auf 50 MB
