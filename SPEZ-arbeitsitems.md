# Spezifikation: Item-/Positionsbasierte Arbeitszuteilung

**Status:** Konzept / Umsetzungsgrundlage (noch nicht implementiert)  
**Stand:** 07.08.2026  
**Bezug:** Office-App (Web + Monteur-App), Zeiterfassung, Abrechnung  
**Beispiel-Unterlage:** TAS Arbeitskarte (Montage- und Prüfdokumentation), z. B. Positions-ID `05-A-01`

---

## 1. Ziel

Monteuren über die App konkrete Arbeitseinheiten (**Items**) zuteilen bzw. zur Selbstbedienung bereitstellen. Der Monteur arbeitet Items ab, meldet Fertigstellung inkl. Fotos oder Nacharbeit. Der Projektleiter (PL, oft vom Kunden) steuert Fortschritt, prüft und zeichnet Wochenzeiten ab.

**Zwei parallele Abrechnungsebenen:**

| Ebene | Zweck | Basis |
|---|---|---|
| Item / Position | Kundenfortschritt & Abrechnung | Status **Geprüft** |
| Stunde | Monteur-Vergütung | Bestehende Zeiterfassung + Wochen-Stundenzettel |

Stunden und Items werden **gekoppelt, aber nicht vermischt**.

---

## 2. Geltungsbereich

- Gilt für **alle Projekte, die auf Positions-/Item-Basis** abgearbeitet werden.
- Nicht item-basierte Projekte bleiben bei reiner Zeiterfassung wie bisher.
- Mischprojekte: Items + Stunden parallel möglich.

---

## 3. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Item** | Eine Arbeitseinheit am Projekt (intern einheitliches Objekt) |
| **Kennung** | Was der Monteur zum Greifen nutzt: Positionsnummer, Raumnummer oder ähnliche eindeutige Bezeichnung aus der Planung |
| **Block** | Gruppierung von Items; typisch **1 PDF pro Block** (Beispiel: 4 Blöcke = 4 PDFs) |
| **Aktuelles Item** | Das Item, dem gerade die Stempelzeit des Monteurs zugeordnet wird |
| **PL** | Projektleiter – oft vom Kunden; Login wie andere Nutzer, auch per PIN |

Die Kennung heißt nicht zwingend „Positionsnummer“ – sie kann auch Raumnummer o. Ä. sein. In der UI: neutrales Label je nach Projektkonfiguration möglich.

---

## 4. Rollen & Rechte

### 4.1 Monteur

- Stempelt am **Projekt** (bestehende Zeiterfassung).
- Nimmt Items anhand der **Kennung**.
- Wechselt bewusst das **aktuelle Item** (Zeitzuordnung).
- Sieht Aufgabe + Unterlage (PDF Block oder Einzelseite).
- Meldet:
  - **Fertig** → Pflicht: mindestens **2–3 Fotos** (Upload über bestehende App-Funktion)
  - **Nacharbeit** → Item ist **nicht fertig**; bleibt beim Monteur
- UI zweisprachig **DE + SK** (Labels wie auf der Arbeitskarte).

### 4.2 Projektleiter (PL)

- Wird beim Projekt-Setup zugeordnet (**einer oder mehrere**).
- Login wie alle anderen, **auch mit PIN**.
- Sieht: offen / in Arbeit / Kontrolle / Nacharbeit / geprüft.
- Prüft erledigte Items laufend → **OK / Geprüft**.
- Kann Items **selbstständig fertigsetzen** → Monteur(e) verlieren die Zuordnung.
- Zeichnet **Stundenzettel je Woche** ab (zusätzlich zur laufenden Positions-OK).

### 4.3 Büro / internes Office

- Projekt anlegen, Item-Modus aktivieren.
- Monteure + PL zuordnen.
- Block-PDFs und/oder Einzelseiten hochladen.
- Items aus Planung importieren (siehe Abschnitt 10).

---

## 5. Statusmodell

