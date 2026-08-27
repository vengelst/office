# Cloud-Auftrag #25: KI-Import (#24) – harte Korrekturen

**Status:** umgesetzt (2026-08-27) · Folge-Fixes **#25** live  
**Umsetzung:** Cloud-Agent · Branch von `main` · Deploy mit `--env-file .env.production`  
**Bezug:** Review nach #24 – Architektur ok, aber Commit/NL-Anreicherung/COMPANY_EMAIL fehlerhaft.  
**Ergebnis:** `$transaction`, NOT_FOUND ohne KI-Adressen, COMPANY_EMAIL→CustomerEmail (+ Heuristik), Tests grün.

---

## Kontext

Repo: Office-Monorepo. Feature liegt unter:

- `apps/api/src/ai-import/`
- `apps/web/src/components/customers/ai-import-dialog.tsx`
- `apps/web/src/app/(authenticated)/settings/ai/`
- Spec #24: `claude-auftraege/claude-arbeitsitems-24-ki-kontakt-import.md`

**Nicht anfassen:** Kiosk, GPS, Stempeluhr, Calendar #20, unverwandte Module.

---

## Ziel

Die drei Review-Bugs **richtig** beheben (nicht nur kosmetisch), plus die eng damit verbundenen Spec-Lücken schließen. Nach Abschluss muss der SPIE-ähnliche Import Preview→Commit **atomar**, **ohne Halluzinations-Adressen** und mit korrekter Behandlung von Sammel-E-Mails laufen.

---

## Pflicht-Fixes

### 1. Commit atomar (`$transaction`) – high

**Ist:** `commitOneCustomerManyContacts` und `commitOneRowOneCustomer` schreiben sequentiell ohne Transaktion. Bei Fehler bleiben Halb-Kunden/NLs/Kontakte.

**Soll:**
- Beide Commit-Pfade in **eine** `prisma.$transaction(async (tx) => { … })` (oder interactive transaction mit sinnvollem Timeout, z. B. 60s bei vielen Kontakten).
- Alle `create`/`update`/`findMany` für diesen Commit über `tx`.
- Bei Fehler: vollständiger Rollback, API liefert klaren Fehler, **keine** Teilwrites.
- `PreviewCache.delete` erst **nach** erfolgreicher Transaction.
- Kundennnummer-Generierung race-safe innerhalb der Transaction (gleiche Logik wie `CustomersService.generateCustomerNumber`, aber mit `tx` – ggf. kurz sperren/retry bei Unique-Konflikt).

Abnahme: Simulierter Fehler nach erstem Contact-Create (oder Unit-/Integrationstest mit absichtlichem Fail) → kein neuer Kunde/keine Branches in DB.

### 2. NL-Anreicherung: NOT_FOUND darf keine Adressen übernehmen – high

**Ist:** In `branch-enrichment.service.ts` werden `addressLine1`, PLZ, Tel usw. auch bei `status: NOT_FOUND` aus dem LLM-JSON gemerged.

**Soll (strikt):**
- Merge-Regeln:
  - `FOUND` / `PARTIAL`: nur Felder übernehmen, die im LLM-Ergebnis **nicht leer** sind; Status setzen.
  - `NOT_FOUND` / Parse-Fehler / leere Seiten: **keine** neuen Adress-/Tel-/E-Mail-/mapsUrl-Felder aus dem LLM übernehmen. Bestehende Draft-Felder aus der Quelldatei (falls die Liste schon Adressen hatte) dürfen bleiben; KI-Erfindung verwerfen.
- Wenn Status `NOT_FOUND`, aber LLM trotzdem Adresszeilen liefert → Status bleibt `NOT_FOUND`, Felder **nicht** übernehmen, Warning ergänzen („KI lieferte Adresse trotz NOT_FOUND – verworfen“).
- `PARTIAL` nur wenn mindestens ein verifizierbarer Teil aus dem **Seitentext** kommt (Straße **oder** PLZ+Ort **oder** Tel/E-Mail); sonst `NOT_FOUND`.
- Prompt `BRANCH_ENRICH_SYSTEM_PROMPT` nachschärfen: explizit „Wenn unsicher: status NOT_FOUND und alle Adressfelder weglassen/null“.
- Optional aber empfohlen: nach Merge Validierung – PLZ-Format grob, keine offensichtlichen Platzhalter (`N/A`, `unknown`, `example.com`).

Abnahme: Mock/Test oder manuell – LLM antwortet NOT_FOUND + fantasiert Straße → Preview-Branch ohne diese Straße.

