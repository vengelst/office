# Ideen & Notizen

Sammlung von Ideen, die später umgesetzt oder geprüft werden sollen.

---

## Offene Ideen

<!-- Neue Ideen hier eintragen -->

### [2026-08-09] – Roadmap: Kiosk-PL Board, PDF-Import, Offline, Mobile, Reporting

Umsetzung geplant (Reihenfolge flexibel):

1. ~~APK persistent (Volume-Mount)~~ → erledigt
2. ~~Kunden-PL Item-Board am `/kiosk/pl`~~ → erledigt (#11)
3. ~~PDF-Import Feinschliff~~ → erledigt (#12)
4. ~~Offline-Stempeln~~ → erledigt (#13)
5. Danach: Mobile Push/Biometrie/Branding (#9) → Reporting (#10)

### [2026-08-08] – Abrechnung aus geprüften Arbeitsitems (UNIT_BASED)

Arbeitsitems (Import, Monteur-Flow, Kunden-PL-Prüfung) sind umgesetzt. Offen bleibt die
**automatische bzw. geführte Abrechnung** aus Items mit Status **Geprüft**:

1. Positionen/Mengen aus geprüften Items in Rechnungszeilen übernehmen
2. `billingMode: UNIT_BASED` / `MIXED` mit dem Item-Workflow verdrahten
3. Büro-UI: „Rechnung aus geprüften Items“ (Filter nach Block/Zeitraum)

**Bezug:** `SPEZ-arbeitsitems.md`, `billingMode` im Projekt-Modul.

### [2026-08-08] – PDF-Import Feinschliff (optional)

Templates + OCR-Extraktion sind live. Optional später:

1. Drag&Drop-Zone-Editor auf der Beispielseite
2. Progress/SSE bei sehr großen PDFs (>50 Seiten)
3. LLM-Fallback falls Label/Regex nicht reicht

---

## Umgesetzt / Erledigt

### [2026-08-09] – Kunden-PL Kiosk-PIN + Stundenzettel-E-Mail

Kiosk-Modus Kunden-PL (`/kiosk/pl`): PIN, Stundenliste, Signatur/Approve.
Zustell-E-Mail am PL; nach Approve PDF-Mail. Aufträge #9 / #10.

### [2026-08-09] – Mobiles Office-Menü scrollbar

Hamburger-Sheet: Overflow-Container, untere Nav-Punkte erreichbar.

### [2026-08-08] – Kartentyp-Templates + OCR-Extraktion

Template-CRUD, Kalibrierung per Beispielseite, `pdftoppm` + OCR je Seite beim
PDF-Preview, vorausgefüllte Kennung/Arbeitsinhalt. Siehe Auftrag #8.

### [2026-08-08] – PDF-Primärimport Minimal-Modus

Mehrseiten-PDF → 1 Item/Seite → Vorschau → Commit. Excel nur Fallback.

### [2026-06-30 → 2026-08] – Leistungspositionen / Arbeitsitems

Excel-Import → Items im Projekt, Monteur-UI (App + Web/PWA/Kiosk), Fertig/Nacharbeit,
Büro-Übersicht, Kunden-PL-Board. Siehe `SPEZ-arbeitsitems.md` und `STATUS.md` §20.

**Rest:** Abrechnung aus geprüften Items → siehe offene Idee oben.

### [2026-06-30 → 2026-07] – Auto-Recherche beim Anlegen neuer Kunden

Research-Microservice (Playwright + LLM) + Proxy in der API + Vorschau-Dialog mit
selektiver Übernahme im Kundenformular. Auch für Ausschreibungen genutzt.

**Repo:** ausgelagert nach `address_pull` / Container `research-service`.
