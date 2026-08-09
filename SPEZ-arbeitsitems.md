# Spezifikation: Item-/Positionsbasierte Arbeitszuteilung

**Status:** Kern-Workflow umgesetzt (Büro, Mobile, Web/PWA, Kunden-PL); Import-Pfad wird auf PDF-Primär umgestellt  
**Stand:** 08.08.2026  
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
| **Block** | Gruppierung von Items; typisch **1 Mehrseiten-PDF pro Block** (20–50 Seiten üblich) |
| **Auftrag / Item** | **1 PDF-Seite = 1 Arbeitsauftrag** (verbindliche Regel) |
| **Aktuelles Item** | Das Item, dem gerade die Stempelzeit des Monteurs zugeordnet wird |
| **Kunden-PL** | Projektleiter vom Kunden; **eigene Rolle** `CUSTOMER_PL`, unabhängig von internen Rollen |

Die Kennung heißt nicht zwingend „Positionsnummer“ – sie kann auch Raumnummer o. Ä. sein. In der UI: neutrales Label je nach Projektkonfiguration möglich.

**Kern der DB je Order:** Kennung/Position, was zu tun ist, Status sowie **wer / wann / in welchem Zeitraum** erledigt hat. Bauteile und Detailzeichnungen dürfen **nur im PDF** stehen – strukturierte Materialzeilen in der DB sind **optional**, nicht Pflicht.

---

## 4. Rollen & Rechte

### 4.1 Monteur

- Stempelt am **Projekt** (bestehende Zeiterfassung).
- Nimmt Items anhand der **Kennung**.
- Wechselt bewusst das **aktuelle Item** (Zeitzuordnung).
- Sieht Aufgabe (Arbeitsinhalt) + Unterlage (PDF-Seite); optionale Materialtabelle nur falls gepflegt.
- Meldet:
  - **Fertig** → Pflicht: mindestens **2–3 Fotos** (Upload über bestehende App-Funktion)
  - **Nacharbeit** → Item ist **nicht fertig**; bleibt beim Monteur
- UI zweisprachig **DE + SK** (Labels wie auf der Arbeitskarte).

### 4.2 Kunden-PL (`CUSTOMER_PL`) — eigene Rolle

**Festgelegt:** Kunden-PL hat eine **eigene Rolle** und hat **nichts mit internen Rollen** zu tun (kein `PROJECT_MANAGER` / Office-User-Reuse).

- Eigene Rolle im System: `CUSTOMER_PL`
- **Primärer Einstieg:** Kiosk mit **PIN** (`/kiosk/pl`) – kein Office-App-Zugang für den Kunden nötig
- Wird beim Projekt-Setup dem Projekt zugeordnet (**einer oder mehrere**); Büro setzt PIN + optionale **Zustell-E-Mail** für Stundenzettel-PDFs
- Rechte (projektbezogen):
  - Fortschritt sehen: offen / in Arbeit / Kontrolle / Nacharbeit / geprüft
  - Erledigte Items laufend prüfen → **OK / Geprüft**
  - Items **selbstständig fertigsetzen** → Monteur(e) verlieren die Zuordnung
  - **Stundenzettel je Woche** abzeichnen (Signatur + Approve); PDF wird gespeichert und an die Zustell-E-Mail gesendet
- Kein Zugriff auf interne Office-Funktionen (Stammdaten, Einstellungen, fremde Projekte usw.), außer was für PL-Prüfung und Wochenabzeichnung nötig ist

### 4.3 Internes Office / interner PL

- Projekt anlegen, Item-Modus aktivieren
- Monteure + **Kunden-PL** zuordnen
- Mehrseiten-PDFs hochladen (Primärimport, Abschnitt 10); Excel nur Fallback
- Items anlegen / nachziehen (Kennung + Arbeitsinhalt); Material in DB optional
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
5. Unterlage öffnen (PDF-Seite); Arbeitsinhalt und ggf. optionale Materialzeilen sehen.
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

**Pflicht** (das ist der Geschäftswert der Item-DB):

- Kennung und Arbeitsinhalt (was zu tun war)
- Welche Monteure wann zugeordnet / aktiv waren
- Fertig-/Nacharbeits-Meldungen inkl. Fotos und Zeitstempel
- Welcher Kunden-PL geprüft oder selbst fertiggesetzt hat, wann
- Intervalle / Summe der Item-Arbeitszeit je Monteur → **wer, wann, Zeitraum**