### 3. `kind: COMPANY_EMAIL` korrekt behandeln – medium→high fachlich

**Ist:** Commit legt alle included contacts als `CustomerContact` an; `kind` wird ignoriert.

**Soll:**
- Im Commit (beide Modi, wo sinnvoll):
  - `kind === 'COMPANY_EMAIL'` **oder** Erkennung Sammeladresse (Heuristik zusätzlich, falls LLM `kind` vergisst: lokale Parts wie `nl-`, `office-`, `info.`, `customer.care`, Domain-only Labels) → **nicht** als Person anlegen.
  - Stattdessen: Eintrag in `companyEmails` / direkt `CustomerEmail` (emailType GENERAL, label aus Rolle/Einheit/Name).
  - Wenn sowohl `companyEmails[]` als auch Contact mit gleichem `email` → deduplizieren (eine Email).
- Preview-Normalisierung (`normalizePayload`): Contacts mit klarem Sammel-Pattern nach `companyEmails` verschieben oder `kind` setzen, Warning optional.
- UI: COMPANY_EMAIL-Zeilen in Kontakt-Tabelle als solche kennzeichnen **oder** nur in Firmen-E-Mail-Sektion zeigen (kein Vorname/Nachname-Zwang). Kein Fake-`firstName: '-'` für Sammeladressen im Commit.

Abnahme: SPIE-Zeilen wie `nl-nordbayern@spie.com` / `office-austria@spie.com` landen als `CustomerEmail`, nicht als Ansprechpartner „Udo Oerther“ mit Sammelmail vermischt wo fachlich getrennt – und reine Zentrale-Zeilen ohne Person → nur Email/Branch.

---

## Weitere harte Verbesserungen (mit umsetzen)

### 4. Enrichment robuster (kein SPIE-only-Glück)

- Generische Standort-URL-Kandidaten aus `website` + Stadt/NL-Name bauen (Query-Pfade bleiben), SPIE-Hardcode darf als Extra bleiben, aber **nicht** die einzige Strategie.
- Nur die **ersten erfolgreich geladenen** Seiten (max 3) an die KI; Timeouts/Parallelität wie bisher.
- Wenn `enrichBranches=false`: Status `SKIPPED`, keine Web-Calls (bereits so – beibehalten).
- Logging: pro NL kurze Debug-Zeile (URLs versucht, Status) ohne API-Keys.

### 5. Preview-Cache & Commit-Payload

- Commit vertraut dem **Client-Payload** (editierte Preview) als Source of Truth – bereits der Fall; Cache nur Hint.
- Cache-Miss bei `previewId` darf Commit **nicht** abbrechen, wenn vollständiger Body da ist.
- Nach erfolgreichem Commit Cache löschen; bei Rollback Cache behalten (erneuter Versuch).

### 6. Tests

Mindestens automatisierte Tests (Jest im API-Paket, Pattern wie bestehende Specs):

1. **Transaction:** Commit bricht ab → keine Teilwrites (Prisma-Mock oder Test-DB).
2. **Enrichment merge:** NOT_FOUND + fantasierten Feldern → Felder verworfen.
3. **COMPANY_EMAIL:** Contact mit kind/Heuristik → `CustomerEmail`, kein Contact.

Wenn Test-DB schwer: reine Unit-Tests der Merge-/Classify-Hilfsfunktionen + Service mit gemocktem Prisma/`chatJson`/`fetch`.

### 7. Docs

- `claude-arbeitsitems-24-ki-kontakt-import.md` oder kurze Notiz in #25/STATUS: Fixes live.
- `offen-backlog.md`: #25 erledigt nach Deploy.

---

## Nicht-Ziele

- Neues Prisma-Modell / Prospect-Status
- Verschlüsselung der API-Keys (bleibt wie SMTP)
- Umbau auf externes Research-Microservice
- UI-Redesign

---

## Done-When

- [x] Beide Commit-Pfade in `$transaction`
- [x] NOT_FOUND merged keine KI-Adressen
- [x] COMPANY_EMAIL → CustomerEmail (+ Heuristik)
- [x] Unit-Tests für die drei Kernfälle grün
- [x] `api` + `web` Build/`tsc` grün
- [x] Auf `main` gemerged
- [ ] Prod-Deploy mit  
  `docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d`  
  (oder `deploy/server-deploy.sh` – LF-Endings beachten)
- [x] Kurz STATUS/Backlog aktualisiert

---

## Übergabe

Dieses Dokument ist die Spec. Keine Teil-Patches „schnell drüber“ – die drei high/medium Punkte müssen fachlich korrekt und getestet sein.
