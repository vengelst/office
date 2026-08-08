# Self-Check: Auftrag #8 – Kartentyp-Templates + OCR-Extraktion

**Datum:** 2026-08-08
**Branch:** `cursor/work-card-templates-ocr-51c3`

## Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|---|---|---|
| 1 | Template CRUD (API + minimale UI) | ✅ | Controller, Service, Modul + Frontend-Dialog |
| 2 | Calibrate: Beispielseite → OCR-Text + speicherbare Field-Mappings | ✅ | POST /work-card-templates/calibrate mit heuristischen Vorschlägen |
| 3 | Preview **ohne** Template = wie Auftrag #7 | ✅ | Kein templateId → identischer Minimal-Modus-Code |
| 4 | Preview **mit** Template füllt itemKey/workScopeDe aus OCR | ✅ | Rasterize → OCR → WorkCardFieldExtractor pro Seite |
| 5 | Fehlschlag OCR/Seite → Fallback + Warning, kein 500 | ✅ | Promise.allSettled, ocrWarnings pro Item, Fallback auf Platzhalter |
| 6 | Commit speichert editierte Werte inkl. floor/room | ✅ | PdfImportItemDto erweitert, Commit schreibt floor/room |
| 7 | pdftoppm im API-Prod-Image | ✅ | `apk add --no-cache poppler-utils` in Runtime-Stage |
| 8 | Bestehende Rollen/Auth analog | ✅ | SUPERADMIN, OFFICE, PROJECT_MANAGER wie Work-Items |

## Geänderte Dateien

### Prisma / DB
- `prisma/schema.prisma` – WorkCardTemplate Modell + Customer-Relation
- `prisma/migrations/20260808140000_add_work_card_template/migration.sql`

### Backend (API)
- `apps/api/src/work-card-templates/` (neues Modul):
  - `work-card-templates.module.ts`
  - `work-card-templates.controller.ts`
  - `work-card-templates.service.ts`
  - `work-card-calibrate.service.ts`
  - `work-card-field-extractor.ts`
  - `work-card-field.types.ts`
  - `pdf-page-raster.service.ts`
  - `dto/work-card-template.dto.ts`
- `apps/api/src/work-items/`:
  - `work-item-pdf-import.service.ts` – templateId/extract, OCR-Extraktion, floor/room
  - `dto/pdf-import.dto.ts` – templateId, extract, floor, room
  - `work-items.module.ts` – OcrModule + WorkCardTemplatesModule importiert
  - `README.md` – Doku zu Templates + templateId
- `apps/api/src/app.module.ts` – WorkCardTemplatesModule registriert
- `docker/Dockerfile.api` – `poppler-utils` in Runtime-Stage

### Frontend (Web)
- `apps/web/src/lib/work-card-templates.ts` – API-Client + Typen
- `apps/web/src/lib/work-items.ts` – PdfPreviewItem + Options um OCR-Felder erweitert
- `apps/web/src/lib/texts.ts` – Template-Texte + OCR-Hinweise
- `apps/web/src/components/projects/tabs/work-items/templates-section.tsx` – Template-CRUD UI
- `apps/web/src/components/projects/tabs/work-items/pdf-import-section.tsx` – Template-Dropdown + floor/room Spalten
- `apps/web/src/components/projects/tabs/work-items-tab.tsx` – Templates-Tab

## Testpfad

### API
```bash
# Template CRUD
curl -X POST "$API/api/work-card-templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","fields":[{"target":"itemKey","labelHints":["Positions-ID"],"regex":"\\d{2}-[A-Z]-\\d{2}"}]}'

# Calibrate
curl -X POST "$API/api/work-card-templates/calibrate" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@beispielseite.png"

# PDF-Preview ohne Template (Minimal-Modus)
curl -X POST "$API/api/projects/$PID/work-items/import-pdf/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@block.pdf" -F "blockKey=Block-1"

# PDF-Preview MIT Template
curl -X POST "$API/api/projects/$PID/work-items/import-pdf/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@block.pdf" -F "blockKey=Block-1" -F "templateId=$TEMPLATE_ID"
```

### Web-UI
1. Projekt → Arbeitsitems → Tab „Templates" → Neues Template anlegen
2. Kalibrieren mit Beispielseite → Vorschläge übernehmen → Speichern
3. Tab „Import" → PDF wählen, Template auswählen → Vorschau laden
4. Felder (Kennung, Arbeitsinhalt, Geschoss, Raum) prüfen/editieren → Import ausführen
5. Ohne Template → gleicher Minimal-Modus wie bisher (Seite-NN)

## Offene Restpunkte

- **Dev-Image:** poppler-utils ggf. auch im `docker-compose.dev.yml` oder lokalen Dev-Setup ergänzen. In Produktion ist es via `Dockerfile.api` abgedeckt.
- **workScopeSk:** Extraktion nur wenn Template ein Mapping für `workScopeSk` definiert – realistische Nutzung erfordert zweisprachige Arbeitskarten.
- **Drag&Drop Zone-Editor:** Bewusst nicht umgesetzt (Spec §5: „kann später").
- **Timeout bei vielen Seiten:** Preview hat OCR-Concurrency 3 und 180s Client-Timeout. Bei >50 Seiten ggf. progressiven Feedback-Mechanismus (SSE) nachrüsten.
- **Seed-Template:** Kein automatisches Demo-Template im Seed – Büro legt Templates manuell an.
