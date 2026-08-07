# Spezifikation: Item-/Positionsbasierte Arbeitszuteilung

**Status:** Konzept / Umsetzungsgrundlage (noch nicht implementiert)  
**Stand:** 07.08.2026  
**Bezug:** Office-App (Web + Monteur-App), Zeiterfassung, Abrechnung  
**Beispiel-Unterlage:** TAS Arbeitskarte (Montage- und Prüfdokumentation), z. B. Positions-ID `05-A-01`

---

## 1. Ziel

Monteuren über die App konkrete Arbeitseinheiten (**Items**) zuteilen bzw. zur Selbstbedienung bereitstellen. Der Monteur arbeitet Items ab, meldet Fertigstellung inkl. Fotos oder Nacharbeit. Der **Kunden-PL** (eigene Rolle) steuert Fortschritt, prüft und zeichnet Wochenzeiten ab.

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
| **Kunden-PL** | Projektleiter vom Kunden; **eigene Rolle** `CUSTOMER_PL`, unabhängig von internen Rollen |

Die Kennung heißt nicht zwingend „Positionsnummer“ – sie kann auch Raumnummer o. Ä. sein. In der UI: neutrales Label je nach Projektkonfiguration möglich.

---

## 4. Rollen & Rechte

### 4.1 Monteur

- Stempelt am **Projekt** (bestehende Zeiterfassung).
- Nimmt Items anhand der **Kennung**.
- Wechselt bewusst das **aktuelle Item** (Zeitzuordnung).
- Sieht Aufgabe + Unterlage (PDF Block oder Einzelseite) inkl. Materialtabelle.
- Meldet:
  - **Fertig** → Pflicht: mindestens **2–3 Fotos** (Upload über bestehende App-Funktion)
  - **Nacharbeit** → Item ist **nicht fertig**; bleibt beim Monteur
- UI zweisprachig **DE + SK** (Labels wie auf der Arbeitskarte).

### 4.2 Kunden-PL (`CUSTOMER_PL`) — eigene Rolle

**Festgelegt:** Kunden-PL hat eine **eigene Rolle** und hat **nichts mit internen Rollen** zu tun (kein `PROJECT_MANAGER` / Office-User-Reuse).

- Eigene Rolle im System: `CUSTOMER_PL`
- Login wie andere Nutzer, **auch mit PIN**
- Wird beim Projekt-Setup dem Projekt zugeordnet (**einer oder mehrere**)
- Rechte (projektbezogen):
  - Fortschritt sehen: offen / in Arbeit / Kontrolle / Nacharbeit / geprüft
  - Erledigte Items laufend prüfen → **OK / Geprüft**
  - Items **selbstständig fertigsetzen** → Monteur(e) verlieren die Zuordnung
  - **Stundenzettel je Woche** abzeichnen
- Kein Zugriff auf interne Office-Funktionen (Stammdaten, Einstellungen, fremde Projekte usw.), außer was für PL-Prüfung und Wochenabzeichnung nötig ist

### 4.3 Internes Office / interner PL

- Projekt anlegen, Item-Modus aktivieren
- Monteure + **Kunden-PL** zuordnen
- Block-PDFs und/oder Einzelseiten hochladen
- Items + Material aus Planung importieren (Abschnitt 10)
- Interne Rollen (`OFFICE`, `PROJECT_MANAGER`, …) bleiben getrennt vom Kunden-PL

---

## 5. Statusmodell

| Status | Wer setzt | Bedeutung |
|---|---|---|
| **Offen** | System / Import | Im Pool, noch niemandem zugewiesen / nicht in Arbeit |
| **In Arbeit** | Monteur (nimmt Item) | Bei diesem/diesen Monteur(en) |
| **Kontrolle** | Monteur meldet fertig + Fotos | Wartet auf Kunden-PL |
| **Nacharbeit** | Monteur (Fehler / nicht fertig) | Bleibt beim Monteur, der begonnen hat |
| **Geprüft** | Kunden-PL (OK) oder Kunden-PL setzt selbst fertig | Abrechenbar (Kundenabrechnung) |

### 5.1 Besitzregeln

