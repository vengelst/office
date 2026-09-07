# Cloud-Auftrag #29: Belegarten RE / ST / KO + Steuer je Satz

## Kontext

Rechnungswesen Phase 1+2 ist auf Prod (`129ad31`): Finalize, Verrechnung, Produkte, VIES/RC, Skonto-Zahlung, E-Mail, Firmen-USt-Id je Leistungsort.

**Ist-Problem:** Storno läuft über `CREDIT_NOTE` / Prefix `GS` (Titel „Gutschrift“ – ust-rechtlich unpassend). Keine Rechnungskorrektur (Teilminderung). Steuer nur ein Satz am Header. GS-Nummer = RE-Ziffern (gestern) – wird durch diesen Auftrag **ersetzt**.

**Repo:** `office` · Branch von `main` · PR öffnen · Feature-Flag `invoices` beibehalten.

## Verbindliche Produktentscheidungen (User 2026-09-07)

| # | Thema | Entscheidung |
|---|--------|----------------|
| 1 | Nummernformat | **Wie heute:** `{PREFIX}-{number}` z. B. `RE-40000115` – **kein** Jahresanteil, **kein** Jahresreset |
| 2 | GS | **Vollständig ersetzen** durch ST (Stornorechnung) + KO (Rechnungskorrektur) |
| 3 | Status | **Bestehende** Enums: `DRAFT` / `SENT` / `PARTIALLY_PAID` / `PAID` / `CANCELLED` (+ ggf. neues `PARTIALLY_CORRECTED` für RE nach KO, siehe unten) |
| 4 | Steuer | **Steuer je Satz** (`steuer_je_satz`): aus Nettosumme je Satz, kaufmännisch 2 Dezimalstellen – nicht Summe positionsweise gerundeter Steuer |
| 5 | Abschlag/Schluss | **Unverändert lassen** (`isPartialInvoice` etc.) |
| 6 | Zahlungen / Skonto / E-Mail | **Nicht anfassen** in diesem Auftrag |
| 7 | Nachbelastung (neue RE mit Referenz) | **Nicht** in Scope |
| 8 | Altdaten | Nur Testdaten – Migration darf Testdaten löschen/umschreiben; keine produktiven Geschäftsbelege |

## Ziel

1. Belegarten **RE / ST / KO** mit getrennten Nummernkreisen.
2. GoBD: Nummer erst beim Finalisieren; festgeschriebene Belege unveränderbar; Änderungen nur über neue Belege.
3. Invarianten 1–13 serverseitig erzwingen.
4. PDF-Titel ohne Wort „Gutschrift“.
5. Pflicht-Tests (angepasst an Format ohne Jahreswechsel – siehe Tests).

## Belegarten

| Belegart | Kürzel | Vorzeichen | Prisma / API | Zweck |
|----------|--------|------------|--------------|--------|
| RECHNUNG | RE | + | `OUTGOING` (behalten) | Basisbeleg |
| STORNO | ST | − | neu z. B. `STORNO` (ersetzt `CREDIT_NOTE`) | Vollständige Aufhebung einer RE, 1:1 |
| KORREKTUR | KO | − | neu `CORRECTION` | Teilminderung einer RE |

- Interner Enum-Name beliebig; **UI/PDF-Titel** strikt:
  - RE → „Rechnung“
  - ST → „Stornorechnung“ + „Storno zu Rechnung \<Nr\> vom \<Datum\>“
  - KO → „Rechnungskorrektur“ + „Korrektur zu Rechnung \<Nr\> vom \<Datum\>“
- Das Wort **„Gutschrift“** darf auf keinem Titel/Label dieser Belege erscheinen (Texte, PDF, E-Mails die dieses Paket berührt – Zahlungs-/Send-UI nur anfassen, wenn Label „Gutschrift“ dort vorkommt).

## Nummernkreise

