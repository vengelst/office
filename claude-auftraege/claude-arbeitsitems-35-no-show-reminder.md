# Cloud-Auftrag #35: No-Show-Reminder – nie eingestempelt (P4)

## Kontext

P1–P3 sind Prod. **P4:** Admin wird informiert, wenn zugewiesene Monteure bis zu einer konfigurierbaren Uhrzeit **noch keinen Clock-In** am Tag haben.

Vorbilder:
- Overtime-Alert: Mail an `overtime_alert_email`, Settings → Allgemein, Test/Run
- Auto-Clock-Out: explizites Enabled-Flag (Default aus)
- Backup: Check gegen `scheduleHour`/`scheduleMinute` in **Europe/Berlin**

## User-Defaults (2026-09-08, falls nicht anders spezifiziert)

| Thema | Wert |
|--------|------|
| Check-Zeit | **10:00** Europe/Berlin (in Settings änderbar) |
| Wochentage | **Mo–Fr** (Sa/So überspringen) |
| Empfänger | dieselbe Mail wie Arbeitszeit-Alarm (`overtime_alert_email`) |
| Default | **aus** |

## Ziel

1. Settings → Allgemein: Toggle + Uhrzeit (Stunde:Minute).
2. Cron: nach Erreichen der Uhrzeit (Berlin) einmal prüfen; No-Shows per E-Mail.
3. Dedup: höchstens **1 Mail-Inhalt pro Worker pro Berlin-Tag** (eine Sammelmail oder eine Mail mit Liste).
4. Manuell: „Jetzt prüfen“ + optional Test-Hinweis.

## Produktentscheidungen

| Thema | Entscheidung |
|--------|----------------|
| Enabled | `no_show_alert_enabled` Default **false** |
| Uhrzeit | `no_show_alert_hour` (0–23, Default **10**), `no_show_alert_minute` (0–59, Default **0**) |
| Empfänger | `overtime_alert_email` – ohne gültige Mail → kein Versand (Enabled allein reicht nicht) |
| Soll-Liste | `ProjectAssignment` aktiv + Datumsfenster enthält heute (Berlin) + Worker `active`/`deletedAt` null + Projekt `status === ACTIVE` / `deletedAt` null |
| Availability | Worker mit aktueller Availability `SICK` / `VACATION` / `UNAVAILABLE` **ausschließen** (wenn Feld am Worker verfügbar; sonst weglassen und im PR dokumentieren) |
| Master ohne Assignment | **nicht** in Soll-Liste |
| „Eingestempelt“ | mind. ein `TimeEntry` `CLOCK_IN` mit `occurredAtClient` im Berlin-Tagesfenster |
| Wochenende | Sa/So (Berlin) → Cron überspringt (außer manuelles „Jetzt prüfen“: trotzdem prüfen, Hinweis im Result) |
| Feiertage | **kein** Kalender in P4 |
| Mail-Format | Eine Mail mit Tabelle: Monteur, Worker-Nr., Projekt(e), Zuweisung – Betreff z. B. „Keine Einstempelung – TT.MM.JJJJ“ |
| Dedup | AppSetting-Map `no_show_alert_sent`: Key `workerId|YYYY-MM-DD` oder Tages-Key `YYYY-MM-DD` mit Liste bereits gemeldeter Worker; nach Speichern der Settings Dedup optional resetten (wie Overtime) |
| Cron | jede Minute (wie Backup) oder alle 5 Min: wenn Enabled und Berlin-Zeit ≥ Hour:Minute und Tag noch nicht „gelaufen“ → check; Flag „für diesen Berlin-Tag bereits gelaufen“ setzen |
| Manuell Run | `POST /kiosk-settings/no-show-alert/run` – prüft auch am Wochenende; Force-Resend optional |

## Settings Keys

```text
no_show_alert_enabled   // "true"|"false", default false
no_show_alert_hour      // "10"
no_show_alert_minute    // "0"
no_show_alert_sent      // JSON Dedup-State
```

Parser analog overtime/auto-clock-out. General GET/PUT + UI erweitern.

## UI

Settings → Allgemein, Block nach Auto-Ausstempelung:

- Toggle „Erinnerung: nicht eingestempelt“
- Zeitfelder Stunde / Minute (Europe/Berlin)
- Hinweis: Empfänger = Arbeitszeit-Alarm; ohne E-Mail kein Versand; Mo–Fr
- Buttons: Test nicht zwingend nötig (Overtime-Test reicht SMTP); **Jetzt prüfen** Pflicht

Texte in `settings.ts`.

## API

- Service `NoShowAlertService` mit Cron + `checkAndNotify({ force?: boolean })`
- Controller unter kiosk-settings oder time-entries analog Overtime
- Rollen: OFFICE/SUPERADMIN (wie andere Alarm-Runs)

## Akzeptanzkriterien

1. Enabled aus → kein Mail, auch nach Uhrzeit.
2. Enabled + Mail + Mo 10:00: Worker mit Assignment ACTIVE-Projekt, kein CLOCK_IN heute → erscheint in Mail.
3. Worker mit CLOCK_IN heute → nicht in Liste.
4. Sa/So automatisch: kein Cron-Versand.
5. Zweiter Cron am selben Tag: keine Doppel-Mail (Dedup).
6. „Jetzt prüfen“ liefert Zähler checked/missing/sent.
7. Deploy `--env-file .env.production`; kein `down -v`.

## Nicht in Scope

- Feiertagskalender, Geofence, zweite Tagesprüfung, SMS/Push
- Separates Empfänger-Feld
- Erwartung für Master ohne Assignment

## Tests

- Unit: Wochenende skip; Dedup; Filter Assignment/ACTIVE/kein Clock-In
- Parser Hour/Minute Bounds