**Optional:** strukturierte Materialzeilen in der DB. Fehlen sie, gelten Bauteile/Komponenten als Teil der PDF-Unterlage.

---

## 9. Abrechnung

| Was | Wann |
|---|---|
| Kunde / Position | Erst bei Status **Geprüft** (derzeit) |
| Monteur | Nach Stunden (Stundenzettel), nicht nach Item-Stück |

Nacharbeit und „nur Kontrolle“ sind **nicht** abrechenbar.

---

## 10. Datenquellen: PDF-Primärimport (1 Seite = 1 Order)

Arbeitskarten kommen von **verschiedenen Kunden**, Aufträgen und Layouts. Deshalb kein starres Einheits-Excel als Pflichtweg.

### 10.1 Entscheidung (Stand 08.08.2026)

| Inhalt | Quelle |
|---|---|
| Visuelle Unterlage + Bauteile/Details | **PDF** (Mehrseiten-Datei oder Einzelseiten) |
| Steuernde Stammdaten je Order | **Primär aus dem PDF** (Extraktion + Büro-Review); Excel nur Fallback |
| Was in der DB stehen muss | **Kennung/Position**, **Arbeitsinhalt** (was zu tun ist), Verweis auf PDF-Seite |
| Material / Einzelkomponenten | **Reicht im PDF**; strukturierte DB-Materialzeilen **optional** |
| Completion-Tracking | **System-Workflow** (wer, wann, Zeitraum) – nicht aus dem PDF importieren |

**Regel:** **1 PDF-Seite = 1 Arbeitsauftrag (Item).**  
Typisch: ein Block-PDF mit 20–50 Seiten → 20–50 Items.

### 10.2 Primärablauf (Soll)

1. Büro lädt Mehrseiten-PDF (Block) hoch.
2. System legt pro Seite ein **Entwurf-Item** an (`pdfFile` + `pdfPage`, vorläufige Kennung z. B. aus Extraktion oder `Seite-NN`).
3. Optional: **Kartentyp-/Kunden-Template** – einmal Beispielseite markieren („welche Felder wo“), dann für gleiche Layouts wiederverwenden. Layouts unterscheiden sich je Kunde → Templates pro Kartentyp.
4. Extraktion zieht nur das Nötige: Kennung, Arbeitsinhalt, optional Ort/Etage. **Keine Pflicht-Materialtabelle.**
5. Büro prüft Vorschau, korrigiert Kennung/Titel/Umfang, bestätigt → Items werden **Offen** im Pool.
6. Monteur arbeitet an der Order; Tracking (wer/wann/Zeitraum) läuft über Session + Reports + Review.

**Nie blind in die Produktiv-DB schreiben** – immer Review wie bei der Auto-Recherche.

### 10.3 Minimal-Modus (ohne Template / ohne Extraktion)

PDF hochladen → 1 Item je Seite mit Platzhalter-Kennung → Büro tippt Kennung und Arbeitsinhalt nach. Immer machbar, wenn das Layout unbekannt ist.

### 10.4 Excel/CSV – nur Fallback

Bestehender Excel-/CSV-Import bleibt als **Notausgang** / Massenkorrektur erhalten (Abschnitt 11), ist aber **nicht** mehr der vorgesehene Primärweg. Kein Zwang, vor jedem Auftrag per AI ein Excel zu erzeugen.

### 10.5 PDF-Bereitstellung

- Pro Block ein Mehrseiten-PDF **oder** Einzelseiten je Item
- Item referenziert `pdfFile` + `pdfPage` (bzw. Einzelseite)
- Monteur öffnet die **Seite seines Auftrags** als Unterlage

---

## 11. Excel/CSV-Fallback (optional, Bestandsformat)

Nur wenn kein PDF-Import genutzt wird oder Daten nachträglich massenhaft korrigiert werden. Abgeleitet vom Beispielblatt **TAS Arbeitskarte 05-A-01**.

**Beispiel-Excel im Repo:**
- [`arbeitsitems-import-beispiel.xlsx`](arbeitsitems-import-beispiel.xlsx) (Projektwurzel)
- [`docs/import-vorlagen/arbeitsitems-import-beispiel.xlsx`](docs/import-vorlagen/arbeitsitems-import-beispiel.xlsx)