| Status | Wer setzt | Bedeutung |
|---|---|---|
| **Offen** | System / Import | Im Pool, noch niemandem zugewiesen / nicht in Arbeit |
| **In Arbeit** | Monteur (nimmt Item) | Bei diesem/diesen Monteur(en) |
| **Kontrolle** | Monteur meldet fertig + Fotos | Wartet auf PL |
| **Nacharbeit** | Monteur (Fehler / nicht fertig) | Bleibt beim Monteur, der begonnen hat |
| **Geprüft** | PL (OK) oder PL setzt selbst fertig | Abrechenbar (Kundenabrechnung) |

### 5.1 Besitzregeln

- Solange an einem Item gearbeitet wird (In Arbeit / Nacharbeit / Kontrolle bis PL-OK), bleibt es beim Monteur.
- **Nacharbeit** = Position nicht fertig. Bleibt beim Monteur, der mit der Position begonnen hat. Er verliert sie erst, wenn der **PL OK gibt** (oder der PL selbst fertigsetzt).
- **PL setzt selbst fertig** → Monteur verliert die Position sofort.
- Über **Tagesgrenze**: Ausstempeln beendet nur die Zeit, nicht die Item-Zuordnung. Am nächsten Tag liegen offene Items weiter beim Monteur.

### 5.2 Mehrere Monteure an einem Item

- Erlaubt.
- **Variante B (festgelegt):** Monteure sind gleichwertig. **Eine** Fertigmeldung (inkl. Fotopflicht) reicht → alle aktiven Monteure werden vom Item getrennt bzw. Item geht in **Kontrolle**.
- Nacharbeit bleibt bei den zugeordneten Monteuren bis PL-OK.

---

## 6. Arbeitsflow Monteur

1. Einstempeln am Projekt.
2. Offene / eigene Items sehen (Filter z. B. Block, Geschoss, Bereich).
3. Item per **Kennung** nehmen (oder weiterführen).
4. **Aktuelles Item** setzen/wechseln → ab jetzt läuft Item-Zeit.
5. Unterlage öffnen (PDF).
6. Arbeiten.
7. Rückmeldung:
   - Fertig + ≥2–3 Fotos → **Kontrolle**
   - Nacharbeit + optional Fotos/Bemerkung → **Nacharbeit**
8. Nächstes Item wählen oder Feierabend (Ausstempeln).
9. Nächster Tag: nicht abgeschlossene Items weiter bearbeiten.

---

## 7. Arbeitsflow PL

1. Login (auch PIN).
2. Fortschrittsübersicht je Projekt/Block/Item.
3. Laufend: Items in **Kontrolle** prüfen → **Geprüft** (Abrechnung).
4. Bei Bedarf: selbst fertigsetzen.
5. Nacharbeit steuern / OK geben, wenn erledigt.
6. Wöchentlich: Stundenzettel der Monteure abzeichnen.

---

## 8. Zeitmodell

### 8.1 Projektstunden (Lohn)

- Unverändert über Stempel Clock-In/Out.
- Wochen-Stundenzettel; **PL zeichnet je Woche ab**.

### 8.2 Item-Zeit (Auswertung Dauer je Position)

Item-Zeit = Summe der Intervalle, in denen gilt:

> Monteur ist **am Projekt gestempelt** **UND** hat dieses Item als **aktuelles Item** gewählt.

- Wechsel weg vom Item → Intervall endet.
- Ausstempeln / Feierabend → Intervall endet.
- Nächster Tag, Item wieder als aktuell gewählt → neues Intervall.
- **Keine** durchlaufende Uhr von „genommen“ bis „fertig“ über Nacht/Pausen.

So ist später nachvollziehbar, wie lange die Abarbeitung einer Position **wirklich** gedauert hat.

### 8.3 Was gespeichert werden muss (Historie / Audit)

Pro Item mindestens:

- Kennung und Metadaten (s. Importfelder)
- Welche Monteure wann zugeordnet / aktiv waren
- Fertig- und Nacharbeits-Meldungen inkl. Fotos und Zeitstempel
- Welcher PL geprüft oder selbst fertiggesetzt hat, wann
- **Summe / Intervalle der Item-Arbeitszeit** je Monteur

---

## 9. Abrechnung

| Was | Wann |
|---|---|
| Kunde / Position | Erst bei Status **Geprüft** (derzeit) |
| Monteur | Nach Stunden (Stundenzettel), nicht nach Item-Stück |

Nacharbeit und „nur Kontrolle“ sind **nicht** abrechenbar.

---

## 10. Datenquellen: PDF-Upload vs. strukturierter Import

### 10.1 Entscheidung (festgelegt als Empfehlung für die Umsetzung)

| Inhalt | Quelle | Warum |
|---|---|---|
| Visuelle Unterlage (Planausschnitt, Layout der Arbeitskarte) | **PDF-Upload** am Projekt (Block-PDF und/oder Einzelseiten) | Plan und Format bleiben lesbar; kein OCR nötig |
| Steuernde Stammdaten je Item | **Excel/CSV-Import aus der Planung** | Zuverlässig, versionierbar, filterbar, zuordenbar |

**Die App soll die Item-Stammdaten nicht aus dem PDF „selbst auslesen“ (OCR/Parsing) als Primärweg.**

Gründe gegen PDF-Primärimport:

- Arbeitskarten sind layoutstark (Planbild, zweisprachig, Checklisten) → OCR fehleranfällig.
- Kennungen und Felder müssen exakt stimmen (Zuweisung, Abrechnung, Historie).
- Planung liefert die Daten ohnehin strukturiert – Export nach Excel/CSV ist der saubere Weg.
- PDF bleibt als Beleg/Arbeitsunterlage am Item oder Block hängen.

Optional später (nicht Phase 1): Hilfs-OCR nur zur Vorbelegung, immer mit manueller Prüfung – kein Ersatz für den Import.

### 10.2 PDF-Bereitstellung

- Pro Block ein PDF (Beispiel: 4 Blöcke → 4 PDFs), **oder**
- Einzelseiten je Item,
- Upload im Projekt (bestehende Dokumentenablage nutzen / erweitern).
- Item referenziert Block-PDF und/oder konkrete Seite / Einzelseite.

### 10.3 Excel/CSV-Import – Pflicht- und Empfohlenfelder

Mindestens aus der Planung importieren:

| Feld | Pflicht | Beispiel / Hinweis |
|---|---|---|
| `projectId` / Projektzuordnung | ja | beim Import-Kontext |
| `blockKey` | ja | z. B. Block 1–4 |
| `itemKey` (Kennung) | ja | Positions-ID, Raumnummer, … – eindeutig im Projekt |
| `floor` / Geschoss | empfohlen | `5` |
| `area` / Bereich | empfohlen | `A` |
| `room` / Raum/Lage | empfohlen | `Lift Lobby` |
| `type` / Typ | empfohlen | `1uZsFZ(A)` |
| `rcDetail` | optional | `3 / (05-A-01)` |
| `planPage` | empfohlen | Seite im Block-PDF |
| `materialList` | empfohlen | Text oder strukturierte Zeilen |
| `workScope` | optional | Arbeitsumfang-Text |
| `pdfBlockRef` | empfohlen | Verweis auf hochgeladenes Block-PDF |
| `pdfPage` / Einzelseiten-Ref | optional | wenn Einzelseiten genutzt werden |

Zusätzlich systemseitig nach Import:

- Status = `Offen`
- keine Monteur-Zuordnung
- Timestamps Import

Material kann Phase 1 als Mehrzeilen-Text; später eigene Materialzeilen-Tabelle.

---

## 11. Empfohlene Datenobjekte (konzeptionell, noch kein Schema-Commit)

Nur zur Orientierung für die spätere Umsetzung:

- **Project** – Flag/Modus „item-basiert“
- **ProjectBlock** – Name/Key, PDF-Dokument-Ref
- **WorkItem** – Kennung, Metadaten, Status, Block, PDF-Ref
- **WorkItemAssignment** – Monteur, aktiv von–bis, Rolle am Item
- **WorkItemSession** – Zeitintervalle (aktuelles Item ∩ gestempelt)
- **WorkItemReport** – Fertig / Nacharbeit, Fotos, Bemerkung, Zeitstempel
- **WorkItemReview** – PL, Aktion (geprüft / selbst fertig), Zeitstempel
- **ProjectPlAssignment** – welche PL(s) am Projekt (Kunden-PL möglich)

Bestehend weiter nutzen:

- `TimeEntry` / Wochen-Stundenzettel (PL-Abzeichnung)
- Dokumente / Foto-Upload
- Worker-PIN-Login

---

## 12. App-Oberflächen (grob)

### Monteur-App

- Projekt stempeln (bestehend)
- Meine / offenen Items (Suche nach Kennung)
- Item nehmen / aktuelles Item wechseln
- Detail: Metadaten + PDF
- Fertig (Fotos Pflicht) / Nacharbeit
- Offene Items nach Login am Folgetag sichtbar

### Web (Büro + PL)

- Projekt: Item-Modus, Monteure, PL zuordnen
- PDF-Upload (Blöcke / Seiten)
- Excel/CSV-Import Items
- Item-Board / Liste mit Filtern und Stati
- PL: Kontrolle, selbst fertig, Historie
- PL: Wochen-Stundenzettel abzeichnen
- Auswertung: Item-Zeit, wer wann gearbeitet/geprüft hat

Sprache Monteur-UI: **DE + SK**.

---

## 13. Nicht-Ziele (Phase 1)

- Kein vollautomatisches Auslesen der Arbeitskarten-PDFs als einzige Datenquelle
- Keine erzwungene 1:1-Aufteilung der Wochenstunden auf Items für die Lohnabrechnung (Lohn bleibt stundenbasiert)
- Kein Mahnwesen / komplexes Kundenportal über PIN-PL hinaus
- Keine Änderung am Server-SSH-Port oder unrelated System-Info

---

## 14. Offene Punkte für die Umsetzungsplanung (klein)

1. Exakte Excel-Spaltennamen laut konkreter Planungs-Exportvorlage (mit Beispieldatei festnageln).
2. Ob Material Phase 1 nur Text oder schon Zeilen-Tabelle.
3. Ob bei Ausstempeln das „aktuelle Item“ nur die Session schließt oder zusätzlich UI-Hinweis „Item bleibt dir zugeordnet“.
4. Ob Kunden-PL dieselben Rollenrechte wie interner PL bekommt oder eine eingeschränkte Rolle „CUSTOMER_PL“.

---

## 15. Kurzformel

> Item-Projekt = Import der Items aus Planung + PDF-Unterlagen am Projekt.  
> Monteur nimmt per Kennung, wechselt aktives Item, meldet fertig (≥2–3 Fotos) oder Nacharbeit.  
> Item-Zeit nur während gestempelt + aktives Item.  
> PL prüft laufend Positionen und zeichnet Wochenstunden ab; Abrechnung Kunde erst bei Geprüft.  
> Mehrere Monteure: eine Fertigmeldung reicht.

---

## 16. Referenz Beispiel-Arbeitskarte (Felder)

Aus TAS Arbeitskarte (Beispiel `05-A-01`):

- Positions-ID / Kennung  
- Geschoss / Bereich  
- Raum / Lage  
- Planseite(n)  
- Typ  
- RC / Detail  
- Planausschnitt (nur im PDF)  
- Material- und Komponentenliste  
- Arbeitsumfang  
- Ausführung/Kontrolle (Checkliste – perspektivisch digital abbildbar)  
- Monteur / Datum / Status / Prüfung / Abnahme / Bemerkung (im System digital ersetzt)

Ende der Spezifikation.
