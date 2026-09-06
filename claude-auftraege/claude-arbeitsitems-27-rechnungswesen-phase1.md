# Cloud-Auftrag #27: Rechnungswesen Phase 1 – Compliance + Verrechnung

## Kontext

Bestehendes Modul `invoices` (Feature-Flag `invoices`): Entwürfe, Positionen, MwSt pauschal, PDF, Zahlungen, Generierung aus Stundenzetteln, Status `DRAFT|SENT|PARTIALLY_PAID|PAID|CANCELLED`.

**Probleme (GoBD / Praxis):**
- Nummer wird schon bei Anlage vergeben (`RE-YYYY-NNNN`) – falsch für Vivahome
- Storno setzt Beträge auf 0, **keine** Storno-/Gutschrift als Gegenbeleg
- Keine Unveränderbarkeit nach „Versand“
- Keine Einstellungen für Nummernkreise / Zahlungsziele / Skonto-Hinweise / Leistungsort-MwSt
- Eingangsrechnungen (ER) werden **nicht** weiterentwickelt (DATEV)

**Firmendaten/Logo:** Settings → Firma (`company_info`) – wiederverwenden.

## Ziel (Phase 1)

1. Nur **Ausgangsrechnungen** im Fokus (UI: ER-Neuanlage ausblenden/deaktivieren; bestehende ER-Logik darf liegen bleiben, aber nicht erweitern).
2. **Nummern erst beim Finalisieren**; Format konfigurierbar analog Praxis: `RE-40000113`.
3. **Gutschrift** analog: `GS-…` mit eigenem Nummernkreis; Storno finaler RE nur über GS.
4. Admin kann unter **Einstellungen → Verrechnung** Nummernkreise und weitere Abrechnungs-Defaults pflegen.
5. Finalisieren nur **SUPERADMIN**.
6. PDF-Pflichtangaben §14 UStG (soweit Stammdaten vorhanden).

## Produktentscheidungen (verbindlich)

| Thema | Entscheidung |
|--------|----------------|
| Fokus | Nur Ausgang (RE); Eingang = DATEV, nicht pflegen |
| Nummernformat RE | `{prefix}-{number}` Default `RE-40000113` (kein Jahresanteil) |
| Nummernformat GS | Analog `{prefix}-{number}` Default-Prefix `GS`, **eigener** Zähler |
| Vergabe | Erst beim **Finalisieren**; Entwurf: `invoiceNumber` leer/`null` oder Platzhalter **nicht** als Unique-Geschäftsnummer nutzen |
| Start | Keine Altrechnungen; Admin setzt nächste Nummer (z. B. RE-Start `40000113`) |
| Nummernkreise | In Settings **editierbar**: Prefix + nächste laufende Zahl (RE und GS getrennt) |
| Finalisieren | Nur Rolle `SUPERADMIN` |
| Nach Finalisierung | Keine Positions-/Header-Änderung mehr; nur Zahlung, interner Kommentar, Storno→GS |
| Storno | Erzeugt **Gutschrift** (neues Dokument, Status final, Bezug auf Original); Original → `CANCELLED` (oder eigener Status), Beträge/PDF Original bleiben archiviert |
| Abschlag/Schluss | `isPartialInvoice` bleibt wie heute |
| Skonto (Phase 1) | Vorlage + PDF-Hinweistext mit **Platzhaltern**; noch keine Zahlungs-Auswertung (kommt später) |
| Leistungsort-MwSt (Phase 1) | Länderliste mit Sätzen in Verrechnung; Rechnung wählt Leistungsort-Land → Default-`taxRate` |
| Produkte / VIES / E-Mail-Anhänge | **Nicht** Phase 1 (Folgeaufträge) |
| Kundenpreise | Folgeauftrag |

### Nummernkreis-Regeln

- Speicherung z. B. AppSettings oder eigenes Model `InvoiceNumberSeries`:
  - `code`: `OUTGOING` | `CREDIT_NOTE`
  - `prefix`: `RE` | `GS` (Admin änderbar, alphanumerisch, kurz)
  - `nextNumber`: Integer ≥ 1 (Admin setzbar)