Blätter: `Anleitung` · `Items` · `Material` (Material-Blatt **optional**).

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
| `pdfPage` | empfohlen | `1` | Seite in diesem PDF (**= Auftrag**) |
| `workScopeDe` | empfohlen | s. Karte | Arbeitsumfang / was zu tun ist (DE) |
| `workScopeSk` | empfohlen | s. Karte | Arbeitsumfang Slowakisch |
| `siteName` | optional | … | nur wenn nicht schon am Projekt |
| `siteAddress` | optional | … | nur wenn nicht schon am Projekt |

**Nicht importieren** (kommt aus App/System): Monteur, Datum, Status, Prüfung, Abnahme, Bemerkung, Fotos, Planausschnitt-Bild, Completion-Zeiten.

### 11.2 Datei B — Material (optional)

Nur wenn strukturierte Materialzeilen gewünscht sind. Ansonsten: Bauteile bleiben im PDF, Blatt `Material` kann leer bleiben oder entfallen.

Tabelle **`WorkItemMaterial`** bleibt im Schema für optionale Nutzung.

| Spalte | Pflicht (wenn Blatt genutzt) | Bedeutung |
|---|---|---|
| `itemKey` | ja | Verknüpfung zum Item |
| `sortOrder` | empfohlen | Reihenfolge |
| `qty` / `qtyUnit` | empfohlen | Menge / Einheit |
| `materialDe` | ja | Bezeichnung DE |
| `materialSk` | empfohlen | Bezeichnung SK |

### 11.3 System nach Import / PDF-Commit

- Item-Status = `Offen` (nach Bestätigung; Entwürfe vorher möglich)
- keine Monteur-Zuordnung
- Materialzeilen nur wenn geliefert
- Import-Timestamps
- PDF-Seitenverweis gesetzt

### 11.4 Checkliste „Ausführung und Kontrolle“

Die Checkboxen auf der Karte werden **nicht** als Importfelder geführt. Perspektivisch feste System-Checkliste (DE+SK) oder später konfigurierbar.

---

## 12. Empfohlene Datenobjekte (konzeptionell)

- **RoleCode:** Rolle `CUSTOMER_PL` (getrennt von `PROJECT_MANAGER`)
- **Project** – Flag/Modus „item-basiert“
- **ProjectBlock** – `blockKey`, Name, PDF-Dokument-Ref (Mehrseiten-PDF)
- **WorkItem** – Kennung (`itemKey`), Arbeitsinhalt, Status, Block, **PDF-Seite**, optionale Metadaten
- **WorkItemMaterial** – **optional** (qty, materialDe/Sk, …)
- **WorkItemAssignment** – Monteur, aktiv von–bis
- **WorkItemSession** – Zeitintervalle (aktuelles Item ∩ gestempelt) → Zeitraum
- **WorkItemReport** – Fertig / Nacharbeit, Fotos, Bemerkung, Zeitstempel
- **WorkItemReview** – Kunden-PL, Aktion (geprüft / selbst fertig), Zeitstempel
- **ProjectCustomerPlAssignment** – welche `CUSTOMER_PL`-User am Projekt; optional `notificationEmail` für Stundenzettel-PDF
- **UserPin** – Kiosk-PIN für Kunden-PL (global eindeutig vs. Worker-PIN)
- **WorkCardTemplate** – Kunden-/Kartentyp-Mapping für PDF-Extraktion

Bestehend weiter nutzen:

- `TimeEntry` / Wochen-Stundenzettel (Abzeichnung durch Kunden-PL am Kiosk; PDF + E-Mail nach Approve)
- Dokumente / Foto-Upload
- Worker-PIN-Login und User-PIN für Kunden-PL

---

## 13. App-Oberflächen (grob)

### Monteur-Oberfläche

Die Monteur-Oberfläche gibt es **zweimal**: als Android-App (`apps/mobile`, APK)
und im Web (`/worker-app` für das persönliche Gerät inkl. iPhone/iPad,
`/kiosk` für das Baustellen-Tablet). Beide sind **feature-paritätisch** –
kein Flow, keine Aktion und kein Guard darf nur auf einer Plattform existieren.
Das Web ist zusätzlich als PWA installierbar („Zum Home-Bildschirm“), damit
Apple-Geräte ohne Store dieselbe App bekommen.

