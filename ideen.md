# Ideen & Notizen

Sammlung von Ideen, die später umgesetzt oder geprüft werden sollen.

---

## Offene Ideen

### [2026-06-30] – Leistungspositionen aus Kunden-Excel als Arbeitsaufträge

Der Kunde liefert eine Excel-Liste mit Leistungspositionen (Tätigkeit, Maße, Preis, Zeitvorgabe). Diese Positionen sollen:
1. **Importiert** werden können (Excel-Upload → Positionen im Projekt)
2. Als **Arbeitsaufträge** für die Monteure erscheinen (im Kiosk/App sichtbar)
3. Vom Monteur **einzeln bestätigt/abgehakt** werden ("Position X erledigt")
4. Im Büro sichtbar sein: Welche Positionen sind erledigt, welche offen?
5. Grundlage für die **Maß-/Einheits-Abrechnung** (billingMode: UNIT_BASED)

**Verknüpfung:** Hängt zusammen mit dem Abrechnungsmodus "Nach Maß/Einheit" im Projekt-Modul. Wird als eigener Auftrag umgesetzt wenn die Basisfunktionen stehen.

### [2026-06-30] – Auto-Recherche beim Anlegen neuer Kunden (Web-Scraping / KI)

Wenn ein neuer Kunde angelegt wird, soll das System automatisch Informationen sammeln:
1. **Website des Kunden** crawlen → Hauptadresse, Impressum-Daten extrahieren
2. **Standorte/Niederlassungen** finden (z.B. von Standort-Seite oder Google Maps)
3. **Ansprechpartner/Mitarbeiter** suchen – auf der Kunden-Website, LinkedIn, Instagram, XING, etc.
4. Gefundene Daten als **Vorschläge** anbieten (nicht blind übernehmen)
5. Bei bestehenden Kontakten markieren: "Bereits bekannt / Kontakt vorhanden"

**Technisch:** Könnte über KI-Agenten (Web-Scraping + LLM-Extraktion) oder APIs (Google Places, LinkedIn API) gelöst werden. Datenschutz beachten (DSGVO – nur öffentlich verfügbare Daten).

**Priorität:** Komfort-Feature, nicht MVP-kritisch. Umsetzen wenn Kernmodule stehen.

---

## Umgesetzt / Erledigt

<!-- Erledigte Ideen hierher verschieben -->
