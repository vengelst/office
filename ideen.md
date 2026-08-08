# Ideen & Notizen

Sammlung von Ideen, die später umgesetzt oder geprüft werden sollen.

---

## Offene Ideen

<!-- Neue Ideen hier eintragen -->

### [2026-08-08] – Kartentyp-Template + OCR/LLM für PDF-Import

Minimal-Modus (PDF → 1 Item/Seite → Vorschau → Commit) ist umgesetzt. Offen:

1. Kartentyp-Template (Beispielseite, Felder zuordnen) – Layouts je Kunde unterschiedlich
2. Extraktion Kennung + Arbeitsinhalt aus der Seite (OCR/LLM)
3. Optional Seiten-Thumbnails in der Vorschau

### [2026-08-08] – Abrechnung aus geprüften Arbeitsitems (UNIT_BASED)

Arbeitsitems (Import, Monteur-Flow, Kunden-PL-Prüfung) sind umgesetzt. Offen bleibt die
**automatische bzw. geführte Abrechnung** aus Items mit Status **Geprüft**:

1. Positionen/Mengen aus geprüften Items in Rechnungszeilen übernehmen
2. `billingMode: UNIT_BASED` / `MIXED` mit dem Item-Workflow verdrahten
3. Büro-UI: „Rechnung aus geprüften Items“ (Filter nach Block/Zeitraum)

**Bezug:** `SPEZ-arbeitsitems.md`, `billingMode` im Projekt-Modul.

---

## Umgesetzt / Erledigt

### [2026-06-30 → 2026-08] – Leistungspositionen / Arbeitsitems

Excel-Import → Items im Projekt, Monteur-UI (App + Web/PWA/Kiosk), Fertig/Nacharbeit,
Büro-Übersicht, Kunden-PL-Board. Siehe `SPEZ-arbeitsitems.md` und `STATUS.md` §20.

**Rest:** Abrechnung aus geprüften Items → siehe offene Idee oben.

### [2026-06-30 → 2026-07] – Auto-Recherche beim Anlegen neuer Kunden

Research-Microservice (Playwright + LLM) + Proxy in der API + Vorschau-Dialog mit
selektiver Übernahme im Kundenformular. Auch für Ausschreibungen genutzt.

**Repo:** ausgelagert nach `address_pull` / Container `research-service`.
