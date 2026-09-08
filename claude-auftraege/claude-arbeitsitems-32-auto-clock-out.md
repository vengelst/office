# Cloud-Auftrag #32: Auto-Clock-Out nach Maximaldauer (P1 Zeiterfassung)

## Kontext

Offene Schichten ohne Ausstempeln können theoretisch über Tage laufen. Heute gibt es nur den **Arbeitszeit-Alarm** (E-Mail ab Schwelle, Default 10 h) – **kein** automatisches Beenden.

**Neu:** Konfigurierbarer **Auto-Clock-Out**: nach X Stunden durchgehend eingestempelt wird die Schicht systemseitig beendet.

Roadmap (nur zur Einordnung, **dieser Auftrag = nur P1**):
- P1 Auto-Clock-Out ← **dieser Auftrag**
- P2 Monteur signiert Stundenzettel mobil (schließt Woche für weitere Stunden)
- P3 Stunden-Tätigkeiten mid-day für Normal-Monteure (stundenbasierte Projekte)
- P4 Reminder „nie eingestempelt“
- später: Geofence

## Ziel

1. Einstellungen → Allgemein: Auto-Clock-Out **ein/aus** + **Stunden** (nach wie vielen Stunden).
2. Cron schließt offene Schichten, die die Schwelle überschreiten.
3. Gebuchte Zeit endet an der Schwelle (keine „durchlaufende Uhr“).
4. Admin wird per E-Mail informiert (bestehende Alarm-Adresse).
5. Arbeitsdoku (#30) bleibt ausstehend bis der Monteur sie nachholt.
6. In Stempeluhr/Live klar als System-Ausstempelung erkennbar.

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Einstellung | Toggle `autoClockOutEnabled` + Zahl `autoClockOutHours` |
| Ort UI | Einstellungen → **Allgemein**, Block unter/neben Arbeitszeit-Alarm |
| Default | **Aus** (`enabled=false`); Stunden-Default **12** (1–24) |
| Bezug Alarm | **Getrennt** von `overtime_alert_hours`. Hinweis in UI: Alarm typischerweise früher als Auto-Out |
| Zeitstempel CLOCK_OUT | `occurredAtClient = CLOCK_IN.occurredAtClient + autoClockOutHours` (nicht „jetzt“) |
| Pause offen | wie normales Clock-Out: Pause zuerst schließen |
| Master-Segmente / Item-Sessions | wie normales Clock-Out schließen |
| Arbeitsdoku #30 | `workDocumentedAt = null` → Pending bleibt; beim nächsten App-/Kiosk-Besuch Modal |
| Erkennung System | `sourceDevice = "SYSTEM_AUTO_CLOCK_OUT"` + `comment` mit klarer DE-Meldung |
| `createdByUserId` | `null` |
| E-Mail | an `overtime_alert_email` (wenn gesetzt); Betreff/Body: Auto-Ausstempelung inkl. Monteur, Projekt, In/Out, Dauer |
| Ohne E-Mail | Auto-Out **trotzdem** ausführen (Logging); Mail optional |
| Cron | alle 5 Min (gleicher Rhythmus wie OvertimeAlert) |
| Idempotenz | nur wenn letzter Clock-Event = CLOCK_IN und Dauer ≥ Schwelle |
| Manuelle Korrektur | unverändert möglich (Stempeluhr), solange Stundenzettel nicht gelockt |

## Nicht in Scope

- Geofence, P2 Signatur, P3 Tätigkeitsminuten, P4 No-Show-Reminder
- Änderung der Overtime-Alarm-Logik (bleibt; kann vor Auto-Out weiter mailen)
- Hard Rule „1 Projekt/Tag“

## Settings (AppSettings Keys)

```text
auto_clock_out_enabled   // "true" | "false", Default false
auto_clock_out_hours     // Integer 1–24, Default 12
```

Parser analog `overtime-alert.ts` (eigene kleine Hilfsdatei oder Erweiterung).

API/Web: bestehende Kiosk-/General-Settings-GET/PATCH um die zwei Felder erweitern (`apps/web/src/lib/kiosk-settings.ts`, General-Page, API-Controller/Service für Settings).

## Implementierung

### Backend

1. `AutoClockOutService` (oder Erweiterung `OvertimeAlertService` mit klar getrennten Methoden):
   - Cron `EVERY_5_MINUTES`
   - Wenn `enabled=false` → return
   - Offene CLOCK_IN finden (gleiche Logik wie Overtime: letzter Clock-Event pro Worker)
   - Wenn `now - clockIn >= hours` → System-Clock-Out
2. Intern **eine** geschützte Methode nutzen, die denselben Schließpfad wie `TimeEntriesService.clockOut` abbildet (Pause, Segmente, Items, CLOCK_OUT anlegen) – **ohne** Actor-/PIN-Check; Aufruf nur aus dem Cron.
   - Nicht den öffentlichen Worker-Endpoint mit Fake-User missbrauchen.
   - `occurredAtClient` = clockIn + hours (clamp falls Clock-In in Zukunft – Edge-Case skip/log).
3. Nach erfolgreichem Auto-Out: optional Mail; Dedup pro TimeEntry-Id (einmal pro Auto-Out reicht; eigener Sent-Map-Key oder Flag reicht, weil Schicht danach geschlossen ist).
4. Manueller Trigger für Admin optional: `POST /kiosk-settings/auto-clock-out/run` (wie Overtime `run`) – hilfreich zum Testen.

### Frontend

- General Settings: Toggle + Number-Input „Nach wie vielen Stunden automatisch ausstempeln?“
- Texte DE (ggf. bestehende texts-Dateien)
- Stempeluhr / Live / Period: System-Ausstempelungen erkennbar (Comment/`sourceDevice` anzeigen oder Badge „Auto“)

### Tests

- Unit/Integration: enabled=false → kein Out
- Offene Schicht 13 h, Schwelle 12 → CLOCK_OUT bei clockIn+12h
- Offene Pause wird geschlossen
- workDocumentedAt bleibt null
- sourceDevice gesetzt

## Akzeptanzkriterien

1. Settings speichern/laden Auto-Out Enable + Stunden (1–24).
2. Bei Enable und Überschreitung: Schicht wird beendet; Dauer ≈ konfigurierte Stunden (nicht „jetzt − In“ über die Schwelle hinaus).
3. Live/Stempeluhr zeigt den Out mit System-Hinweis.
4. Overtime-Alarm funktioniert weiter unabhängig.
5. Pending Arbeitsdoku nach Auto-Out vorhanden.
6. Deploy-fähig: Migration falls Schema-Felder nötig (v1 reicht `sourceDevice`/`comment` ohne Schema-Änderung, **außer** ihr ergänzt optional `autoClosed Boolean` – dann Migration; Prefer **ohne** neues Feld wenn Comment+sourceDevice genügen).

## Hinweis Deploy

Immer `docker compose … --env-file .env.production`. Kein `down -v`.
