# Auftrag #7 – PDF-Primärimport – Self-Check

**Datum:** 2026-08-08  
**Branch:** `cursor/pdf-primaer-import-03eb`

---

## Gebaut

### Backend (apps/api)

| Datei | Funktion |
|---|---|
| `src/work-items/dto/pdf-import.dto.ts` | DTOs für Preview + Commit (Multipart-kompatibel) |
| `src/work-items/work-item-pdf-import.service.ts` | Service: Seitenzählung (`pdf-lib`), Preview, Commit |
| `src/work-items/project-work-items.controller.ts` | 2 neue Endpunkte: `import-pdf/preview`, `import-pdf` |
| `src/work-items/work-items.module.ts` | `WorkItemPdfImportService` registriert |

Neue Dependency: `pdf-lib` (leichtgewichtig, kein Native-Addon)

### Frontend (apps/web)

| Datei | Funktion |
|---|---|
| `src/lib/work-items.ts` | Typen + API-Funktionen `previewPdfImport`, `runPdfImport` |
| `src/lib/texts.ts` | Texte unter `projects.workItems.pdfImport` + Fallback-Hinweis |
| `src/components/projects/tabs/work-items/pdf-import-section.tsx` | **Neue Datei**: PDF-Import-UI (File-Wahl, Vorschau-Tabelle, Commit) |
| `src/components/projects/tabs/work-items-tab.tsx` | PDF-Import vor Excel eingebunden |
| `src/components/projects/tabs/work-items/import-section.tsx` | Title auf "Fallback" geändert, Hinweistext ergänzt |

---

## Entscheidungen

1. **pdf-lib** für Seitenzählung gewählt (klein, kein Binär-Addon, reicht für page-count)
2. **Kein DRAFT-Status** – Preview = dryRun wie beim Excel-Import, Commit → OPEN
3. **JSON items-Feld im Multipart** – Transform im DTO parst den String; ermöglicht editierte Liste + PDF in einem Request
4. **Document-Upload** über bestehenden `DocumentsService` (Typ DRAWING, Entity PROJECT)
5. **Block-Upsert** im Commit: blockKey wird angelegt falls neu, pdfDocumentId automatisch gesetzt
6. **Material nicht erzwungen** – kein Materialimport aus PDF (Spec-konform)
7. **Bestehende Auth/Rollen** (`@Roles SUPERADMIN, OFFICE, PROJECT_MANAGER`) exakt wie Excel-Import
8. **Mobile unverändert** – kein Touch an Worker-App oder Kiosk

---

## Akzeptanzkriterien

| # | Kriterium | Status |
|---|---|---|
| 1 | Preview 3+ Seiten → 3+ Items mit pdfPage + Platzhalter-itemKey | ✅ |
| 2 | Commit → Items OPEN mit pdfPage + Block-PDF | ✅ |
| 3 | Zweiter Commit mit gleicher Kennung upsertet ohne Status-Reset | ✅ (Update-Pfad, kein Status-Feld im Update) |
| 4 | Excel-Import funktioniert weiter; UI sagt Fallback | ✅ |
| 5 | Material nicht erzwungen | ✅ |
| 6 | Rollen/Auth analog | ✅ |
| 7 | Minimal-Modus abgedeckt; Template/OCR offen | ✅ |

---

## Offene Restpunkte (laut Spec OK)

- **Template-Editor** (Felder zeichnen / Kartentyp-Mapping): nicht in diesem Auftrag
- **OCR/LLM-Extraktion**: nicht in diesem Auftrag
- **Seiten-Thumbnails** in der Vorschau: perspektivisch möglich, kein Blocker
- **Prisma-Migration**: nicht nötig, Schema-Felder `pdfPage`/`pdfFile`/`itemKey`/`workScope*` existieren bereits

---

## Wie testen

### API (curl / httpie)

```bash
# Preview
curl -X POST https://office.vivahome.de/api/projects/{projectId}/work-items/import-pdf/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "blockKey=Block-1" \
  -F "itemKeyPrefix=Seite-"

# Commit
curl -X POST https://office.vivahome.de/api/projects/{projectId}/work-items/import-pdf \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "blockKey=Block-1" \
  -F 'items=[{"pdfPage":1,"itemKey":"05-A-01","title":"Test"}]'
```

### UI

1. Projekte → Projekt öffnen → Tab „Arbeitsitems"
2. Item-Modus aktivieren
3. Sub-Tab „Import" → **PDF-Import (Primär)** ist der obere Abschnitt
4. PDF wählen, Block-Kennung eingeben, „Vorschau laden"
5. Kennungen/Titel in der Tabelle editieren
6. „Import ausführen" → Items im Tab „Items" sichtbar
7. Darunter: Excel-Import (als Fallback gekennzeichnet)
