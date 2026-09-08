# Cloud-Auftrag #33: Monteur signiert Stundenzettel mobil (P2 Zeiterfassung)

## Kontext

P1 Auto-Clock-Out ist Prod. **P2:** Der Monteur unterschreibt den Wochen-Stundenzettel **am Handy** (Worker-App). Danach ist der Zettel für weitere Stunden **geschlossen**. Anschließend kann der Kunden-PL wie bisher abzeichnen.

### Ist

- Signatur-API + Canvas existieren; Office kann „Als Monteur“ signieren (Stellvertretung)
- `sign(WORKER)` im `DRAFT` → Status `WORKER_SIGNED` (Regen/Tagesedit gesperrt)
- Rolle **`WORKER` hat keinen Zugriff** auf `/timesheets/*`
- Worker-App / Mobile: **keine** Timesheet-Routen
- Stempel-Lock (`isDayLocked`) greift erst bei `FINAL_STATUSES` (APPROVED/…) – nach `WORKER_SIGNED` kann weiter gestempelt werden, Sheet wird aber nicht mehr nachgezogen
- Kunden-PL `approve` erwartet Status `SUBMITTED` (nicht `WORKER_SIGNED`)

## Ziel

1. Monteur sieht in der **Worker-App** seine Wochen-Stundenzettel (Liste → Detail).
2. Monteur unterschreibt digital (`SignerType.WORKER`) am Handy.
3. Nach Unterschrift: Status `WORKER_SIGNED`, **keine weiteren Stunden** mehr für diese Projekt-KW auf dem Zettel / per Stempel in diese KW.
4. Kunden-PL kann abzeichnen, ohne dass das Büro zwingend noch „Einreichen“ drücken muss.
5. Mobile Expo: mindestens API-fähig; UI in Worker-App ist **Pflicht**, Expo-UI **nice-to-have** wenn Aufwand gering (sonst Follow-up).

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Primäre UI | **Worker-App** (`/worker-app/...`) – PWA am Handy |
| Expo Mobile | Optional in diesem Auftrag; wenn nicht: klar im PR als Follow-up |
| Scope Liste | Nur Stundenzettel des **eingeloggten Monteurs** (`workerId`) |
| Signieren | Nur eigener Zettel; `signerType` fest `WORKER`; Name aus Worker-Stammdaten (vorausgefüllt, editierbar optional) |
| Status nach Sign | `DRAFT` → `WORKER_SIGNED` (bestehend); zusätzlich: siehe PL-Freigabe |
| PL-Freigabe | `approve` und PL-Listen akzeptieren **`WORKER_SIGNED` und `SUBMITTED`** |
| Büro-Einreichen | Bleibt für Fälle ohne Monteur-Signatur; wenn bereits `WORKER_SIGNED`, kein erneutes Submit nötig |
| Stunden-Sperre | Ab `WORKER_SIGNED` (und `SUBMITTED`/`APPROVED`/…): für dieses **Projekt + ISO-KW** keine neuen Stempelungen (clock-in/out/break/manual), die in diese KW fallen würden – klare Fehlermeldung |
| Korrektur | Nur Büro: Zurückweisen (`REJECTED`) bzw. bestehender Unlock-Pfad; dann wieder editierbar/stempelfähig |
| Office-Proxy-Signatur | Bleibt erhalten (Büro kann weiter als Monteur signieren) |
| Offline | Signatur online; bei Offline klarer Hinweis |

## API

### Rollen erweitern

Für Worker-JWT (`roles: ['WORKER']`):

| Endpoint | Erlaubnis |
|----------|-----------|
| `GET /timesheets` | Nur eigene (`workerId` = Session-Worker); Query unverändert wo sinnvoll |
| `GET /timesheets/:id` | Nur eigener |
| `GET /timesheets/:id/pdf` | Nur eigener (optional, wenn PDF schon existiert) |
| `POST /timesheets/:id/sign` | Nur eigener; **nur** `signerType: WORKER` |

Nicht für Worker: generate, days CRUD, submit/reject/archive/approve.

Implementierung analog `CUSTOMER_PL`-Scoping in `timesheets.service` / Guard: bei Rolle WORKER hart auf `sheet.workerId === auth.workerId` filtern.

### Workflow-Anpassung

1. `approve()`: erlaubt Status `SUBMITTED` **oder** `WORKER_SIGNED`.
2. Kiosk-PL / PL-Web Listen: `WORKER_SIGNED` wie „bereit zur Kunden-Abzeichnung“ anzeigen (nicht nur SUBMITTED).
3. Stempel-Sperre: `TimeEntriesService` – vor clockIn/clockOut/break/manual prüfen, ob für `projectId` + Kalenderwoche (Europe/Berlin) ein Sheet in Status ∈ `{ WORKER_SIGNED, SUBMITTED, APPROVED, COMPLETED, LOCKED, ARCHIVED }` existiert → Conflict mit DE-Text.

## Worker-App UI

Neue Routen (Vorschlag):

- `/worker-app/timesheets` – Liste (KW, Projekt, Status, CTA „Unterschreiben“ wenn DRAFT/REJECTED und noch keine WORKER-Signatur)
- `/worker-app/timesheets/[id]` – Tagesübersicht (read-only), Signatur-Canvas, Speichern

Navigation: Link vom Dashboard (neben Work-Items).

Reuse: `signature-canvas.tsx` (ggf. shared ohne Office-Chrome).

Texte DE in bestehenden texts-Dateien.

## Akzeptanzkriterien

1. Worker-Login → Liste eigener Stundenzettel sichtbar.
2. DRAFT unterschreiben → Status `WORKER_SIGNED`, Signatur gespeichert, PDF/Detail zeigt sie.
3. Weiteres Stempeln in derselben Projekt-KW → API-Fehler mit klarer Meldung; Sheet-Regen blockiert (schon).
4. Kunden-PL kann `WORKER_SIGNED`-Zettel signieren + approve (Kiosk und/oder `/pl`).
5. Fremde Worker-IDs / andere Monteure → 403/404.
6. Office-Proxy-Signatur und bestehender Submit-Flow bleiben funktionsfähig.
7. Deploy mit `--env-file .env.production`; kein `down -v`.

## Nicht in Scope

- P3 Tätigkeitsminuten, P4 No-Show, Geofence
- Neue Signaturarten
- Automatische E-Mail an Kunden bei Worker-Sign (optional später)

## Tests

- Unit/API: Worker darf eigenen Sheet signen; fremden nicht
- approve von WORKER_SIGNED
- clockIn nach WORKER_SIGNED derselben KW → Conflict
- Worker-App Smoke: Route erreichbar (soweit testbar)