- Je Belegart eigener Kreis: `InvoiceSeriesCode` → `OUTGOING` | `STORNO` | `CORRECTION` (oder äquivalent).
- Format: `{prefix}-{nextNumber}` (Defaults: `RE`, `ST`, `KO`; nächste Nummer Admin-setzbar unter Verrechnung).
- **Kein** Jahresanteil, **kein** Reset zum 1.1. (Abweichung vom Originalauftrag – freigegeben).
- Vergabe atomar (`FOR UPDATE` / Transaktion), nie wiederverwenden, erst bei Finalize.
- ST und KO bekommen **eigene** fortlaufende Nummern (nicht mehr „gleiche Ziffern wie RE“).
- Settings-UI: drei Serien (Prefix + nächste Nummer); GS-UI/Logik entfernen.

## Status-Mapping (bestehend)

| Fachlich | Prisma |
|----------|--------|
| Entwurf | `DRAFT` |
| Festgeschrieben | `SENT` (und `PARTIALLY_PAID` / `PAID` bleiben Zahlungsstatus) |
| Storniert (Ursprungs-RE nach ST) | `CANCELLED` |
| Teilkorrigiert (RE nach ≥1 KO, nicht storniert) | **neu** `PARTIALLY_CORRECTED` **oder** abgeleitet in API ohne DB-Enum – **Empfehlung:** neues Status-Enum-Mitglied `PARTIALLY_CORRECTED` setzen wenn erste KO finalisiert und RE nicht `CANCELLED` |
| Bezahlt | `PAID` / `PARTIALLY_PAID` (unverändert, Zahlungslogik nicht anfassen) |

Löschen nur `DRAFT`. Ab `SENT` (und Folge): keine Header-/Positionsänderung; nur Zahlung/interner Kommentar wie heute (Zahlungscode nicht umbauen).

## Datenmodell (Erweiterungen)

Mindestens:

- `invoiceType`: `OUTGOING` | `STORNO` | `CORRECTION` | `INCOMING` (INCOMING unverändert ungenutzt lassen)
- `invoiceNumber` nullable bis Finalize, unique
- `creditedInvoiceId` / `refInvoiceId`: Pflicht bei ST und KO → nur auf `OUTGOING`
- `correctionReason` Enum (Pflicht ST/KO):
  - `INVOICE_ERROR` (= Rechnungsfehler §31 Abs. 5 UStDV) → `taxPeriod` = Periode der **Ursprungsrechnung**
  - `CONSIDERATION_REDUCTION` (= Entgeltminderung §17 Abs. 1 UStG) → `taxPeriod` = Periode des **Korrektur-/Stornobelegs**
- `taxPeriodFrom` / `taxPeriodTo` (oder ein Feld `taxPeriodMonth`) – **abgeleitet**, nicht frei setzbar
- Steuer je Satz: z. B. JSON `taxBreakdown Json` `[{ rate, net, tax, gross }]` **oder** Relation `InvoiceTaxLine`; Header `subtotal`/`taxAmount`/`total` weiter konsistent halten
- Positionen: optional `taxRate` **pro Zeile** (für gemischte Sätze); Header-`taxRate` ggf. nur Default/Legacy – Totals immer aus Breakdown
- Migration: `CREDIT_NOTE` → entfernen; Testdaten GS/alte CREDIT_NOTE löschen oder umschreiben; Series `CREDIT_NOTE` → `STORNO` + neue `CORRECTION`

## Korrekturgrund → Steuerperiode

Wie Auftragstabelle. Ableitung in Service beim Erzeugen/Finalisieren von ST/KO; Client darf `taxPeriod*` nicht überschreiben.

## Invarianten (serverseitig erzwingen)

