# Cloud-Auftrag #34: Stunden-Tätigkeiten mid-day für Normal-Monteure (P3)

## Kontext

P1 Auto-Clock-Out und P2 Monteur-Signatur sind Prod.

**P3:** Auf **stundenbasierten** Projekten (`billingMode = HOURLY_PACKAGE`) müssen **normale Monteure** (nicht nur Master) Tätigkeiten mit **Minuten** erfassen und **während der Schicht wechseln** können – damit der Kunde Stunden je Tätigkeit sieht.

Zwei bestehende Spuren **nicht vermischen**:

| Spur | Zweck | Minuten? |
|------|--------|----------|
| #22 `ActivityType` + `TimeActivitySegment` | Abrechnungsrelevante Tätigkeiten (Anfahrt, Montage, …) | **ja** |
| #30 `ProjectWorkActivity` | Clock-Out-Checkboxen „was war“ | **nein** |

P3 erweitert **#22** auf Normal-Monteure bei `HOURLY_PACKAGE`. #30 bleibt unverändert.

## User-Festlegung (2026-09-08)

- Pflicht / Mid-Day-Wechsel **nur** bei `billingMode === 'HOURLY_PACKAGE'`
- `MIXED`, `UNIT_BASED`, `null`: Normal-Monteur **ohne** Segmente (nur #30 nach Clock-Out)
- Master (`masterEngineer`): unverändert auf **allen** Projekten (Pflicht + Wechsel)

## Ziel

1. Normal-Monteur auf HOURLY_PACKAGE: Tätigkeit beim Clock-In **pflicht**, Wechsel ohne Ausstempeln.
2. Segmente → Stundenzettel-Minuten + PDF wie bei Master (bestehende Generierung).
3. Worker-App + Kiosk-UI: Select wie Master, wenn Projekt stundenbasiert.
4. #30-Modal nach Clock-Out bleibt für alle.

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Katalog | Globaler `ActivityType` (Settings → Tätigkeitsbereiche) – **kein** neuer Projekt-Katalog |
| Gate | `masterEngineer` **oder** (offenes/zu stempelndes Projekt `billingMode === 'HOURLY_PACKAGE'`) |
| Clock-In Pflicht `activityTypeId` | Master immer; Normal nur bei HOURLY_PACKAGE |
| switch-activity | Gleiche API; Gate wie oben |
| Pause | Segmente laufen weiter (wie Master) |
| Offline | switch-activity online (wie Master); kein neuer Offline-Queue-Zwang |
| Mobile Expo | Optional; Worker-App + Kiosk **Pflicht**; Expo Follow-up wenn Aufwand hoch |
| Rechnung | Unverändert (keine Zeilen aus Tätigkeitsminuten in P3) |
| #30 | Unberührt |

## API / Backend

1. **`assertActivityRequired(worker, project)`** (o. Ä.):
   - Master → immer Tätigkeitspflicht
   - sonst → nur wenn `project.billingMode === 'HOURLY_PACKAGE'`
2. `clockIn`: Pflicht-Check entsprechend; Segment anlegen wenn Pflicht (wie Master).
3. `switchActivity`: Forbidden nur wenn weder Master noch aktuelles Open-Clock-Projekt HOURLY_PACKAGE.
4. Worker-Me / Status: `billingMode` des aktuellen bzw. zuordenbaren Projekts liefern, damit UI den Select zeigt.
   - Mindestens: in Clock-Status / Assignments / `GET /workers/me` die relevanten Projekte mit `billingMode` anreichern (Kiosk Setup-Projekt + Worker-Assignments).
5. Timesheet-Generierung/PDF: **keine Änderung nötig**, wenn Segmente existieren.

## UI

### Worker-App
- Vor Clock-In: Tätigkeits-Select wenn Master **oder** gewähltes Projekt `HOURLY_PACKAGE`
- Eingestempelt: Wechsel-Select wenn Gate greift (disabled in Pause)
- Texte klar: „Tätigkeit (stundenbasiert)“

### Kiosk
- Analog Master-Activity-Select für Normal-Monteure bei HOURLY_PACKAGE Setup-Projekt
- Fehler beim Wechsel sichtbar (nicht still schlucken, wenn bisher still)

### Settings
- Kein neuer Screen; bestehender ActivityType-Katalog reicht

## Akzeptanzkriterien

1. Normal-Monteur + HOURLY_PACKAGE: Clock-In ohne `activityTypeId` → 400.
2. Clock-In mit Tätigkeit → Segment offen; Status `currentActivity`.
3. switch-activity → altes Segment zu, neues offen; GPS ACTION wenn GPS mitgegeben.
4. Clock-Out → Segment zu; Stundenzettel/PDF zeigt Minuten je Tätigkeit.
5. Normal-Monteur + UNIT_BASED / null / MIXED: Clock-In ohne Tätigkeit ok; switch-activity Forbidden.
6. Master auf beliebigem Projekt: unverändert Pflicht + Wechsel.
7. #30 Checkbox-Modal nach Clock-Out weiterhin.
8. Deploy `--env-file .env.production`; kein `down -v`.

## Nicht in Scope

- P4 No-Show, Geofence
- Minuten an ProjectWorkActivity (#30)
- Rechnungszeilen aus Tätigkeitsminuten
- MIXED als Stunden-Gate (bewusst nein)
- Office-Manuell-Editor für Minuten

## Tests

- Unit: Gate Master / HOURLY / sonst
- clockIn Pflicht vs optional
- switchActivity erlaubt/verboten
- Segment-Schließen bei Clock-Out (Regression)