- Solange an einem Item gearbeitet wird (In Arbeit / Nacharbeit / Kontrolle bis PL-OK), bleibt es beim Monteur.
- **Nacharbeit** = Position nicht fertig. Bleibt beim Monteur, der mit der Position begonnen hat. Er verliert sie erst, wenn der **Kunden-PL OK gibt** (oder selbst fertigsetzt).
- **Kunden-PL setzt selbst fertig** → Monteur verliert die Position sofort.
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
5. Unterlage öffnen (PDF) + Materialzeilen sehen.
6. Arbeiten.
7. Rückmeldung:
   - Fertig + ≥2–3 Fotos → **Kontrolle**
   - Nacharbeit + optional Fotos/Bemerkung → **Nacharbeit**
8. Nächstes Item wählen oder Feierabend (Ausstempeln).
9. Nächster Tag: nicht abgeschlossene Items weiter bearbeiten.

---

## 7. Arbeitsflow Kunden-PL

1. Login (auch PIN).
2. Fortschrittsübersicht je Projekt/Block/Item.
3. Laufend: Items in **Kontrolle** prüfen → **Geprüft** (Abrechnung).
4. Bei Bedarf: selbst fertigsetzen.
5. Nacharbeit: OK erst wenn erledigt / freigegeben.
6. Wöchentlich: Stundenzettel der Monteure abzeichnen.

---

## 8. Zeitmodell

### 8.1 Projektstunden (Lohn)

- Unverändert über Stempel Clock-In/Out.
- Wochen-Stundenzettel; **Kunden-PL zeichnet je Woche ab**.

### 8.2 Item-Zeit (Auswertung Dauer je Position)

Item-Zeit = Summe der Intervalle, in denen gilt:

> Monteur ist **am Projekt gestempelt** **UND** hat dieses Item als **aktuelles Item** gewählt.

- Wechsel weg vom Item → Intervall endet.
- Ausstempeln / Feierabend → Intervall endet.
- Nächster Tag, Item wieder als aktuell gewählt → neues Intervall.
- **Keine** durchlaufende Uhr von „genommen“ bis „fertig“ über Nacht/Pausen.

### 8.3 Historie / Audit (muss speicherbar sein)

- Kennung und Metadaten
- Materialzeilen
- Welche Monteure wann zugeordnet / aktiv waren
- Fertig-/Nacharbeits-Meldungen inkl. Fotos und Zeitstempel
- Welcher Kunden-PL geprüft oder selbst fertiggesetzt hat, wann
- Intervalle / Summe der Item-Arbeitszeit je Monteur

---

## 9. Abrechnung

| Was | Wann |
|---|---|
| Kunde / Position | Erst bei Status **Geprüft** (derzeit) |
| Monteur | Nach Stunden (Stundenzettel), nicht nach Item-Stück |

Nacharbeit und „nur Kontrolle“ sind **nicht** abrechenbar.

---

## 10. Datenquellen: PDF-Upload + Excel/CSV-Import

### 10.1 Entscheidung

| Inhalt | Quelle |
|---|---|
| Visuelle Unterlage (Planausschnitt, Kartenlayout) | **PDF-Upload** am Projekt (Block-PDF und/oder Einzelseiten) |
| Steuernde Stammdaten je Item | **Excel/CSV-Import** |
| Material je Item | **eigene Materialtabelle** (Import als Zeilen, nicht nur Freitext) |

**Kein PDF-OCR als Primärweg.** PDF = Beleg/Unterlage. Excel = DB-Inhalt.

### 10.2 PDF-Bereitstellung

- Pro Block ein PDF **oder** Einzelseiten je Item
- Upload im Projekt
- Item referenziert `pdfFile` + `pdfPage` (bzw. Einzelseite)

---

## 11. Import-Vorlage (verbindlich für Datenlieferung)

Abgeleitet vom Beispielblatt **TAS Arbeitskarte 05-A-01**. Spätere Lieferungen folgen diesem Format.

### 11.1 Datei A — Items (eine Zeile = ein Item)

