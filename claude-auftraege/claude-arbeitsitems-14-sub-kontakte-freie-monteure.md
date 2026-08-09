# Cloud-Auftrag #14: Subunternehmen-Kontakte, Monteur-Typ & freie Monteure

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de` (`/opt/office`).

**Ist-Zustand (Probleme):**
1. Monteur-Typ / Subunternehmen nur im Vertrags-Tab; beim Anlegen fehlt die Zuordnung. API-Default ist still `SUBCONTRACTED` → neue Monteure ohne Typ landen als Sub.
2. Subunternehmen haben nur ein Freitext-Feld `contactPerson` – keine strukturierten Kontakte.
3. Projekt-Ansprechpartner und E-Mail-Empfänger sind einfache Selects/Freitext ohne zentrale Kontakt-Suggestions.
4. Monteur-Zuordnung prüft nur „irgendeine aktive Assignment“ – keine Datums-Überlappung; freie Monteure im Zeitraum nicht filterbar.

---

## Ziel

Nach Abschluss:

1. Beim **Anlegen/Bearbeiten** eines Monteurs: Feld **Typ** + Dropdown **Subunternehmen**. Bei `SUBCONTRACTED` Pflicht – Speichern ohne Zuordnung unmöglich. Shared Component `SubcontractorSelect` inkl. Inline „Neues Subunternehmen“. Contract-Tab nutzt dieselbe Komponente. API-Default `workerType` = **EMPLOYED**.
2. **Subunternehmen-Kontakte:** Prisma-Model `SubcontractorContact`, Migration, CRUD unter `/subcontractors/:id/contacts`, UI auf Sub-Detail.
3. **Kontakt-Suggestions:** `GET /contacts/suggestions`, Combobox; Einsatz Projekt-Ansprechpartner (durchsuchbar) + E-Mail-Empfänger vorausfüllen.
4. **Freie Monteure:** `GET /projects/meta/workers?from&to&availableOnly` mit Datums-Überlappungslogik; AssignmentsTab filtert danach; API-Conflict ebenfalls datumsbasiert.

---

## Nicht-Ziele

- Stempel / Foto / Kiosk
- Google Contacts Sync für Sub-Kontakte
- Mobile-APK

---

## 1. Monteur Typ + Subunternehmen

### 1.1 API / Prisma

- `Worker.workerType` Default von `SUBCONTRACTED` → **`EMPLOYED`** (Schema + Migration `@default(EMPLOYED)`).
- `WorkersService.create`: Fallback `dto.workerType ?? WorkerType.EMPLOYED` (nicht SUBCONTRACTED).
- Bei `EMPLOYED` muss `subcontractorId` auf `null` gesetzt/gelöscht werden.
- Bestehende Validierung beibehalten: `SUBCONTRACTED` ohne `subcontractorId` → `400 Bad Request`.

### 1.2 Shared UI: `SubcontractorSelect`

Neue Komponente z. B. `apps/web/src/components/workers/subcontractor-select.tsx`:

- Props: `value`, `onChange`, `required?`, `disabled?`, `error?`
- Lädt aktive Subunternehmen
- Select-Dropdown
- Aktion/Option **„Neues Subunternehmen“** → Inline-Dialog (Name Pflicht, optional Kontakt/Telefon/E-Mail) → `POST /subcontractors` → Liste refreshen → neuen Eintrag auswählen

### 1.3 Formulare

- **Anlegen** (`WorkerMasterForm` / New-Page): Felder Typ + (bei SUB) SubcontractorSelect; Submit blockiert bei fehlender Sub-Zuordnung.
- **Contract-Tab**: bestehende Selects durch `SubcontractorSelect` ersetzen; gleiche Pflichtlogik.

---

## 2. Subunternehmen-Kontakte

### 2.1 Prisma

```prisma
model SubcontractorContact {
  id              String   @id @default(cuid())
  subcontractorId String
  title           String?
  firstName       String
  lastName        String
  role            String?
  email           String?
  phoneMobile     String?
  phoneLandline   String?
  notes           String?
  isPrimary       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  subcontractor Subcontractor @relation(fields: [subcontractorId], references: [id], onDelete: Cascade)

  @@index([subcontractorId])
}
```

`Subcontractor` Relation `contacts SubcontractorContact[]` ergänzen.
Legacy-Feld `contactPerson` bleibt bestehen (Kompatibilität).

### 2.2 API

Unter `/subcontractors/:id/contacts`:

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/:id/contacts` | Liste |
| POST | `/:id/contacts` | Anlegen |
| PATCH | `/:id/contacts/:contactId` | Bearbeiten |
| DELETE | `/:id/contacts/:contactId` | Löschen |