1. Belegnummer global unique, nie wiederverwendet.
2. Festgeschriebener Beleg: keine Änderung/Löschung der inhaltlichen Felder.
3. ST/KO brauchen `ref` auf `OUTGOING`.
4. Kein ST/KO auf ST/KO.
5. Pro RE höchstens ein ST.
6. ST nur wenn **keine** KO zu dieser RE existiert.
7. KO nicht wenn RE bereits storniert (`CANCELLED`).
8. Summe \|KO-Brutto\| zu einer RE ≤ RE-Brutto.
9. ST = exakte Spiegelung der RE-Positionen/Beträge mit umgekehrtem Vorzeichen (Vorzeichen-Konvention dokumentieren: negative Mengen **oder** negative Totals – **eine** klare Variante; PDF zeigt Beträge korrekt).
10. Nach Storno: neue Leistung nur über **neue** RE; stornierte RE bleibt.
11. ST kann nicht storniert werden.
12. Steuer je Satz aus Netto je Satz, Rundung 2 NK.
13. PDF-Pflichtangaben §14 Abs. 4 (bestehend erweitern, nicht regressieren).

## API / UI

- `POST /invoices/:id/storno` (ersetzt `credit-note`): Body `{ correctionReason }`; nur SUPERADMIN; erzeugt finalisierte ST.
- `POST /invoices/:id/correction` (neu): Entwurf oder direkt Finalize nach Policy – **Empfehlung:** KO als Entwurf anlegen (Positionen editierbar, Beträge ≤ Rest), Finalize SUPERADMIN vergibt `KO-…`.
- Listen/Filter/Tabs: RE / ST / KO statt „Gutschriften“.
- Verrechnung: Serien RE/ST/KO.
- Detail/PDF: Titel und Bezugstexte laut Spez.
- Alle UI-Strings „Gutschrift“ für diese Belege entfernen/`Stornorechnung`/`Rechnungskorrektur`.

## Was **nicht** anfassen

- Zahlungen, Skonto-Auswertung, E-Mail-Versand-Logik (außer Label-Fix falls „Gutschrift“)
- Abschlagsfelder
- Nachbelastungs-RE mit Referenz
- DATEV, E-Rechnung, Eingangsrechnungen, Self-Billing
- Firmen-USt-Id je Land (bereits live)

## Tests (Pflicht)

Anpassung: **kein** Jahreswechsel-Test (Format ohne Jahr). Stattdessen:

1. Nummern je Belegart getrennt, lückenlos aufsteigend (RE/ST/KO).
2. Atomare Nebenläufigkeit: parallel Finalize erzeugt eindeutige Nummern (z. B. 20–50 parallel reicht in CI; Ideal 100 wenn praktikabel).
3. Änderung/Löschung festgeschriebener Beleg → abgewiesen.
4. Zweites ST zur selben RE → abgewiesen.
5. ST nach vorhandener KO → abgewiesen; KO nach ST → abgewiesen.
6. KO über Restbetrag hinaus → abgewiesen.
7. ST spiegelbildliche Beträge inkl. Steuer je Satz.
8. `INVOICE_ERROR` → taxPeriod = Ursprung; `CONSIDERATION_REDUCTION` → taxPeriod = Korrekturbeleg.
9. Steuerberechnung gemischte Sätze 19 %/7 % + Rundungsgrenzfall.
10. PDF/API enthält kein Titelwort „Gutschrift“ für ST/KO/RE.

Bestehende Unit-/e2e-Skripte die `CREDIT_NOTE`/`GS` erwarten anpassen oder ersetzen.

## Lieferumfang

- PR gegen `main`
- Kurze Zusammenfassung, Dateiliste, Testergebnisse
- Explizite Abweichungen: Nummernformat ohne Jahr (freigegeben); Status-Enums weitgehend bestehend; Zahlungen unberührt
- Commit-Stil: `feat(invoices): …`

## Technische Hinweise

- Stack: NestJS, Prisma, Postgres, Next.js – bestehende Module unter `apps/api/src/invoices/`, `apps/api/src/app-settings/billing-settings.*`, `apps/web/src/app/(authenticated)/invoices/`, `settings/billing`
- Deploy macht der Mac-Agent nach Merge; Cloud nur PR
- Migration destruktiv für Test-CREDIT_NOTE/GS erlaubt
