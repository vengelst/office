# Claude / Cloud – Auftrag #7: PDF-Primärimport Arbeitsitems

## Kontext

Repo: Office-Monorepo (`apps/api` NestJS, `apps/web` Next.js, `prisma/`).  
Produktion: `office.vivahome.de` / `/opt/office`. Bestehende Module nicht regressiv brechen.

**Spezifikation (verbindlich):** `SPEZ-arbeitsitems.md` §10–§11, §15–§17 (Stand 08.08.2026)  
**Ideen:** `ideen.md` – PDF-Primärimport  
**Bestehend:** Excel-Import + Block-PDF-Link (kein Seitensplit)

Dieser Auftrag: **PDF-Primärimport Minimal-Modus + Büro-UI**.  
**Nicht** in diesem Auftrag: Kartentyp-Template-Editor (Feld-Zeichnen), LLM-Extraktion, Material-Pflicht, Mobile-Änderungen außer falls PDF-Seitenanzeige trivial.

---

## Ziel

Büro kann:

1. Ein **Mehrseiten-PDF** (typisch 20–50 Seiten) an ein item-basiertes Projekt hochladen
2. System legt **1 Item je PDF-Seite** an (Regel: 1 Seite = 1 Order)
3. **Vorschau → Korrektur Kennung/Titel → Commit** (nie blind)
4. Items landen als `OPEN` im Pool, mit `pdfPage` + Block-PDF-Verknüpfung
5. Excel-Import bleibt, UI kennzeichnet ihn als **Fallback**
6. Material in DB **optional** (nicht aus PDF erzwingen)

---

## Ist-Zustand (kurz)

- Excel: `POST /projects/:projectId/work-items/import` + `/import/preview`  
  (`work-item-import.service.ts`, `import-section.tsx`)
- Block-PDF: Document-Upload + `pdfDocumentId` am Block (`blocks-section.tsx`)
- WorkItem hat bereits `pdfFile`, `pdfPage`, `workScopeDe/Sk`, `itemKey`
- **Kein** DRAFT-Status nötig: Preview wie Excel `dryRun`, Commit schreibt `OPEN`
- OCR-Service existiert, aber **nicht** anbinden in diesem Auftrag (Minimal-Modus)

---

## 1. Backend API

Neu unter `apps/api/src/work-items/` (Service z. B. `work-item-pdf-import.service.ts`).

### 1.1 Seiten zählen

- Library: `pdf-lib` oder gleichwertig leichtgewichtig (im API-Paket)
- Input: PDF-Buffer → `pageCount`
- Fehler bei 0 Seiten / ungültigem PDF klar melden

### 1.2 Preview

`POST /projects/:projectId/work-items/import-pdf/preview`  
Multipart: `file` (PDF), Felder:

| Feld | Default | Bedeutung |
|---|---|---|
| `blockKey` | Pflicht | Block-Kennung (neu oder bestehend) |
| `blockName` | optional | Anzeigename Block |
| `itemKeyPrefix` | `Seite-` | Präfix für Platzhalter-Kennungen |
| `startPage` | `1` | inklusiv |
| `endPage` | letzte Seite | inklusiv |
| `setItemBased` | `true` | wie Excel-Import |

Response z. B.:

```json
{
  "pageCount": 42,
  "blockKey": "Block-1",
  "items": [
    {
      "pdfPage": 1,
      "itemKey": "Seite-01",
      "title": "Seite 1",
      "workScopeDe": null,
      "conflicts": []
    }
  ],
  "warnings": ["itemKey Seite-01 existiert bereits – Commit würde upserten"]
}
```

- `itemKey`: `Seite-01` … zero-padded nach Stellen von `endPage`
- Bestehende `itemKey` im Projekt als Warning (Commit = Upsert wie Excel: Metadaten/`pdfPage` aktualisieren, Status bestehender Items **nicht** zurücksetzen)

### 1.3 Commit

`POST /projects/:projectId/work-items/import-pdf`  
Multipart: gleiches PDF **oder** `pdfDocumentId` wenn Datei schon hochgeladen + JSON-Body/Feld `items` mit editierter Liste:

```json
{
  "blockKey": "Block-1",
  "blockName": "Block 1",
  "pdfDocumentId": optional,
  "setItemBased": true,
  "items": [
    { "pdfPage": 1, "itemKey": "05-A-01", "title": "…", "workScopeDe": "…" }
  ]
}
```

Ablauf Commit:

1. PDF als Document speichern (`DRAWING` / PROJECT) falls kein `pdfDocumentId`
2. Block upsert per `blockKey`, `pdfDocumentId` setzen
3. Je Item: upsert `(projectId, itemKey)` mit `blockId`, `pdfPage`, `pdfFile` (Document-Dateiname oder Originalname), `title`, `workScopeDe/Sk` falls gesetzt
4. Neue Items: Status `OPEN`, keine Zuordnung
5. `itemBased=true` wenn Flag
6. Response: Counts created/updated + blockId + documentId

Auth/Rollen: wie bestehende Work-Items-Project-Routen (`OFFICE`, `PROJECT_MANAGER`, `SUPERADMIN`).

### 1.4 Validierung

- Duplikate `itemKey` in derselben Commit-Liste → 400
- `pdfPage` eindeutig und im Seitenbereich
- Max. Seiten sinnvoll begrenzen (z. B. 200) mit klarer Fehlermeldung
- Max. Upload-Größe an bestehende Document-/Import-Limits anlehnen

### 1.5 README

`apps/api/src/work-items/README.md` um PDF-Import-Endpunkte ergänzen.

---

## 2. Frontend Büro

### 2.1 API-Client

`apps/web/src/lib/work-items.ts`: `previewPdfImport`, `runPdfImport` (Multipart + typisierte Responses).

### 2.2 UI im Tab Arbeitsitems

Neue Section **„PDF-Import“** (Primär), sichtbar wenn `itemBased` (oder Import darf `setItemBased` setzen – wie Excel).

Datei neu z. B. `…/work-items/pdf-import-section.tsx`, einbinden in `work-items-tab.tsx` **vor** Excel-Import.

Flow:

1. PDF wählen + `blockKey` (+ optional Name, Seitenbereich, Prefix)
2. **Vorschau** → Tabelle: Seite | Kennung (editierbar) | Titel (editierbar) | Arbeitsinhalt DE (editierbar) | Warnungen
3. **Übernehmen / Commit** → Toast + Items/Blöcke neu laden
4. Hinweis: 1 Seite = 1 Auftrag; Bauteile bleiben im PDF; Kennungen vor Commit anpassen

Excel-Section (`import-section.tsx` / Texte): Titel/Untertitel auf **„Excel/CSV-Fallback“** umstellen, Hinweis auf PDF-Primärweg.

### 2.3 Texte

`apps/web/src/lib/texts.ts` unter `projects.workItems` ergänzen (kein Hardcode).

### 2.4 Blöcke

Bestehende Blocks-Section unverändert nutzbar; Commit darf Block inkl. PDF setzen. Kein doppelter Zwang, PDF vorher manuell zuzuweisen.

---

## 3. Explizit nicht tun

- Kein Template-Editor (Zonen zeichnen)
- Keine OCR/LLM-Feld-Extraktion in diesem Auftrag
- Keine neue Prisma-Migration außer falls absolut nötig (Schema-Felder reichen)
- Kein DRAFT-Enum
- Mobile/Kiosk/PWA unangetastet (Monteur öffnet weiter Block-PDF; `pdfPage` bleibt Metadatum)
- Keine Änderung am Stunden-/Überstunden-Flow
- Keine Abrechnung aus Items

---

## 4. Qualität

- Bestehende Patterns: Guards, ApiError-Toasts, Touch ≥44px, `texts.ts`
- JSDoc an neuen Public-Methods
- Manuell/Smoke: Typecheck der geänderten Pakete soweit im CI/lokal üblich
- Kurzer Self-Check am Ende des Auftrags in einer Notizdatei  
  `claude-auftraege/claude-arbeitsitems-07-notizen.md` (was gebaut, Entscheidungen, Rest)

---

## 5. Akzeptanzkriterien

| # | Kriterium |
|---|---|
| 1 | Preview eines 3+ Seiten-PDFs liefert 3+ Zeilen mit `pdfPage` + Platzhalter-`itemKey` |
| 2 | Nach Edit der Kennungen und Commit existieren Items `OPEN` mit korrektem `pdfPage` und Block-PDF |
| 3 | Zweiter Commit mit gleicher Kennung upsertet ohne Status-Reset |
| 4 | Excel-Import funktioniert weiter; UI sagt Fallback |
| 5 | Material wird nicht aus PDF erzwungen |
| 6 | Rollen/Auth analog zu bestehendem Import |
| 7 | `SPEZ-arbeitsitems.md` §10 Minimal-Modus ist damit abgedeckt; Template/OCR bleiben offen |

---

## 6. Commit-Stil

Kleine, klare Commits oder ein sauberer Feature-Commit:

`feat: PDF-Primärimport für Arbeitsitems (1 Seite = 1 Order)`

Branch von `main`, PR nicht zwingend wenn Repo-Workflow Direct-to-main – dem bestehenden Cloud-/Repo-Workflow folgen. Am Ende: pushfähig, deploybar.