| Spalte | Pflicht | Beispiel `05-A-01` | Bedeutung |
|---|---|---|---|
| `blockKey` | ja | `Block-1` | Block-Zuordnung (PDF-Gruppe) |
| `itemKey` | ja | `05-A-01` | Kennung zum Nehmen; eindeutig im Projekt |
| `title` | nein | `TAS Arbeitskarte 05-A-01` | Anzeigename; Default = `itemKey` |
| `floor` | empfohlen | `5` | Geschoss |
| `area` | empfohlen | `A` | Bereich |
| `room` | empfohlen | `Lift Lobby` | Raum / Lage |
| `type` | empfohlen | `1uZsFZ(A)` | Typ |
| `rc` | empfohlen | `3` | RC |
| `detail` | empfohlen | `(05-A-01)` | Detail |
| `planPage` | empfohlen | `1` | Planseite (Quelle Planausschnitt) |
| `sheetNo` | optional | `1` | Blatt-Nr. der Arbeitskarte |
| `sheetTotal` | optional | `15` | Blätter gesamt im Block-Kontext |
| `pdfFile` | empfohlen | `block-1.pdf` | Dateiname des hochgeladenen Block-PDFs |
| `pdfPage` | empfohlen | `1` | Seite in diesem PDF |
| `workScopeDe` | empfohlen | s. Karte | Arbeitsumfang Deutsch |
| `workScopeSk` | empfohlen | s. Karte | Arbeitsumfang Slowakisch |
| `siteName` | optional | `Deutsche Bank - Skypark Business Center` | nur wenn nicht schon am Projekt |
| `siteAddress` | optional | `1 Avenue de l'Aeroport, L-1110 Findel, Luxemburg` | nur wenn nicht schon am Projekt |

**Nicht importieren** (kommt aus App/System): Monteur, Datum, Status, Prüfung, Abnahme, Bemerkung, Fotos, Planausschnitt-Bild.

### 11.2 Datei B — Material (eine Zeile = eine Materialposition)

Eigene Tabelle in der DB: **`WorkItemMaterial`**.

| Spalte | Pflicht | Beispiel | Bedeutung |
|---|---|---|---|
| `itemKey` | ja | `05-A-01` | Verknüpfung zum Item |
| `sortOrder` | empfohlen | `1` | Reihenfolge |
| `qty` | empfohlen | `1` / `2` / `n. Detail` | Menge oder Hinweis |
| `qtyUnit` | empfohlen | `Stk.` / `Satz` | Einheit (leer bei `n. Detail`) |
| `materialDe` | ja | `Türverteiler TV inkl. 40-DA-Anschluss` | Bezeichnung DE |
| `materialSk` | empfohlen | `dverový rozvádzač …` | Bezeichnung SK |

**Beispiel Materialzeilen zum Blatt 05-A-01:**

| sortOrder | qty | qtyUnit | materialDe |
|---|---|---|---|
| 1 | 1 | Stk. | Türverteiler TV inkl. 40-DA-Anschluss |
| 2 | 2 | Stk. | Square-Mifare Leser inkl. AP-Rahmen |
| 3 | n. Detail | | REX-Bewegungsmelder |
| 4 | n. Detail | | MK-, RK- und SVP-Anschlüsse |
| 5 | n. Detail | | Fluchtwegterminal/-technik |
| 6 | 1 | Satz | Leitungs-, Befestigungs- und Beschriftungsmaterial |

### 11.3 Beispiel-CSV Item (Kopf)

```csv
blockKey;itemKey;title;floor;area;room;type;rc;detail;planPage;sheetNo;sheetTotal;pdfFile;pdfPage;workScopeDe;workScopeSk
Block-1;05-A-01;TAS Arbeitskarte 05-A-01;5;A;Lift Lobby;1uZsFZ(A);3;(05-A-01);1;1;15;block-1.pdf;1;Position nach Typ 1uZsFZ(A) und Detail (05-A-01) ausführen: Anschlusspunkt und Leitungsweg prüfen, eingezeichnete Zutritts-/Türkomponenten montieren und anschließen, beschriften, in Betrieb nehmen und 1.1-Funktionstest dokumentieren.;
```

### 11.4 Beispiel-CSV Material (Kopf)

```csv
itemKey;sortOrder;qty;qtyUnit;materialDe;materialSk
05-A-01;1;1;Stk.;Türverteiler TV inkl. 40-DA-Anschluss;
05-A-01;2;2;Stk.;Square-Mifare Leser inkl. AP-Rahmen;
05-A-01;3;n. Detail;;REX-Bewegungsmelder;
05-A-01;4;n. Detail;;MK-, RK- und SVP-Anschlüsse;
05-A-01;5;n. Detail;;Fluchtwegterminal/-technik;
05-A-01;6;1;Satz;Leitungs-, Befestigungs- und Beschriftungsmaterial;
```

### 11.5 System nach Import

- Item-Status = `Offen`
- keine Monteur-Zuordnung
- Materialzeilen an `itemKey` verknüpft
- Import-Timestamps