Funktionen (identisch auf beiden Wegen):

- Projekt stempeln (bestehend)
- Items suchen/nehmen per Kennung; aktuelles Item wechseln
- Detail: Kennung + Arbeitsinhalt + PDF-Seite (+ optionale Materialtabelle)
- Fertig (≥2–3 Fotos) / Nacharbeit
- Offene Items nach Login am Folgetag

Verbindlich bei Änderungen:

- Gleiche Monteur-Endpunkte (Worker-Token), kein Office-JWT im Monteur-Pfad.
- Texte DE + SK identisch: `apps/mobile/lib/i18n-work-items.ts` und
  `apps/web/src/lib/i18n-work-items.ts` immer **gemeinsam** pflegen.
- Neue Aktionen werden auf beiden Plattformen umgesetzt oder gar nicht.

### Web Büro (intern)

- Item-Modus, Monteure, **Kunden-PL** zuordnen
- **PDF-Primärimport** (Mehrseiten → 1 Item/Seite, Vorschau, Commit)
- Kartentyp-Templates (Felder zuordnen) – Soll
- Excel-Import nur als Fallback
- Item-Board / Auswertung (wer / wann / Zeitraum je Order)

### Web / App Kunden-PL

- Board mit Stati, prüfen, selbst fertig
- Wochen-Stundenzettel abzeichnen
- Kein interner Office-Zugriff

Sprache Monteur-UI: **DE + SK**.

---

## 14. Nicht-Ziele

- Kein Zwang, vor jedem Auftrag ein Excel (ggf. per AI) zu erzeugen
- Keine Pflicht-Materialzeilen in der DB (Bauteile dürfen im PDF bleiben)
- Keine Vermischung Kunden-PL mit interner `PROJECT_MANAGER`-Rolle
- Keine erzwungene 1:1-Aufteilung Wochenstunden → Items für Lohn
- Kein Mahnwesen
- Kein Blind-Import ohne Büro-Review

---

## 15. Offene Punkte / nächste Umsetzung

1. **PDF-Primärimport bauen:** Upload → Split 1 Seite = 1 Item → Vorschau → Commit.
2. **Kartentyp-Templates:** Beispielseite + Feldzuordnung je Kundenlayout.
3. Extraktion: Minimal (Kennung + Arbeitsinhalt); Hybrid Mapping/OCR/LLM möglich.
4. Excel-Pfad als Fallback belassen, UI-Texte auf „Primär = PDF“ umstellen.
5. Bei Ausstempeln: UI-Hinweis „Item bleibt dir zugeordnet“ (ja/nein).
6. Ob Checkliste Phase 1 schon digital abhakbar ist oder erst später.

---

## 16. Kurzformel

> Item-Projekt = **Mehrseiten-PDF** (1 Seite = 1 Order) + Kennung/Arbeitsinhalt in der DB.  
> Material/Bauteile dürfen im PDF bleiben; DB-Material optional.  
> Excel nur Fallback.  
> Kunden-PL = eigene Rolle `CUSTOMER_PL`, getrennt von intern.  
> Monteur nimmt per Kennung, wechselt aktives Item, meldet fertig (≥2–3 Fotos) oder Nacharbeit.  
> Item-Zeit nur während gestempelt + aktives Item → **wer, wann, Zeitraum**.  
> Kunden-PL prüft laufend und zeichnet Wochenstunden ab; Abrechnung erst bei Geprüft.

---

## 17. Referenz Beispielblatt → Felder-Mapping

| Auf der Arbeitskarte | Import / System |
|---|---|
| Positions-ID / Kennung | `itemKey` (**Pflicht in DB**) |
| Arbeitsumfang / was zu tun ist | `workScopeDe` / `workScopeSk` (**Kern in DB**) |
| Geschoss / Bereich / Raum | optional in DB |
| Typ / RC / Detail / Planseite | optional in DB |
| Materialliste / Bauteile | **PDF reicht**; DB-Material optional |
| Planausschnitt | nur PDF |
| Monteur / Datum / Status / Prüfung / Abnahme / Bemerkung | System-Workflow |
| Fertigstellung wer/wann/Zeitraum | `WorkItemSession` + Reports + Review |
| Foto-Doku | App-Upload bei Fertigmeldung |

Ende der Spezifikation.
