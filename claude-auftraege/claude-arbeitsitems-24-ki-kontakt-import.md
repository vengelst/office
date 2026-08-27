# Cloud-Auftrag #24: KI-basierter Import – Interessenten / Kontakte

**Status:** Spec startklar (2026-08-27) · Prod = **v1.0.1** · Branch `main`  
**Umsetzung:** Cloud-Agent · **kein** Stack-Rebuild pro Import (reine Laufzeitfunktion)  
**Bezug:** Manueller SPIE-Import (`scripts/import-spie-outreach.cjs`) als fachliches Vorbild – gleiche Qualität, aber in der App mit Preview/Freigabe.

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
- Anlegen: `POST /customers`, `POST /customers/:id/contacts`, `POST /customers/:id/emails`
- SPIE-Mapping-Logik: `scripts/import-spie-outreach.cjs` (Priorität, Einheit, Quelle, `syncToGoogle: false`, Brosch-Dedup)

**Nicht anfassen:** Kiosk, GPS, Stempeluhr, Calendar #20, Backup-Volumes, Deploy-Pipeline (außer Docs falls nötig).

---

## Ziel

Nach Abschluss:

1. **Einstellungen → KI / Assistent:** Base-URL, API-Key (maskiert), Modell, Aktiv-Toggle, Verbindungstest
2. **Kunden-Bereich:** Aktion „KI-Import“ – Datei hochladen (PDF, Excel/CSV, Text)
3. Server ruft konfiguriertes **OpenAI-kompatibles** Chat-Completions-API auf und liefert strukturierte Datensätze
4. **Vorschau-UI** (editierbar, Zeilen an/aus) → **Übernehmen** schreibt in die Prod-DB
5. Massenimport: `syncToGoogle` default **false**
6. `api` + `web` Build/`tsc` grün; ggf. Prisma nur wenn neues Modell nötig (Phase 1: **kein** neues Domain-Modell nötig)

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
| Quelle | Jeder Import schreibt Quellen-Marker in Kunden-/Kontakt-Notizen |
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
    department?: string,       // z.B. SPIE-Einheit
    notes?: string,            // Priorität, Quelle, Hinweise
    priority?: 'A' | 'B' | 'C',
    kind?: 'PERSON' | 'COMPANY_EMAIL'  // Sammeladressen
  }>,
  companyEmails?: Array<{
    include: boolean,
    email: string,
    label?: string,
    emailType?: string         // default GENERAL
  }>,
  warnings: string[]           // Dedup-Hinweise, unsichere Felder, fehlender Textlayer
}
```

Regeln im System-Prompt (aus SPIE-Erfahrung):

- Nur öffentlich erkennbare Daten; keine E-Mail-Muster raten
- Doppelte Personen (gleicher Name+E-Mail) zusammenführen
- Sammel-NL-Adressen → `companyEmails` oder `kind: COMPANY_EMAIL`, nicht als Privatperson erzwingen
- Telefonstrategie-/Pitch-Text **nicht** als Kontakt importieren
- Quellenzeile: Dateiname + Import-Datum

### 2.3 Endpoints

- `POST /ai-import/contacts/preview`  
  - multipart file (+ optional `hint` Text, `mode` override)  
  - Response: Schema oben + `previewId` (serverseitig kurz cachen, z. B. 30–60 Min in Memory/Redis-los: DB-temp oder signed payload)  
  - **Keine** DB-Writes außer optional temp cache

- `POST /ai-import/contacts/commit`  
  - Body: vom User editiertes Preview-JSON (oder `previewId` + patches)  
  - Transaktion: Customer create/update + Contacts + Emails  
  - Response: `{ customerId, customerNumber, createdContacts, createdEmails, skipped }`

Dedup Commit (minimal):

- Wenn `customerDraft.companyName` existiert (case-insensitive, nicht soft-deleted): **nicht** stumm mergen – in Preview `warnings` + Commit-Option `attachToCustomerId` **oder** Abbruch mit 409 und Vorschlag. Phase 1 pragmatisch: Query-Param/`attachToCustomerId` optional; Default = neuer Kunde, außer User wählt bestehenden in UI.

---

## 3. Web-UI

### 3.1 Settings `/settings/ai`

- Felder: Aktiv, Base-URL, Modell, API-Key (Password-Input), Test-Button, Status
- Speichern / Fehlerzustände wie Email-Settings

### 3.2 Import `/customers` (oder Unterroute `/customers/ai-import`)

- Button „KI-Import“ (nur wenn Feature enabled + Recht)
- Upload-Zone + optionaler Hinweistext an die KI („Das sind SPIE-Niederlassungskontakte…“)
- Nach Preview:
  - Modus-Wahl (1 Kunde / viele Kunden)
  - Tabelle Kontakte: Checkbox, editierbare Zellen
  - Firma-Stammdaten-Card oben
  - Warnings-Callout
  - „Übernehmen“ / „Abbrechen“
- Ergebnis-Toast mit Link zum Kunden

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
2. SPIE-PDF (oder kleinere Excel) hochladen → Preview zeigt ~Kontakte inkl. Priorität/LinkedIn
3. Eine Zeile abwählen, eine E-Mail korrigieren → Commit
4. Kunde erscheint mit Kontakten; `syncToGoogle=false`
5. Feature disabled → Button/API liefern klare 403/Hinweis
6. `pnpm`/Docker Build api+web grün

Referenzdatei (lokal/Drive, nicht committen falls groß):  
`SPIE_Kontaktliste_und_Outreach.pdf` – erwartetes Verhalten wie manueller Import.

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

- [ ] KI-Settings inkl. Test in der App
- [ ] Preview + Commit für Kontakt-/Interessenten-Dateien
- [ ] SPIE-ähnliche Liste sinnvoll normalisiert (ohne Blind-Write)
- [ ] Google-Sync aus bei Bulk
- [ ] Builds grün, auf Prod deployt mit `--env-file .env.production`
- [ ] Kurznotiz in `STATUS.md` / Backlog: Feature live

---

## Übergabe an Cloud

Dieses Dokument ist die alleinige Spec. Bei Unklarheiten: konservativ Preview-first, bestehende Customer-APIs wiederverwenden, keine Schema-Spielereien ohne Not.
