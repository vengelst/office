# Cloud-Auftrag #12: PDF-Import Feinschliff

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de`.

**Ist-Zustand (Aufträge #7/#8 live):**
- PDF-Primärimport Minimal-Modus: Mehrseiten-PDF → 1 Item/Seite → Vorschau → Commit
- Kartentyp-Templates + OCR-Extraktion (Kalibrierung, Preview mit Template)
- Excel nur Fallback
- Bekannte Painpoints: synchrone OCR im HTTP-Request (bis 200 Seiten, UI-Timeout 600s), kein sichtbarer Fortschritt, Zone-Zuordnung nur über Label/Regex (kein visueller Editor), Upload-Limit-Mismatch Preview 50 MB vs. Documents 10 MB

**Bezug:** `SPEZ-arbeitsitems.md` §10, `ideen.md` „PDF-Import Feinschliff“

---

## Ziel

Büro-Alltag bei echten Kunden-Arbeitskarten verbessern – **ohne** den Minimal-Modus und bestehende Templates zu brechen.

Nach Abschluss:

1. **Fortschritt** bei Preview mit OCR (Seiten X von N, Fehler je Seite) – UI reagiert, kein „schwarzes Loch“ über Minuten
2. **Zone-Editor** (Drag auf Beispielseite) zur Template-Kalibrierung – Bounding-Boxen speichern und bei Import nutzen (stärker als nur Label-Hints)
3. **Limit-Konsistenz:** PDF-Commit und Document-Upload für Block-PDFs auf dasselbe Limit (mind. Import-Limit, empfohlen 50 MB für diesen Pfad)
4. Optional/falls klar machbar: Rasterisierung nicht pro Seite den ganzen Buffer neu schreiben (Temp-PDF einmal, dann `pdftoppm` Seite für Seite)

---

## Nicht-Ziele

- Kein LLM-Fallback / kein neuer Microservice in diesem Auftrag
- Kein Background-Job-Framework (Redis/Bull) **pflichtig** – Fortschritt darf über Streaming/Polling im bestehenden Nest-Prozess laufen; Queue nur wenn ohne großen Infra-Aufwand machbar
- Keine Abrechnung aus Items
- Kein Kunden-PL / Kiosk / Mobile
- Kein Excel-Refactor

---

## 1. Progress bei Preview+OCR

### Soll

- Wenn `extract=true` / Template gewählt: Client sieht Fortschritt (mindestens Seitenzähler, ideal % + fehlgeschlagene Seiten)
- Technische Optionen (eine wählen, dokumentieren):
  - **A (bevorzugt, einfach):** Chunked Preview – API verarbeitet z. B. 5–10 Seiten pro Request; Client loopt und merged Drafts
  - **B:** Ein Request mit SSE/`text/event-stream` Events `{ page, total, status, fields? }`
  - **C:** Job-ID + Poll `GET …/preview-jobs/:id` (nur wenn A/B unsauber)

Commit bleibt ein Schritt nach vollständiger, editierbarer Vorschau (Review-Gate unverändert).

### Akzeptanz

- PDF mit ≥30 Seiten + Template: UI zeigt laufenden Fortschritt; bei Einzelseiten-OCR-Fehler restliche Seiten weiter
- Timeout-UX: klare Fehlermeldung statt stillem Abbruch

---

## 2. Zone-Editor (Template-Kalibrierung)

### Soll

Auf der Template-Beispielseite (bereits OCR/Raster vorhanden):

1. Felder (`itemKey`, `workScopeDe`, …) einer **Rechteck-Zone** auf dem Seitenbild zuordnen (Maus/Touch Drag)
2. Zones in `WorkCardTemplate.fields` speichern, z. B. erweitertes Mapping:

```ts
interface WorkCardFieldMapping {
  target: WorkCardFieldTarget;
  labelHints?: string[];
  regex?: string;
  /** Normierte Box 0–1 relativ zur Seite (x, y, w, h) */
  zone?: { x: number; y: number; w: number; h: number };
}
```

3. Beim Import: OCR-Blöcke **in der Zone** bevorzugen; Fallback auf bisherige Label/Regex-Logik wenn keine Zone

### UI

- Bestehende Template-Kalibrierungs-UI erweitern (kein zweites Template-System)
- Zonen sichtbar, editierbar, löschbar
- Mobile-Tablet-Büro ok, Desktop-First reicht

### Akzeptanz

- Template mit Zone für `itemKey` extrahiert Kennung zuverlässiger als nur Label auf dem gleichen Beispiel-Layout
- Template ohne Zones verhält sich wie heute

---

## 3. Upload-Limit angleichen

- Import-Preview und Commit: konsistent (aktuell Preview bis 50 MB, `DocumentsService.MAX_FILE_SIZE` 10 MB)
- Für Block-PDF-Upload im Work-Item-Import-Pfad: **50 MB erlauben** (Documents-Service gezielt erweitern oder separater Upload-Pfad nur für diesen Use-Case – Least Privilege, nicht global alle Dokumente auf 50 MB ohne Bedarf)
- Klare Fehlermeldung vor langer OCR, wenn Datei zu groß

---

## 4. Raster-Performance (wenn Aufwand gering)

In `PdfPageRasterService`: PDF einmal in Temp schreiben, Seiten sequentiell/batches rasterisieren, Temp aufräumen. Kein Verhaltensbruch.

---

## 5. Dateien (Orientierung)

| Bereich | Pfad |
|---|---|
| Import-Service | `apps/api/src/work-items/work-item-pdf-import.service.ts` |
| Raster | `apps/api/src/work-card-templates/pdf-page-raster.service.ts` |
| Templates | `work-card-templates/` + Prisma `WorkCardTemplate` |
| UI Import | `apps/web/.../pdf-import-section.tsx` (o. Ä.) |
| UI Template | Template-Kalibrierungs-Komponenten unter Projects/Work-Items |
| Documents Limit | `apps/api/src/documents/documents.service.ts` |

---

## 6. Qualität

- Minimal-Modus ohne Template bleibt grün
- TypeScript: `@office/api` + `@office/web` build
- Keine Secrets in Logs; OCR-Rohtext nicht unnötig loggen
- Nach Merge: commit/push; Deploy erfolgt durch Operator/Workflow auf vivahome.de

---

## Kurzformel

> Große PDFs: **sichtbarer Fortschritt**. Templates: **Zone-Editor**. Limits: **50 MB konsistent**. OCR-Logik und Review-Gate bleiben.
