# Cloud-Auftrag #26: Projektpläne mit Versionen + Kiosk-Download (nur aktuell)

## Kontext

Monteure brauchen Baupläne auf der Baustelle. Office will Pläne am Projekt versionieren (Revisionen zur Kontrolle), Monteure am **Kiosk** sollen aber **immer nur die aktuelle Version** laden können.

Bestehende Basis (nutzen, nicht neu erfinden):

- `Document` mit `version`, `replacesId`, **`isLatest`** (Replace setzt alt `isLatest=false`, neu `isLatest=true`)
- `DocumentType.DRAWING` („Zeichnung“) bereits im PROJECT-Kontext
- `DocumentsService.replace()` + Listenfilter `isLatest=true` existieren
- Projekt-Detail: Tab „Dokumente“ (`DocumentsTabV2`)
- Kiosk ist projektgebunden (`KioskConfig.projectId`)

## Ziel

1. Am **Projekt** einen eigenen Tab/Bereich **„Projektpläne“** (nicht nur im allgemeinen Dokumente-Tab versteckt).
2. Pläne als **versionierte Dokumente** (Upload, neue Version = Replace, Historie der alten Revisionen).
3. Klar sichtbar: welche Version **aktuell** ist (`isLatest` / Rev.-Nummer).
4. Am **Kiosk**: Download/Öffnen der **aktuellen** Pläne des Kiosk-Projekts — **keine** alten Revisionen.
5. Rechte: Office/PM pflegen; Monteure am Kiosk nur lesen/downloaden (aktuell).

## Produktentscheidungen (verbindlich)

| Thema | Entscheidung |
|--------|----------------|
| Was zählt als „Plan“ | `DocumentType.DRAWING` (Label UI: „Plan“ / „Projektplan“; bestehendes `DRAWING` beibehalten, Texte anpassen falls nötig) |
| Aktuell | `Document.isLatest === true` in der Versionskette; **kein** zweites Flag nötig |
| Alte Versionen | Sichtbar nur in Office unter Projektpläne → Versionshistorie; Kiosk liefert sie nie |
| Mehrere Pläne pro Projekt | Ja (z. B. Erdgeschoss, 1. OG) — je Plan eigene Versionskette über Replace |
| Neue Version | Immer über bestehenden Replace-Flow (nicht parallele „aktuelle“ Duplikate) |
| Kiosk-Ort | Terminal (projektgebunden): Button/Screen **„Pläne“** nach PIN-Login bzw. von der Hauptansicht erreichbar |
| Monteur-App | **Nicht** in diesem Auftrag (nur Kiosk). Optional als Follow-up |
| Offline | Nicht in v1 (Online-Download/Öffnen reicht) |

## Scope

### A) API

1. **Office (bestehende Document-APIs erweitern/klarstellen)**  
   - Liste Projektpläne: `entityType=PROJECT`, `entityId=:projectId`, `documentType=DRAWING`, default nur `isLatest=true`.  
   - Versionshistorie: bestehender Versions-Endpoint (oder `GET …/documents/:id/versions`) — alle Revisionen einer Kette für Office.  
   - Upload neuer Plan: `DRAWING` + Link PROJECT.  
   - Neue Version: `replace` auf dem aktuellen Dokument.

2. **Kiosk-öffentlich / Worker-Auth (neu, schmal)**  
   Endpoint z. B.:
   - `GET /kiosk/projects/:projectId/plans` → nur `{ id, title, originalFilename, mimeType, version, updatedAt, … }` mit **`isLatest=true`** und `DRAWING` und Link zum Projekt.  
   - `GET /kiosk/projects/:projectId/plans/:documentId/file` → Dateistream **nur wenn** Dokument zu diesem Projekt gehört, Typ DRAWING, **`isLatest=true`**. Sonst 404.

   Auth analog anderer Kiosk-/Worker-Routen (PIN-Session / Worker-Token / bestehendes Kiosk-Muster — **kein** freies Public ohne Auth).  
   Master-Monteur: gleiches Verhalten für das **aktuell gewählte** Projekt am Terminal.

3. **Kein** Endpoint, der alte Revisionen an Kiosk/Monteur ausliefert.

### B) Office-Web – Projekt-Detail

Neuer Tab **„Projektpläne“** neben Dokumente/Baustellenfotos:

- Liste der **aktuellen** Pläne (Titel, Dateiname, Rev./Version, Datum, Aktionen).
- Aktionen: Upload neuer Plan, **Neue Version** (Replace), Öffnen/Download, Versionshistorie (alte Revisionen nur ansehen/downloaden für Office).
- Badge **„Aktuell“** auf `isLatest`; in der Historie alte als „Rev. n“ ohne Aktuell-Badge.
- Texte DE in `texts/projects` (Tab-Label, leer-State, Hinweise).
- Allgemeiner Dokumente-Tab: DRAWING darf weiter erscheinen **oder** dort ausgeblendet/Hinweis „siehe Projektpläne“ — **eine** Variante wählen und konsistent halten (Empfehlung: in Dokumente weiterhin sichtbar, aber Pflege-Fokus im Tab Projektpläne).

### C) Kiosk-Terminal

- Button **„Pläne“** (groß, touch-freundlich, `min-h-[44px]`).
- Screen: Liste aktueller Pläne des Kiosk-`projectId` (Titel + Version).
- Tippen → Download bzw. in neuem Tab/Viewer öffnen (PDF/Bilder je nach `mimeType`).
- Leer-State: „Keine Pläne hinterlegt.“
- Fehler/401 klar melden; Debug-Log nur wenn Kiosk-Debug an.

### D) Nicht im Scope

- Monteur-App Download
- Push-Benachrichtigung bei neuem Plan
- Plan-Annotation / Markierungen
- OCR / automatische Rev.-Erkennung aus Dateiname
- Google-Drive-Sonderlogik über bestehendes Document-Sync hinaus

## UI-Texte (DE, Vorschlag)

- Tab: `Projektpläne`
- Leer: `Noch keine Pläne hinterlegt.`
- Hinweis: `Nur die aktuelle Version ist für Monteure am Kiosk sichtbar. Alte Versionen bleiben zur Kontrolle hier.`
- Kiosk-Titel: `Pläne`
- Kiosk-Leer: `Keine Pläne für dieses Projekt.`
- Badge: `Aktuell` / `Rev. {n}`

## Abnahme

1. Projekt: Tab Projektpläne → Plan hochladen → erscheint als Aktuell Rev. 1.  
2. Neue Version hochladen (Replace) → Rev. 2 aktuell; Rev. 1 nur in Historie.  
3. Kiosk am gleichen Projekt: Liste zeigt **nur** Rev. 2; Download liefert Rev.-2-Datei.  
4. Direkter Abruf alter `documentId` über Kiosk-File-URL → **404**.  
5. Zweites Projekt / anderer Kiosk sieht Pläne des anderen Projekts nicht.  
6. Ohne Auth kein Plan-Download.  
7. Build grün; nach Merge Deploy wie üblich (`--env-file .env.production`).

## Commit-Vorschlag

`feat(projects): Projektpläne mit Versionen und Kiosk-Download nur aktuell`

## Hinweise für die Umsetzung

- `isLatest` und `replace()` **wiederverwenden** — kein paralleles Versionsmodell.
- Kiosk-Endpoints strikt: Filter `projectId` + `DRAWING` + `isLatest`.
- Touch-UI Kiosk: große Trefferflächen, wenig Text.
- Bestehende Document-Rollen (OFFICE/PM Upload) nicht aufweichen.
