# Claude Code – Auftrag #5: Monteur-PDF + Feinschliff (professionell)

## Kontext

Aufträge #1–#4 sind live. Spez: `SPEZ-arbeitsitems.md`.  
Bekannte Lücke aus #3: Monteure können Block-PDFs **nicht** öffnen (`/documents/:id/download` ist nur Büro-Rollen).  
Kunden-PL hat bereits einen eng geschnittenen Foto-Endpoint – **analog** für Monteur-PDF.

Dieser Auftrag: **sicherer PDF-Zugriff für Monteure** + **professioneller Feinschliff**. Kein Feature-Creep.

---

## Teil A — Monteur-PDF (Priorität)

### A.1 API (sicher, eng)

Neuer Endpoint, z. B.:

`GET /workers/me/work-items/:id/pdf`

Regeln (alle müssen gelten):

1. Auth: Worker-Token (oder User mit verknüpftem Worker), Auflösung wie bestehende Worker-Work-Item-Endpoints
2. Item existiert
3. Worker ist dem **Projekt** aktiv zugeordnet (`ProjectAssignment`) **oder** hat aktives `WorkItemAssignment` an diesem Item (konsistent zu claim/findOneForWorker)
4. PDF-Quelle: `item.block.pdfDocumentId` (bevorzugt). Fallback nur wenn klar definiert und sicher – sonst 404 mit klarer Message „Kein PDF verknüpft“
5. Stream/Download wie Documents-Service intern (nicht die öffentlichen Roles am DocumentsController umgehen, indem man den Controller öffnet – **stattdessen** internen Service-Aufruf + eigener Controller)
6. Optional Query `?inline=1` für Mobile-Viewer
7. Audit/log bei Bedarf debug-level; keine Secrets in Logs
8. **Kein** genereller Document-Download für WORKER-Rolle

Antwort: PDF-Binary mit korrektem `Content-Type` / `Content-Disposition`.

README im work-items-Modul aktualisieren.

### A.2 Mobile

In `apps/mobile/app/(app)/work-items/[id].tsx`:

- Button **„Plan / PDF“** (DE+SK) nur wenn `block.pdfDocumentId` bzw. API signalisiert PDF vorhanden
- Öffnen: zuerst URL mit Auth – Mobile kann nicht einfach Bearer in Safari. Optionen (eine wählen, robust):
  - **Empfohlen:** App lädt Blob/ArrayBuffer mit Bearer → lokale Cache-Datei (`expo-file-system`) → `Sharing` / `Linking` / `WebBrowser` / `expo-intent-launcher` je Plattform
  - Oder WebView mit temporärem Token – nur wenn schon Pattern existiert
- Ladezustand + Fehlertexte DE+SK
- Seite `pdfPage` als Hinweistext anzeigen („Seite X“) – PDF-Jump auf Seite ist Nice-to-have, nicht Pflicht wenn Viewer das nicht kann

`lib/work-items.ts` + `i18n-work-items.ts` ergänzen.

### A.3 Web Büro / PL

Nur falls nötig: nichts brechen. Büro öffnet PDF weiter über Documents. Keine Pflichtänderung.

---

## Teil B — Feinschliff (begrenzt)

Nur diese Punkte, nicht mehr:

1. **Historie im Monteur-Detail:** Rückmeldungen/Kontrollen klar lesbar (falls schon da: UX-Polish, keine Doppelimplementierung)
2. **Dashboard-Hinweis** nach Clock-Out: optional einzeilig DE+SK „Offene Items bleiben dir zugeordnet“ – nur wenn unaufdringlich und bestehendes Layout nicht sprengt
3. **API-Konsistenz:** `findOneForWorker` liefert `block.pdfDocumentId` und ggf. `hasPdf: boolean` für UI
4. **Kleine Bugfixes**, die beim Lesen des Codes offensichtlich sind und Work-Items betreffen (kein Refactor-Tourismus)
5. Kurz Smoke-Hinweise in README: PDF-Endpoint manuell testen

**Nicht** in diesem Auftrag:

- Kein EAS/APK-Build (Operator baut APK separat; Code muss exportierbar/`tsc` grün sein)
- Keine Abrechnung APPROVED→Invoice
- Kein PDF-OCR
- Kein Kunden-PL-PIN
- Keine Checklisten-Checkboxen digital (SPEZ 11.6)
- Keine neuen großen Screens

---

## Qualität / Vorsicht

- Bestehende Stempel-, PL- und Büro-Flows regressiv schützen
- Rechte **eng** halten (Prinzip Least Privilege)
- TypeScript grün: `@office/api` build + mobile `tsc --noEmit`
- Keine Secrets, keine `any`-Orgien, Stil an bestehende Module

---

## Abnahme

- [ ] Worker mit Projektzugriff: `GET .../work-items/:id/pdf` → 200 PDF
- [ ] Worker ohne Zugriff / fremdes Item → 403/404
- [ ] Item ohne Block-PDF → 404 klare Message
- [ ] Büro-Document-Download unverändert rollenbasiert
- [ ] Mobile: Button öffnet PDF (oder speichert/teilt) ohne Crash
- [ ] Stempel-UI unverändert nutzbar
- [ ] Builds grün

---

## Commit

`feat: Monteur-PDF für Arbeitsitems und Feinschliff`

inkl. `claude-auftraege/claude-arbeitsitems-05-pdf-feinschliff.md`  
Kein push.

Ende Auftrag #5.
