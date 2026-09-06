# Cloud-Auftrag #28: Rechnungswesen Phase 2 – RC/VIES, Produkte, Rabatt, Skonto-Zahlung, E-Mail

## Kontext

Phase 1 (#27) ist auf Prod: Finalisieren mit `RE-…`/`GS-…`, Verrechnung-Settings, Gutschrift-Storno, Leistungsort-Länder, PDF-Grundlagen.

**Offen aus dem Gesamtkonzept (dieses Auftrag):**
1. Reverse Charge + USt-IdNr.-Prüfung (VIES)
2. Produktkatalog + **Kundenpreise** + Positionsrabatt
3. Zahlung: Häkchen „Skonto gezogen“ + Auswertung
4. Rechnung per E-Mail inkl. Anhänge aus Kundendokumenten / Stundenzettel-PDFs

**Nicht in diesem Auftrag:** DATEV, Eingangsrechnungen, projektbezogene Preise (nur Kundenpreise).

Bestehende Basis:
- `Customer.vatId`, `CustomerEmail` mit `emailType` inkl. `BILLING`
- `BillingSettings` + `performanceCountries` (`apps/api/src/app-settings/billing-settings.*`)
- `Invoice` / `InvoiceLine` / `InvoicePayment`, Finalize/Credit-Note, PDF
- Dokumente am Kunden (`Document` + Links)
- SMTP: Settings → E-Mail (`EmailService`)

## Produktentscheidungen (verbindlich)

| Thema | Entscheidung |
|--------|----------------|
| USt-IdNr. | Am Kunden pflegbar; vor RC **VIES**-Prüfung (EU), Ergebnis speichern (gültig/ungültig, Zeitpunkt, Name laut VIES falls geliefert) |
| Reverse Charge | Auf Rechnung wählbar; nur wenn Empfänger gültige geprüfte USt-IdNr. hat – sonst blockieren |
| RC-PDF | MwSt 0 / Hinweis §13b (Text aus Verrechnung oder festem Standard); Empfänger-USt-IdNr. auf PDF |
| Produkte | Globaler Katalog (Name, Einheit, Default-Preis, Default-Steuersatz/Kennzeichen, aktiv) |
| Preise | **Kundenpreise** (Customer + Product → Preis); kein Projektpreis |
| Positionsrabatt | Pro Zeile % und/oder Betrag; Netto nach Rabatt; Totals neu berechnen |
| Skonto-Zahlung | Bei Zahlungserfassung: Checkbox „Skonto gezogen“ + Skontobetrag; Auswertungsliste/Filter |
| E-Mail | An Billing-E-Mail des Kunden (Typ BILLING, Fallback GENERAL); PDF + wählbare Anhänge aus Kundendokumenten und verknüpften Stundenzettel-PDFs |
| Anhänge | Nur aus Office-Dokumenten (keine Blind-Uploads an die Rechnung) |
| Rollen | Produkte/Kundenpreise: SUPERADMIN/OFFICE; Finalize bleibt SUPERADMIN; E-Mail-Versand SUPERADMIN/OFFICE |

## Scope

### A) Reverse Charge + VIES

1. Kunde: UI für `vatId` prominent; Button **„USt-IdNr. prüfen (VIES)“**.
2. Persistenz z. B. am Customer:
   - `vatIdValidatedAt`, `vatIdValid` (Boolean?), `vatIdViesName`, `vatIdViesRequestId` o. Ä.
3. API: `POST /customers/:id/validate-vat` → VIES (EU VIES REST/SOAP); Fehler klar melden.
4. Rechnung:
   - Steuerart: `STANDARD` | `REDUCED` | `REVERSE_CHARGE` | `TAX_EXEMPT` (Enum oder String + Felder)
   - Bei `REVERSE_CHARGE`: Validierung Kunde.vatId gültig & nicht zu alt (z. B. max. 90 Tage, sonst erneut prüfen); `taxRate=0`, `taxAmount=0`
5. PDF: Empfänger-USt-IdNr.; RC-Text; keine MwSt-Ausweisung als normale Steuerzeile.
6. Verrechnung: optional editierbarer `reverseChargePdfText`.

### B) Produkte + Kundenpreise + Positionsrabatt

1. Models z. B.:
   - `InvoiceProduct` (code?, name, unit, defaultUnitPrice, defaultTaxRate?, active, …)
   - `CustomerProductPrice` (customerId, productId, unitPrice, @@unique)
2. CRUD API + Settings- oder Stammdaten-UI:
   - `/settings/products` **oder** eigener Nav-Punkt „Produkte“ (Empfehlung: unter Einstellungen oder Rechnungen-Unterbereich – **eine** klare Stelle)
   - Am Kunden-Tab: Preise je Produkt überschreiben
3. `InvoiceLine` erweitern:
   - `productId?`, `discountPercent?`, `discountAmount?`
   - `total` = nach Rabatt (Formel dokumentieren: zuerst % dann Betrag oder umgekehrt – **verbindlich:** `gross = qty * unitPrice`, dann `discount = discountAmount ?? gross * (discountPercent/100)`, `lineNet = max(0, gross - discount)`)
4. Line-Editor: Produkt wählen → Name/Einheit/Preis vorbelegen (Kundenpreis > Default); Rabatt-Felder; Totals live.
5. Rechnungssummen aus Line-Nets + Steuerlogik (RC → 0).

### C) Skonto bei Zahlung + Auswertung

1. `InvoicePayment`: `skontoApplied Boolean @default(false)`, `skontoAmount Float?`
2. Payment-Dialog: Checkbox + Betrag (wenn gesetzt, Betrag > 0 Pflicht)
3. Auswertung: unter Rechnungen Filter/Tab oder `/invoices/skonto` – Liste Zahlungen mit Skonto (Rechnung, Kunde, Datum, Betrag); Summen.
4. PDF-Skonto-Hinweis bleibt wie Phase 1 (Template).

### D) E-Mail-Versand + Anhänge

1. `POST /invoices/:id/send-email` (nur finalisierte RE oder GS):
   - Empfänger: primäre `CustomerEmail` mit `BILLING`, sonst Hinweis/Fehler wenn fehlt
   - Body: PDF der Rechnung + optionale Document-IDs (Kunde) + optionale Timesheet-PDF-IDs falls vorhanden
2. UI Detail: Dialog „Per E-Mail senden“ – Empfänger anzeigen, Anhänge aus Kunden-Dokumenten multi-select, verknüpfte Stundenzettel-PDFs vorschlagen
3. SMTP über bestehenden `EmailService`; Erfolg/Fehler Toast; optional `EmailLog` wenn Muster existiert
4. Kein Blind-Upload; Anhänge müssen dem Kunden (oder der Rechnung über Timesheet-Link) gehören

### E) Nicht im Scope

- DATEV / Eingangsrechnungen
- VIES-Batch-Cron (nur On-Demand + Block bei RC)
- Mahnwesen
- Projektpreise

## Abnahme

1. Kunde mit USt-IdNr. → VIES prüfen → Status gespeichert.
2. Rechnung RC ohne gültige USt-IdNr. → Fehler; mit gültiger → tax 0, PDF mit RC-Text + USt-IdNr.
3. Produkt anlegen; am Kunden Sonderpreis; auf RE Position aus Produkt → Kundenpreis.
4. Positionsrabatt % und Betrag → Summen korrekt; nach Finalisierung unverändert.
5. Zahlung mit „Skonto gezogen“ + Betrag → in Skonto-Auswertung sichtbar.
6. Finalisierte RE → E-Mail an Billing-Adresse mit PDF; Anhang aus Kundendokument wird mitgesendet.
7. Build grün; Deploy mit `--env-file .env.production`.

## Commit-Vorschlag

`feat(invoices): Phase 2 RC/VIES, Produkte, Rabatt, Skonto-Zahlung und E-Mail`

## Hinweise

- Phase-1-Finalisierung/Nummernkreise nicht regressieren.
- VIES: Timeout/Fehler graceful; kein Hard-Crash.
- Texte DE zentral; Touch ≥ 44px.
- Feature-Branch + PR gegen `main` (wie #27).
