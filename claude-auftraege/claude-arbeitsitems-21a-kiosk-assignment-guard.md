# Cloud-Auftrag #21a: Kiosk – Clock-In nur bei gültiger Projektzuweisung

## Kontext

Repo: Office (`apps/api`), Produktion `office.vivahome.de` / `work.vivahome.de`.

**Problem:** Am Kiosk-Terminal kann theoretisch eingestempelt werden, ohne dass der Monteur dem Kiosk-Projekt zugewiesen ist. Die UI prüft teilweise, die API `clockIn` prüft die Zuweisung **nicht hart**.

## Ziel

1. `TimeEntriesService.clockIn` (und analog sinnvoll clockOut falls nötig): Monteur muss **aktive** `ProjectAssignment` für `dto.projectId` haben.
2. Zusätzlich Datumsfenster: `startDate <= heute` und (`endDate` null oder `>= heute`), `active === true`.
3. Sonst `ForbiddenException` mit klarer DE-Meldung (z. B. „Keine gültige Projektzuweisung“).
4. Kiosk-UI: Stempel-Button disabled + Hinweis, wenn keine gültige Zuweisung (wie worker-app „zukünftig“).

## Nicht-Ziele

- PIN-Zeitfenster / Kiosk-Freigabe-Flag (Auftrag #21b)
- Foto-Kommentar (Auftrag #21c)

## Abnahme

1. Monteur ohne Zuweisung zum Kiosk-Projekt → Clock-In API 403, UI blockiert
2. Zuweisung mit `startDate` in der Zukunft → blockiert
3. Gültige Zuweisung → Clock-In wie bisher
4. `tsc`/Build grün

Commit: `fix(time-entries): Clock-In nur mit gültiger Projektzuweisung`