- Beim Finalisieren (transaktional):
  1. Serie sperren/lesen
  2. `invoiceNumber = `${prefix}-${nextNumber}``
  3. `nextNumber += 1`
  4. Unique-Constraint; bei Konflikt Retry
- Validierung beim Speichern der Settings: Warnung wenn `nextNumber` ≤ bereits vergebener Max-Zahl für diesen Prefix (Admin darf bewusst höher setzen; **niedriger** als existierende Nummern mit gleichem Prefix → blockieren oder harte Warnung + Bestätigung – Empfehlung: **blockieren**, wenn Nummer schon existiert)
- Anzeige in UI: Vorschau „Nächste: RE-40000113“

### Status-Flow (Ausgang)

```
DRAFT ──(finalisieren SUPERADMIN)──► FINALIZED/SENT
                                      │
                                      ├─ Zahlungen → PARTIALLY_PAID / PAID
                                      └─ Storno → CANCELLED + neue Gutschrift (GS, final)
```

- Alten Button „Versenden“ durch **Finalisieren** ersetzen (oder Versenden = Finalisieren ohne E-Mail; E-Mail = Folgephase).
- `invoiceNumber` in DB: für DRAFT `null` erlauben → Migration: Unique nur auf nicht-null (PostgreSQL Partial Unique) **oder** temporäre interne Draft-ID außerhalb des Geschäftsnummernfeldes. Empfohlen: `invoiceNumber String?` + `@@unique([invoiceNumber])` (Postgres erlaubt mehrere NULL).

## Scope

### A) Schema / Migration

1. `Invoice.invoiceNumber` optional (`String?`) bis Finalisierung.
2. Felder für Gutschrift/Bezug, z. B.:
   - `creditedInvoiceId String?` (GS zeigt auf Original-RE)
   - `creditNoteId` optional inverse, oder nur eine Richtung
   - ggf. `finalizedAt`, `finalizedByUserId`
3. Nummernkreise (Model oder AppSettings-Keys):
   - `invoice_series_re_prefix`, `invoice_series_re_next`
   - `invoice_series_gs_prefix`, `invoice_series_gs_next`
4. Verrechnung-Settings (AppSettings JSON oder Keys):
   - Zahlungsziel-Defaults (Liste oder Default-Tage)
   - Skonto-Vorlage: percent, days, `pdfHintTemplate` mit Platzhaltern
   - Leistungsort-Länder: `[{ countryCode, name, standardRate, reducedRate }]` Defaults DE/LU/NL/FR
5. Optional: `performanceCountryCode` an Invoice (Leistungsort).

Defaults nach Migration:
- RE prefix `RE`, next `40000113`
- GS prefix `GS`, next `40000101` (oder ebenfalls 40000113 – **RE-Start 40000113**, GS-Start klar dokumentieren, Default z. B. `40000001`)

### B) API

1. **Settings Verrechnung** (SUPERADMIN, ggf. OFFICE read):
   - `GET/PUT /settings/billing` (oder `/billing-settings`)
   - Nummernkreise, Zahlungsziele, Skonto-Template, Länder/MwSt
2. **Finalisieren**
   - `POST /invoices/:id/finalize` – nur SUPERADMIN
   - Voraussetzungen: OUTGOING, DRAFT, mind. 1 Position, Kunde, periodFrom/To, taxRate bzw. Leistungsort gesetzt
   - Vergibt Nummer, setzt Status SENT/FINALIZED, `issueDate`/`dueDate`, archiviert PDF
3. **Storno → Gutschrift**
   - `POST /invoices/:id/credit-note` – nur SUPERADMIN (oder OFFICE+SUPERADMIN; **Finalisieren** bleibt SUPERADMIN-only; Storno ebenfalls SUPERADMIN)
   - Nur finalisierte RE; erzeugt GS mit gespiegelten Positionen (Vorzeichen/negativ oder positive Beträge + Typ CREDIT – konsistent wählen), Link auf Original, eigene GS-Nummer, Original `CANCELLED`
4. Bestehende `generateInvoiceNumber` bei Create/Duplicate **entfernen** (kein Nummernverbrauch im Entwurf).
5. Update/Delete Lines nur solange DRAFT.
6. INCOMING create in API: 403 oder Feature „deprecated“ – UI ausblenden reicht, wenn API geschützt.

