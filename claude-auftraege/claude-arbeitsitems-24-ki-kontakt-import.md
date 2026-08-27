# Cloud-Auftrag #24: KI-basierter Import – Interessenten / Kontakte

**Status:** umgesetzt (2026-08-27) · Prod = **v1.0.1** · Branch `main`  
**Umsetzung:** Cloud-Agent · **kein** Stack-Rebuild pro Import (reine Laufzeitfunktion)  
**Bezug:** Manueller SPIE-Import (`scripts/import-spie-outreach.cjs`) als fachliches Vorbild – gleiche Qualität, aber in der App mit Preview/Freigabe.  
**Ergänzung 2026-08-27:** Niederlassungen anreichern (Web-Lookup) und Kontakte an `CustomerBranch` hängen.  
**Fixes #25 (2026-08-27):** atomarer Commit (`$transaction`), NOT_FOUND ohne Halluzinations-Adressen, COMPANY_EMAIL→CustomerEmail.

---

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`), Next.js-Web (`apps/web`).  
Produktion: `office.vivahome.de` (`/opt/office`).

**Ist-Zustand CRM:**
- `Customer` + `CustomerContact` (+ optional `CustomerEmail`, `CustomerBranch`)
- Kein klassischer CSV/Excel-Import für Kunden/Kontakte
- Visitenkarten-OCR und Website-Research existieren (Einzelkontakt / URL), **kein** Listen-/Datei→KI→Bulk-Flow
- `CustomerStatus` nur `ACTIVE` | `INACTIVE` – kein eigener Lead-Status (Phase 1: Kennzeichnung über Notizen/`rating`/Branche reicht)

**Vorbilder (wiederverwenden, nicht neu erfinden):**
- Settings + Secrets: `settings/email`, `settings/storage`, `settings/contacts` + `AppSettingsService`
- Preview→Confirm: `research-preview-dialog.tsx`, `contact-search-dialog.tsx`, `contact-scan-dialog.tsx`, Work-Items `import-section.tsx` / `pdf-import-section.tsx`
- Anlegen: `POST /customers`, `POST /customers/:id/contacts`, `POST /customers/:id/emails`, `POST /customers/:id/branches`
- Research-Proxy: `apps/api/src/research/*` / `apps/web/src/lib/research.ts` (Website→Firma; für NL-Lookup erweitern/reuse wo sinnvoll)
- SPIE-Mapping-Logik: `scripts/import-spie-outreach.cjs` (Priorität, Einheit, Quelle, `syncToGoogle: false`, Brosch-Dedup) – **Niederlassungsadressen fehlten dort noch** → jetzt Pflichtteil dieses Auftrags

**Nicht anfassen:** Kiosk, GPS, Stempeluhr, Calendar #20, Backup-Volumes, Deploy-Pipeline (außer Docs falls nötig).

---

## Ziel

Nach Abschluss:

1. **Einstellungen → KI / Assistent:** Base-URL, API-Key (maskiert), Modell, Aktiv-Toggle, Verbindungstest
2. **Kunden-Bereich:** Aktion „KI-Import“ – Datei hochladen (PDF, Excel/CSV, Text)
3. Server ruft konfiguriertes **OpenAI-kompatibles** Chat-Completions-API auf und liefert strukturierte Datensätze
4. **Niederlassungs-Anreicherung:** aus „SPIE ICS – Frankfurt“ o. Ä. eindeutige Standorte ableiten → öffentlich im Web recherchieren → Adresse/Tel/E-Mail vorschlagen
5. **Vorschau-UI** (editierbar, Zeilen an/aus, Niederlassungen + Kontakt→Branch-Zuordnung) → **Übernehmen** schreibt in die Prod-DB
6. Commit legt `CustomerBranch`-Datensätze an und setzt `contact.branchId`
7. Massenimport: `syncToGoogle` default **false**
8. `api` + `web` Build/`tsc` grün; Phase 1: **kein** neues Prisma-Modell (bestehendes `CustomerBranch` reicht)

---

## Nicht-Ziele (Phase 2)

- Eigener Status `PROSPECT` / Lead-Pipeline
- Bidirektionaler Sync / Google Contacts beim Massenimport
- Bild-OCR-Listen (Screenshots als Hauptquelle) – Phase 1: Text-PDF + Tabellen reichen; gescannte PDF ohne Textlayer = Fehlermeldung mit Hinweis
- Import anderer Entitäten (Nachunternehmer, Projekte, Work Items)
- Eigenes Microservice-Image; Agent/SSH-Import; Deploy pro Datei

---

## Produktentscheidungen (fest)

| Punkt | Entscheidung |
|-------|----------------|
| KI-Protokoll | OpenAI-kompatibel: `POST {baseUrl}/chat/completions` (oder vollständige URL falls User absolute Completions-URL setzt) |
| Auth | `Authorization: Bearer {apiKey}` |
| Konfiguration | `AppSetting`-Keys (UI), **nicht** nur Env – änderbar ohne Rebuild |
| Speichern | Nie ohne Nutzer-Freigabe (Preview → Commit) |
| Mapping-Default | Modus A: **1 Kunde** + viele Kontakte (SPIE-Fall); Modus B: **1 Zeile = 1 Kunde** (optional wählbar in Preview) |
| Niederlassungen | Aus Einheit/Standort-Text deduplizieren → Web-Anreicherung → `CustomerBranch`; Kontakt bekommt `branchId` |
| Web-Lookup | Nur **öffentliche** Quellen (Firmen-Standortseiten, Impressum, offizielle Kontaktseiten). Keine erfundenen Adressen. Unsicher → leer + Warning |
| Anreicherung UI | Default **an** (Checkbox „Niederlassungen im Web ergänzen“); abschaltbar für schnellen Nur-Listen-Import |
| Quelle | Jeder Import schreibt Quellen-Marker in Kunden-/Kontakt-/Branch-Notizen (inkl. gefundene URL falls bekannt) |
| Google | `syncToGoogle: false` beim Commit (Bulk) |
| Rollen | `SUPERADMIN`, `OFFICE` (Import + Settings); Settings-Key nur SUPERADMIN wenn so bei SMTP üblich – an Email/Storage angleichen |
| Deploy-Sicherheit | Feature läuft in bestehendem Container; **kein** `docker compose` ohne `--env-file .env.production` |

---

## 1. AppSettings – KI

Keys (Vorschlag):

| Key | Bedeutung |
|-----|-----------|
| `ai_assistant_enabled` | `"true"` / `"false"` |
| `ai_assistant_base_url` | z. B. `https://api.openai.com/v1` |
| `ai_assistant_api_key` | Secret (wie SMTP-Passwort: speichern, GET nur maskiert/`configured`) |
| `ai_assistant_model` | z. B. `gpt-4.1-mini` |
| `ai_assistant_timeout_ms` | optional, Default 120000 |

API:

- `GET /settings/ai` – Config ohne Klartext-Key (`apiKeyConfigured: boolean`, `apiKeyMasked`)
- `PUT /settings/ai` – speichern (leerer Key = Key unverändert lassen)
- `POST /settings/ai/test` – Mini-Request (z. B. models.list oder winziger chat) → ok/fehler

Web: neues Tile unter `/settings` → `/settings/ai` (Icon z. B. Sparkles), Texte in `texts`.

Wenn `ai_assistant_enabled=false` oder Key fehlt: Import-UI disabled mit Hinweis „unter Einstellungen konfigurieren“.

---

## 2. API – AI Import Modul

Neues Modul z. B. `apps/api/src/ai-import/`:

### 2.1 Datei-Extraktion (vor LLM)

- PDF: Text extrahieren (bereits Poppler/`pdftotext` o. ä. im API-Image vorhanden – Work-Item-PDF-Pfad prüfen und wiederverwenden)
- Excel/CSV: Tabellen → TSV/CSV-Text
- `.txt`/`.md`: raw
- Limit: sinnvolle Max-Größe (z. B. 8–15 MB) und Max-Zeichen an LLM (chunking wenn nötig: erst Zusammenfassung der Struktur, dann Batches)

### 2.2 LLM-Prompt → strukturiertes JSON

Schema (verbindlich im Prompt + JSON-Mode/`response_format` falls unterstützt):

```ts
{
  suggestedMode: 'ONE_CUSTOMER_MANY_CONTACTS' | 'ONE_ROW_ONE_CUSTOMER',
  customerDraft?: {
    companyName: string,
    country?: string,
    website?: string,
    industry?: string,
    rating?: string,   // A/B/C optional aus Priorität
    notes?: string
  },
  branches: Array<{
    include: boolean,
    key: string,                 // stabile Preview-ID, z.B. "frankfurt" / "ics-karlsruhe"
    name: string,                // Anzeigename NL, z.B. "SPIE ICS – Frankfurt"
    branchType?: string,         // OFFICE | HEADQUARTERS | OTHER
    addressLine1?: string,
    addressLine2?: string,
    postalCode?: string,
    city?: string,
    country?: string,            // DE/AT/CH …
    phone?: string,
    email?: string,
    mapsUrl?: string,
    notes?: string,              // Quellen-URL, Konfidenz-Hinweis
    enrichmentStatus: 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'SKIPPED',
    sourceUrls?: string[]
  }>,
  contacts: Array<{
    include: boolean,
    firstName: string,
    lastName: string,
    role?: string,
    email?: string,
    phoneLandline?: string,
    phoneMobile?: string,
    linkedInUrl?: string,
    country?: string,
    department?: string,         // Rohtext Einheit aus Quelle
    branchKey?: string,          // → branches[].key (Zuordnung NL)
    notes?: string,              // Priorität, Quelle, Hinweise
    priority?: 'A' | 'B' | 'C',
    kind?: 'PERSON' | 'COMPANY_EMAIL'  // Sammeladressen
  }>,
  companyEmails?: Array<{
    include: boolean,
    email: string,
    label?: string,
    emailType?: string           // default GENERAL
  }>,
  warnings: string[]             // Dedup, unsichere Felder, NL ohne Treffer, fehlender Textlayer
}
```

Regeln im System-Prompt (aus SPIE-Erfahrung):

- Nur öffentlich erkennbare Daten; keine E-Mail-Muster raten
- Doppelte Personen (gleicher Name+E-Mail) zusammenführen
- Sammel-NL-Adressen → `companyEmails` oder `kind: COMPANY_EMAIL`, nicht als Privatperson erzwingen
- Telefonstrategie-/Pitch-Text **nicht** als Kontakt importieren
- Quellenzeile: Dateiname + Import-Datum
- Einheit/Standort-Text (z. B. „SPIE ICS - Niederlassung Frankfurt“) → eigene `branches[]`-Zeile + `contacts[].branchKey`
- **Nie** Adressen erfinden: fehlender Web-Treffer = leere Adressfelder + `enrichmentStatus: NOT_FOUND` + Warning

### 2.2b Niederlassungs-Anreicherung (Web) – Pflicht in Phase 1

**SPIE-Beispiel:** Ansprechpartner in Frankfurt, Karlsruhe, Bremen, Berlin, …  
→ nicht nur Freitext in `department`/`notes`, sondern echte `CustomerBranch`-Stammdaten (Straße, PLZ, Ort, Tel, ggf. NL-E-Mail).

**Pipeline nach der Listen-Extraktion:**

1. **Extrahieren:** aus Kontaktzeilen eindeutige Standorte/`branchKey` ableiten (Stadt + Einheit, z. B. ICS Frankfurt ≠ SAG Essen).
2. **Lookup (serverseitig):** für jede NL öffentliche Infos holen. Erlaubte Strategien (eine oder Kombination, pragmatisch umsetzen):
   - Bestehenden **Research-Service** erweitern/nutzen (`POST /research/…` bzw. interner Call) mit Query à la `"{companyName} {branchName} Adresse"` / offizielle Standort-URL, falls aus der Datei bekannt
   - LLM mit **Tool-/URL-Kontext**: Server fetcht 1–3 Kandidaten-URLs (offizielle Domain der Firma, z. B. spie.de Standort/Kontakt) und übergibt **nur den geholten Seitentext** an die KI zur strukturierten Extraktion (kein Blind-Halluzinieren)
   - Optional: wenn das gewählte KI-Backend natives Web-Search anbietet und in Settings nutzbar ist – erlauben, aber Ergebnis trotzdem ins gleiche Branch-Schema mappen
3. **Merge:** Treffer in `branches[]` schreiben; Kontakt behält `branchKey`.
4. **Timeouts:** NL-Lookup darf Preview nicht endlos blockieren – Parallelisierung mit Limit (z. B. max 5–8 gleichzeitige Lookups), pro NL Timeout; Rest = `NOT_FOUND` + Warning „manuell nachpflegen“.
5. **UI-Flag** `enrichBranches=true|false` am Preview-Request (Default `true`).

**Felder pro Branch (Mapping auf Prisma `CustomerBranch`):**  
`name`, `branchType`, `addressLine1/2`, `postalCode`, `city`, `country`, `phone`, `email`, `mapsUrl?`, `notes` (Quelle).

### 2.3 Endpoints

- `POST /ai-import/contacts/preview`  
  - multipart file (+ optional `hint` Text, `mode` override, `enrichBranches` default true)  
  - Response: Schema oben + `previewId` (serverseitig kurz cachen, z. B. 30–60 Min in Memory/Redis-los: DB-temp oder signed payload)  
  - **Keine** DB-Writes außer optional temp cache

- `POST /ai-import/contacts/commit`  
  - Body: vom User editiertes Preview-JSON (oder `previewId` + patches)  
  - Transaktion:
    1. Customer create/update  
    2. für jede included `branches[]`-Zeile → `CustomerBranch` create (Map `key` → echte `branchId`)  
    3. Contacts create mit `branchId` aus Map  
    4. `CustomerEmail` für `companyEmails`  
  - Response: `{ customerId, customerNumber, createdBranches, createdContacts, createdEmails, skipped }`

Dedup Commit (minimal):

- Wenn `customerDraft.companyName` existiert (case-insensitive, nicht soft-deleted): **nicht** stumm mergen – in Preview `warnings` + Commit-Option `attachToCustomerId` **oder** Abbruch mit 409 und Vorschlag. Phase 1 pragmatisch: Query-Param/`attachToCustomerId` optional; Default = neuer Kunde, außer User wählt bestehenden in UI.
- Bestehende Branches am Zielkunden: nach Name/Stadt matchen und wiederverwenden statt Duplikat (Warning „bestehende NL verknüpft“).

---

## 3. Web-UI

### 3.1 Settings `/settings/ai`

- Felder: Aktiv, Base-URL, Modell, API-Key (Password-Input), Test-Button, Status
- Speichern / Fehlerzustände wie Email-Settings

### 3.2 Import `/customers` (oder Unterroute `/customers/ai-import`)

- Button „KI-Import“ (nur wenn Feature enabled + Recht)
- Upload-Zone + optionaler Hinweistext an die KI („Das sind SPIE-Niederlassungskontakte…“)
- Checkbox **„Niederlassungen im Web ergänzen“** (Default an)
- Nach Preview:
  - Modus-Wahl (1 Kunde / viele Kunden)
  - **Niederlassungs-Tabelle** (Name, Adresse, PLZ, Ort, Tel, Status FOUND/PARTIAL/NOT_FOUND, Checkbox)
  - Kontakt-Tabelle: Checkbox, editierbare Zellen, **Spalte Niederlassung** (Select aus `branches`)
  - Firma-Stammdaten-Card oben
  - Warnings-Callout (inkl. NL ohne Treffer)
  - „Übernehmen“ / „Abbrechen“
- Ergebnis-Toast mit Link zum Kunden (Kontakte-Tab zeigt Branch-Zuordnung)

UI-Stil: bestehende shadcn/Dialog/Table-Patterns; **kein** neues Design-System.

---

## 4. Sicherheit & Betrieb

- API-Key nur Server; nie an Client im Klartext nach GET
- Timeout + klare Fehlermeldungen (401 Key, 429 Rate limit, leerer PDF-Text)
- Audit: `AuditLog` oder zumindest Notiz am Kunden mit User-Id/Zeit/Dateiname
- Keine automatische Google-Contacts-Flut
- **Wichtig für Agenten:** Deploy immer  
  `docker compose -f docker-compose.prod.yml --env-file .env.production …`  
  (ohne Env-File: leere Secrets / falscher Web-Build mit localhost-API)

---

## 5. Tests / Abnahme

Manuell auf Prod nach Deploy:

1. Settings KI: Key speichern → Test grün
2. SPIE-PDF (oder kleinere Excel) hochladen → Preview zeigt Kontakte inkl. Priorität/LinkedIn
3. Preview zeigt **mehrere Niederlassungen** (Frankfurt, Karlsruhe, Bremen, Berlin, …) mit Adressvorschlägen wo öffentlich findbar; Kontakte sind den NLs zugeordnet
4. Eine Kontaktzeile und eine NL abwählen / Adresse korrigieren → Commit
5. Am Kunden: Branches angelegt; Kontakt hat `branchId`; `syncToGoogle=false`
6. Preview mit `enrichBranches=false` → Branches nur als Name/Key ohne Web-Adressen (schnell)
7. Feature disabled → Button/API liefern klare 403/Hinweis
8. `pnpm`/Docker Build api+web grün

Referenzdatei (lokal/Drive, nicht committen falls groß):  
`SPIE_Kontaktliste_und_Outreach.pdf` – Kontakte + NL-Anreicherung.

---

## 6. Dateien / Orte (Orientierung)

Neu (Vorschlag):

- `apps/api/src/ai-import/` (module, service, controller, dto, prompt)
- `apps/web/src/app/(authenticated)/settings/ai/page.tsx`
- `apps/web/src/components/customers/ai-import-dialog.tsx` (o. ä.)
- `apps/web/src/lib/ai-import.ts`, Settings-Client

Anpassen:

- `settings/page.tsx` Nav-Tile
- `texts` (settings + customers)
- `app.module.ts` / Routing

Skript `scripts/import-spie-outreach.cjs` behalten (Dokumentation/Notfall), nicht als Produktpfad.

---

## Done-When

- [x] KI-Settings inkl. Test in der App
- [x] Preview + Commit für Kontakt-/Interessenten-Dateien
- [x] SPIE-ähnliche Liste sinnvoll normalisiert (ohne Blind-Write)
- [x] Niederlassungen: Web-Anreicherung + `CustomerBranch` + Kontakt-`branchId`
- [x] Google-Sync aus bei Bulk
- [x] Builds grün; Prod-Deploy ausstehend (SSH-Key Cloud-VM)
- [ ] auf Prod deployt mit `--env-file .env.production`
- [x] Kurznotiz in `STATUS.md` / Backlog: Feature live

---

## Übergabe an Cloud

Dieses Dokument ist die alleinige Spec. Bei Unklarheiten: konservativ Preview-first, bestehende Customer-APIs wiederverwenden, keine Schema-Spielereien ohne Not.
