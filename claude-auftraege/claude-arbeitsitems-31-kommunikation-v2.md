# Cloud-Auftrag #31: Kommunikation v2 – Kontakt, Übersicht, To-Do & Termin

**Status:** Spec startklar · **Umsetzung erst nach** Abschluss von `#30` (Stundenzettel Arbeiten) und idealerweise **nach oder parallel mit** `#20` (Google Calendar / Office-Termine)  
**Abhängigkeit Termin-Button:** `#20` muss Office-Termin-Entität (`CalendarEvent`) liefern. To-Do-Button braucht `#20` **nicht**.

## Kontext

Bestehend:
- `CommunicationEntry` (Kunde / Subunternehmer / Monteur), Typen inkl. `PHONE_CALL`, optional `contactId`
- UI-Tab Kommunikation an Entity-Detail
- To-Dos (`/todos`) mit Entity-Bezug
- `CustomerCallLog` (älter, teilweise parallel) – konsolidieren oder deprecaten
- `/projects/calendar` = nur Projekt-Timeline, **keine** Termine

Zielbild User:
- Telefonprotokoll / kurze Zusammenfassung am **Ansprechpartner**
- **Gesamtübersicht** aller Telefonate (nicht nur im Stammdatensatz)
- Gleiches Muster für Kunde, Sub, Monteur
- Aus einer Kommunikation direkt **To-Do** oder **Termin** anlegen
- WhatsApp: in **diesem** Auftrag nur optionaler Eintragstyp / Notiz – **kein** Chat-Sync (Business-API = Folgeauftrag)

## Ziel

1. Kommunikationserfassung mit klarem Personenbezug (Kontakt / Ansprechpartner wo vorhanden).
2. Globale Übersicht `/communication` (Filter: Typ, Entity, Person, Zeitraum, Autor).
3. Ansicht „Telefonate dieser Person“ am Kundenkontakt (und analog wo sinnvoll).
4. Aktionen am Eintrag: **To-Do anlegen**, **Termin anlegen** (Termin erst wenn `#20` merged).
5. Optional: Typ `WHATSAPP` als manuelle Notiz (kein Import).
6. Eine Historie – `CustomerCallLog` nicht parallel weiterentwickeln.

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Primärmodell | `CommunicationEntry` erweitern/nutzen |
| CustomerCallLog | Migration/Read-Only-Hinweis oder Import in CommunicationEntry; danach UI nur Communication |
| Personenbezug Kunde | `contactId` → `CustomerContact` (FK falls noch weich); UI: Kontakt wählen bei PHONE_CALL |
| Sub / Worker | `contactId` optional; Sub-Kontakte nutzen falls vorhanden, sonst Entity-Notiz |
| Übersicht | Neue Route z. B. `/communication` in Nav (Office/SUPERADMIN/PM) |
| To-Do aus Eintrag | Prefill: Titel aus subject/content-Kürzel, `linkedEntityType/Id`, optional Link `communicationEntryId` am Todo (neues optionales Feld) |
| Termin aus Eintrag | Prefill Beschreibung + customerId/projectId wenn ableitbar; nur wenn Calendar-API aus `#20` existiert – sonst Button disabled + Tooltip „Kalender folgt“ |
| WhatsApp v1 | Enum-Wert `WHATSAPP` + manuelle Erfassung; **kein** API-Sync |
| Diktat | Bestehende Dictation-Button wo sinnvoll beibehalten |

## Scope

### A) Datenmodell

- `CommunicationEntry`: echte Relation `contact` wo möglich; Indexe ok
- Optional `Todo.communicationEntryId?`, `CalendarEvent.communicationEntryId?` (nach `#20`)
- Enum `CommunicationType` + `WHATSAPP`
- Script/Migration: vorhandene `CustomerCallLog` → `CommunicationEntry` (best effort) oder dokumentiert belassen und UI ausblenden

### B) API

- `GET /communication` ohne Pflicht-Entity (Übersicht) mit Filtern
- Bestehende Create/Update: Validierung contact gehört zu Customer
- `POST /communication/:id/create-todo` oder Client ruft Todos-API mit Prefill – **Empfehlung:** Client-Prefill + bestehendes Todo-Create (weniger Backend), optional Server-Helper
- Termin: analog nach `#20` (`POST /calendar-events` mit Prefill)

### C) UI

1. Nav: **Kommunikation** / Telefonate (Übersicht)
2. Entity-Tabs: UX „Schnelles Telefonat“ (Kontakt + Kurzfassung + Richtung)
3. Kundenkontakt-Detail oder Kontaktzeile: Link „Telefonate“
4. Eintrag-Menü: „To-Do anlegen“, „Termin anlegen“
5. Texte DE

### D) Nicht in diesem Auftrag

- WhatsApp Business API / Chat-Import
- Google-Calendar-Implementierung selbst → **`#20`**
- E-Mail-Ingest / IMAP
- Automatisches Anlegen von Terminen ohne User-Bestätigung

## Reihenfolge / Gates

```text
#30 Stundenzettel Arbeiten     → zuerst fertig (läuft)
#20 Google Calendar            → Termine + Sync (Admin-Scope nötig)
#31 Kommunikation v2           → danach (To-Do sofort nutzbar; Termin-Button an #20 koppeln)
```

Wenn `#31` vor `#20` gebaut wird: Termin-Aktion stubben/ausblenden bis Calendar-Routen existieren.

## Tests

1. Telefonat mit Kontakt speichern; Filter Übersicht + Kontakt-Ansicht.
2. To-Do aus Eintrag: Prefill + Link zur Entity.
3. Fremder contactId → 400.
4. WHATSAPP-Eintrag manuell.
5. (Mit #20) Termin aus Eintrag erscheint in Office-Kalender / Sync-Flag.
6. Build grün.

## Lieferumfang

- PR `feat(communication): Übersicht, Kontaktbezug, To-Do/Termin aus Eintrag`
- Explizit: kein WhatsApp-Sync; Abhängigkeit `#20` für Termine

## Referenzen

- Ist: `apps/api/src/communication/`, `apps/web/src/components/communication/`
- Todos: `apps/api/src/todos/`
- Kalender: `claude-arbeitsitems-20-google-calendar.md`
- Arbeiten (laufend): `claude-arbeitsitems-30-stundenzettel-arbeiten.md`