### C) Settings-UI – Verrechnung

Neue Seite `/settings/billing` + Eintrag in Settings-Übersicht:

- Abschnitt **Nummernkreise**
  - RE: Prefix, nächste Nummer, Vorschau
  - GS: Prefix, nächste Nummer, Vorschau
- Abschnitt **Zahlungsziele** (Default-Tage / einfache Vorlagen)
- Abschnitt **Skonto**: % , Tage, Hinweistext-Template  
  Platzhalter mind.: `{{skontoPercent}}`, `{{skontoDays}}`, `{{skontoAmount}}`, `{{dueDate}}`, `{{invoiceNumber}}`, `{{companyName}}`
- Abschnitt **Leistungsort / MwSt**: Länderliste editierbar (Code, Name, Regelsteuersatz, ermäßigt)
- Texte DE in `texts/settings` bzw. `texts/billing`
- Speichern: SUPERADMIN (oder OFFICE nur Lesen – verbindlich: **Schreiben SUPERADMIN**)

### D) Rechnungs-UI

- Liste/Detail: Entwürfe ohne Geschäftsnummer („Entwurf“ / „—“)
- Button **Finalisieren** (nur SUPERADMIN, Confirm-Dialog mit Nummern-Vorschau)
- Button **Stornieren / Gutschrift** auf finaler RE
- Gutschrift: eigener Detail-Blick, Link „zu Rechnung RE-…“
- ER-Tabs/Generate-Incoming ausblenden
- Fälligkeit weiter überschreibbar **vor** Finalisierung; nach Finalisierung read-only (außer klar dokumentierte Ausnahme – Phase 1: read-only)

### E) PDF

- Pflicht: Absender (Firma, Adresse, Steuernummer, USt-IdNr. soweit gepflegt), Empfängeradresse, Rechnungsnr., Datum, Leistungszeitraum, Positionen, Netto/MwSt/Brutto, Fälligkeit, Bank
- Skonto-Hinweis aus Template (Platzhalter ersetzen); wenn kein Skonto konfiguriert → Abschnitt weglassen
- Gutschrift: Titel „Gutschrift“, Bezug „zu Rechnung RE-…“
- Logo aus company_info

### F) Nicht im Scope (Phase 1)

- E-Mail-Versand + Anhänge
- VIES / Reverse Charge-Logik
- Produktkatalog / Kundenpreise / Positionsrabatt
- Skonto-Häkchen bei Zahlung + Auswertung
- DATEV
- Eingangsrechnungen weiterbauen

## Abnahme

1. Settings → Verrechnung: RE next = 40000113, Prefix RE → Speichern → Vorschau `RE-40000113`.
2. Neue Ausgangsrechnung als Entwurf → **keine** RE-Nummer in Liste/Detail.
3. SUPERADMIN finalisiert → Nummer `RE-40000113`, Status final, PDF speicherbar; nächste Serie = 40000114.
4. OFFICE/PM: Finalisieren-Button fehlt oder 403.
5. Nach Finalisierung: Positionen nicht mehr änderbar.
6. Storno → Gutschrift `GS-…`, Original storniert aber PDF/Beträge nachvollziehbar; GS verweist auf RE.
7. GS-Nummernkreis unabhängig von RE.
8. PDF enthält Firmendaten + Kundenadresse + Zeitraum + Skonto-Hinweis (wenn Vorlage gesetzt).
9. Leistungsort-Land wählbar → taxRate aus Länderliste vorbelegt (änderbar im Entwurf).
10. Build grün; Deploy mit `--env-file .env.production`.

## Commit-Vorschlag

`feat(invoices): Phase 1 Finalisierung, RE/GS-Nummernkreise und Verrechnung-Settings`

## Hinweise für die Umsetzung

- Bestehende Create-/Generate-Flows auf `invoiceNumber: null` umstellen.
- Partial Unique / nullable Unique in Postgres beachten.
- Nummernvergabe **immer** in DB-Transaktion mit Series-Update.
- Alte `RE-YYYY-NNNN`-Logik vollständig entfernen.
- UI-Texte zentral; Touch-Targets ≥ 44px.
- Nach Merge: Agent deployet wie üblich.
