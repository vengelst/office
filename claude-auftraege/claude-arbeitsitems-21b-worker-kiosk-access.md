# Cloud-Auftrag #21b: Monteur-PIN – Kiosk-Freigabe + Gültigkeitsfenster

## Kontext

Nach #21a. Monteur-Detail hat PIN setzen; Schema `WorkerPin` hat bereits `validFrom` / `validTo`.

## Ziel

Am Monteur neben der PIN:

1. Checkbox **„Kiosk / work.vivahome.de nutzen“** (neues Feld z. B. `Worker.kioskAccessEnabled` Boolean default true, oder am aktiven `WorkerPin`)
2. Optionales **Gültig von / bis** (UI für `validFrom`/`validTo` der aktiven PIN)
3. PIN-Login (`AuthService.pinLogin`): ablehnen wenn Kiosk-Flag aus **oder** außerhalb des Zeitfensters
4. Alte Editoren: Flag aus oder `validTo` setzen → kein Login mehr am Kiosk

## Abnahme

1. Flag aus → PIN-Login fehlschlägt
2. `validTo` in der Vergangenheit → fehlschlägt
3. Gültiges Fenster + Flag an → Login OK
4. Office-UI speichert und zeigt Werte

Commit: `feat(workers): Kiosk-Freigabe und PIN-Gültigkeitsfenster`
