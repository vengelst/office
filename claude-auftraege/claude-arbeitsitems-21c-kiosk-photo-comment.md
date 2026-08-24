# Cloud-Auftrag #21c: Kiosk-Baustellenfoto mit Kommentar im Bild

## Kontext

Nach #21a/#21b. Kiosk Terminal: Foto nach Clock-In. API `upload-photo` kennt optional `comment` nur als Dokument-Metadaten – **nicht** im Pixelbild. Kiosk-UI sendet keinen Kommentar.

## Ziel

1. Kiosk (Terminal + ggf. worker-app paritätisch): nach Foto-Wahl **Kommentarfeld** (z. B. Positionsnummer)
2. API: Kommentar **in das Bild einbrennen** (unten oder Banner, lesbar, DE-Zeichensatz), dann speichern
3. Weiterhin `title`/`description` = Kommentar-Text
4. Ohne Kommentar: Upload wie bisher ohne Overlay

## Technik-Hinweis

Server-seitig z. B. `sharp` (bereits prüfen ob in API) oder `canvas` – Text mit Schatten/Hintergrund für Lesbarkeit.

## Abnahme

1. Mit Kommentar → gespeichertes Bild zeigt den Text
2. Ohne Kommentar → unverändertes Bild
3. Dokument-Titel enthält Kommentar
4. Build grün

Commit: `feat(kiosk): Baustellenfoto mit eingebranntem Kommentar`