DTO analog Kunden-Kontakten (schlanker: ohne Branch/Google).
Detail `GET /subcontractors/:id` inkludiert `contacts`.

### 2.3 UI

Auf Sub-Detailseite: Abschnitt **Kontakte** (CRUD-Dialog, Cards/Liste), Muster wie Kunden-Kontakte (ohne OCR/Google).

---

## 3. Kontakt-Suggestions

### 3.1 Endpoint

`GET /contacts/suggestions`

Query (optional):

- `q` – Suche in Name, E-Mail, Firma
- `customerId` – nur Kundenkontakte dieses Kunden
- `limit` – default 20

Antwort-Items (Beispiel):

```ts
{
  id: string;
  source: 'CUSTOMER' | 'SUBCONTRACTOR';
  customerId?: string | null;
  subcontractorId?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneMobile: string | null;
  role: string | null;
  companyName: string | null;
  label: string; // Anzeige
}
```

Quellen: `CustomerContact` (+ Kundenname) und `SubcontractorContact` (+ Sub-Name).
Bei gesetztem `customerId` nur Kundenkontakte dieses Kunden.

### 3.2 UI-Komponente

`ContactSuggestionCombobox` (oder Erweiterung der bestehenden Combobox):

- Durchsuchbar, lädt Suggestions (debounced)
- `onSelect(suggestion)` Callback

### 3.3 Einsatz

1. **Projekt-Formular – Ansprechpartner:** statt reinem Select → durchsuchbare Combobox über Suggestions (`customerId` gefiltert); Auswahl setzt `primaryCustomerContactId`.
2. **E-Mail-Empfänger-Tab:** E-Mail-/Name-Felder per Suggestion vorausfüllen (freie Eingabe weiterhin möglich).

---

## 4. Freie Monteure (Datums-Überlappung)

### 4.1 Endpoint

`GET /projects/meta/workers`

Query:

- `from` (ISO date, optional)
- `to` (ISO date, optional)
- `availableOnly` (`true`/`1`)

**Überlappung** einer Assignment mit Intervall `[from, to]`:

```
startDate <= to AND (endDate IS NULL OR endDate >= from)
```

Wenn `from`/`to` fehlen: sinnvolle Defaults (z. B. heute → weit in der Zukunft) oder ohne Datumsfilter nur `active: true` Workers.

Bei `availableOnly=true`: Workers **ausschließen**, die im Intervall eine **aktive** überlappende Assignment haben.

### 4.2 Conflict bei Assignments

`assertNoActiveAssignment` → datumsbasiert:

- Konflikt, wenn der Worker bereits eine **aktive** Assignment hat, die mit dem neuen/aktualisierten `[startDate, endDate]` überlappt (open-ended = `endDate null`).
- 409 mit Hinweis auf belegendes Projekt.

### 4.3 AssignmentsTab

- Worker-Liste über `listWorkers({ from, to, availableOnly: true })` laden, sobald Start-/Enddatum im Dialog gesetzt/geändert.
- Fallback: ohne Datum weiterhin alle aktiven Monteure bzw. verfügbare ohne Intervallfilter.

---

## 5. Texte / i18n

Neue Labels in `texts.ts` (Sub-Kontakte, Suggestions, freie Monteure, Validierungsfehler).

---

## 6. Abnahme

- [ ] Neuer Monteur default EMPLOYED; SUB ohne Sub → Speichern unmöglich (UI + API 400)
- [ ] `SubcontractorSelect` inkl. Inline-Neuanlage in Contract-Tab und Anlegen
- [ ] Sub-Kontakte CRUD auf Detailseite; Migration deploybar (`prisma migrate deploy`)
- [ ] Suggestions-Endpoint; Projekt-Ansprechpartner durchsuchbar; E-Mail-Empfänger vorausfüllbar
- [ ] `meta/workers?availableOnly` filtert nach Datumsüberlappung; AssignmentsTab nutzt Filter; Conflict datumsbasiert
- [ ] Typecheck API + Web grün
- [ ] Commit, Push, Deploy auf Produktionsserver

---

## Grenzen

- Keine Änderung am Stempel-/Kiosk-/Foto-Flow
- Kein Google-Sync für SubcontractorContact
- Keine Mobile-APK-UI