### 11.6 Checkliste „Ausführung und Kontrolle“

Die 5 Checkboxen auf der Karte werden **nicht** als Importfelder geführt. Perspektivisch feste System-Checkliste (DE+SK) oder später konfigurierbar — nicht Teil der Excel-Pflichtlieferung.

---

## 12. Empfohlene Datenobjekte (konzeptionell)

- **RoleCode:** neue Rolle `CUSTOMER_PL` (getrennt von `PROJECT_MANAGER`)
- **Project** – Flag/Modus „item-basiert“
- **ProjectBlock** – `blockKey`, Name, PDF-Dokument-Ref
- **WorkItem** – Kennung (`itemKey`), Metadaten, Status, Block, PDF-Ref, Arbeitsumfang DE/SK
- **WorkItemMaterial** – qty, qtyUnit, materialDe, materialSk, sortOrder → Item
- **WorkItemAssignment** – Monteur, aktiv von–bis
- **WorkItemSession** – Zeitintervalle (aktuelles Item ∩ gestempelt)
- **WorkItemReport** – Fertig / Nacharbeit, Fotos, Bemerkung, Zeitstempel
- **WorkItemReview** – Kunden-PL, Aktion (geprüft / selbst fertig), Zeitstempel
- **ProjectCustomerPlAssignment** – welche `CUSTOMER_PL`-User am Projekt

Bestehend weiter nutzen:

- `TimeEntry` / Wochen-Stundenzettel (Abzeichnung durch Kunden-PL)
- Dokumente / Foto-Upload
- Worker-PIN-Login (und PIN auch für Kunden-PL)

---

## 13. App-Oberflächen (grob)

### Monteur-App

- Projekt stempeln (bestehend)
- Items suchen/nehmen per Kennung; aktuelles Item wechseln
- Detail: Metadaten + Materialtabelle + PDF
- Fertig (≥2–3 Fotos) / Nacharbeit
- Offene Items nach Login am Folgetag

### Web Büro (intern)

- Item-Modus, Monteure, **Kunden-PL** zuordnen
- PDF-Upload, Excel-Import (Items + Material)
- Item-Board / Auswertung

### Web / App Kunden-PL

- Board mit Stati, prüfen, selbst fertig
- Wochen-Stundenzettel abzeichnen
- Kein interner Office-Zugriff

Sprache Monteur-UI: **DE + SK**.

---

## 14. Nicht-Ziele (Phase 1)

- Kein PDF-OCR als Primärimport
- Keine Vermischung Kunden-PL mit interner `PROJECT_MANAGER`-Rolle
- Keine erzwungene 1:1-Aufteilung Wochenstunden → Items für Lohn
- Kein Mahnwesen

---

## 15. Offene Punkte (klein, Rest)

1. Konkrete Beispieldatei vom Benutzer im Format Abschnitt 11 (Inhalt später).
2. Bei Ausstempeln: UI-Hinweis „Item bleibt dir zugeordnet“ (ja/nein).
3. Ob Checkliste Phase 1 schon digital abhakbar ist oder erst später.

---

## 16. Kurzformel

> Item-Projekt = Excel-Import (Items + **Materialtabelle**) + PDF-Unterlagen.  
> Kunden-PL = eigene Rolle `CUSTOMER_PL`, getrennt von intern.  
> Monteur nimmt per Kennung, wechselt aktives Item, meldet fertig (≥2–3 Fotos) oder Nacharbeit.  
> Item-Zeit nur während gestempelt + aktives Item.  
> Kunden-PL prüft laufend und zeichnet Wochenstunden ab; Abrechnung erst bei Geprüft.

---

## 17. Referenz Beispielblatt → Felder-Mapping

| Auf der TAS-Karte | Import / System |
|---|---|
| Positions-ID | `itemKey` |
| Geschoss / Bereich | `floor` / `area` |
| Raum / Lage | `room` |
| Planseite(n) | `planPage` |
| Typ | `type` |
| RC / Detail | `rc` / `detail` |
| Materialliste | Tabelle `WorkItemMaterial` |
| Arbeitsumfang | `workScopeDe` / `workScopeSk` |
| Planausschnitt | nur PDF |
| Monteur / Datum / Status / Prüfung / Abnahme / Bemerkung | System-Workflow |
| Foto-Doku | App-Upload bei Fertigmeldung |

Ende der Spezifikation.
