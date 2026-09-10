# Cloud-Auftrag #38: Phase 2 – Android-Live + Pflicht-Foto-Stempel

**Status:** bereit zur Umsetzung · **Datum:** 2026-09-10  
**Voraussetzung:** #37 Phase 1 auf `main`/Prod (`f22c503`)  
**Auftraggeber:** Cursor-Session · Prüfung nach Cloud-Lauf in Cursor

---

## 1. Ziel

Zwei Lieferungen in **einem** Auftrag:

| # | Thema | Kurz |
|---|--------|------|
| **A** | Live-Anwesenheit Android | Monteure sehen in der App „Wer arbeitet jetzt?“ (gleiche scoped API wie Web) |
| **B** | Pflicht-Stempel auf Baustellenfotos | **Jedes** SITE_PHOTO bekommt dauerhaft **Datum + Uhrzeit**; **Ort**, wenn GPS vorliegt |

Web-Kiosk Hard-Delete bleibt **Phase 3** (nicht dieses Ticket).

---

## 2. Teil A – Live-Anwesenheit in Android

### Ist
- API: `GET /time-entries/live/scoped?projectId=` (Rollen `WORKER`, `CUSTOMER_PL`)
- Web: `LivePresenceList` im Worker-Dashboard und `/pl`
- Android: API **noch nicht** angebunden

### Soll
1. Android (`apps/mobile`) konsumiert `GET /time-entries/live/scoped` (optional `projectId` = aktuelles/gewähltes Projekt).
2. UI auf dem Home/Dashboard (analog Web): Titel z. B. „Wer arbeitet jetzt?“, Liste Name / Projekt / seit wann / Tätigkeit falls vorhanden, Leerzustand, Fehlerzustand, Pull-to-Refresh oder periodischer Refresh (z. B. 30–60 s solange Screen sichtbar).
3. Nur anzeigen wenn Worker eingeloggt; Scope bleibt serverseitig (kein Client-Trust).
4. Texte i18n wie bestehende Mobile-Texte (DE mindestens; SK/SL wenn das Modul dort schon Texte führt).
5. **CUSTOMER_PL in Android:** nicht Pflicht in #38 (Web `/pl` reicht); optional weglassen.

### Akzeptanz A
- [ ] Eingeloggter Monteur sieht Live-Liste (oder Leerzustand „Niemand eingestempelt“).
- [ ] Zweiter Monteur stempelt ein → erscheint nach Refresh (ohne App-Neustart, wenn Refresh existiert).
- [ ] Unzugeordnetes Projekt: Server liefert leer/403; App crasht nicht.
- [ ] Unit/Smoke soweit sinnvoll; manuelle Checkliste im PR.

---

## 3. Teil B – Pflicht-Foto-Stempel (Datum / Uhrzeit / Ort)

### Ist
- Server: `burnCommentIntoImage` / `photo-overlay.ts` brennt **optionalen** Nutzerkommentar ein.
- Upload: `comment`, `commentX/Y`, optional `latitude`/`longitude` (Mobile sendet GPS schon oft mit).
- Stempel Datum/Uhrzeit/Ort ist **nicht** automatisch.

### Soll (verbindlich)
Bei **jedem** Baustellenfoto-Upload (`DocumentType.SITE_PHOTO` / bestehender Upload-Pfad in `time-entries` uploadPhoto und allen anderen SITE_PHOTO-Uploads derselben Pipeline):

1. **Immer** in die Bildpixel einbrennen (nicht nur Metadaten):
   - **Datum + Uhrzeit** in Zeitzone **Europe/Berlin**  
     Format z. B. `10.09.2026 22:15` (führende Nullen, 24h).
2. **Ort, wenn möglich:**
   - Wenn `latitude` + `longitude` am Upload vorhanden und endlich: zweite Zeile z. B. `48.137154, 11.575382` (6 Nachkommastellen) **oder** kompakt `48.1372°N 11.5754°E`.
   - **Kein** Reverse-Geocoding in #38 (kein Nominatim/Google) – Koordinaten reichen.
   - Fehlt GPS: nur Datum/Uhrzeit; Upload **nicht** ablehnen.
3. Optionaler Nutzerkommentar bleibt:
   - Stempel-Block (Datum/Zeit/Ort) **immer**.
   - Kommentar zusätzlich (bestehende Position `commentX/Y` oder Banner-Logik beibehalten, klar lesbar, kein Überdecken des Stempels wenn machbar – Stempel bevorzugt **unten** oder **oben** als fester Balken).
4. **Eine** zentrale Server-Stelle (bevorzugt in/neben `burnCommentIntoImage` bzw. Upload-Service), damit Web-Kiosk-Rest, Worker-Web und Android **gleich** behandeln.
5. Zeitbasis: Serverzeit beim Verarbeiten **oder** Client-`occurredAt`/`capturedAt` falls bereits im DTO – dokumentieren; Default: **Serverzeit Europe/Berlin**.
6. Bestehende Kontrast-/Font-Logik (DejaVu, Luminanz) wiederverwenden.

### Nicht in Scope B
- Reverse-Geocoding / Adresszeile
- Video-Stempel
- Alte Fotos nachträglich neu stempeln (Batch-Migration)
- EXIF-only ohne Pixel-Burn-in (Pixel sind Pflicht für Weitergabe/PDF)

### Akzeptanz B
- [ ] Foto **ohne** Kommentar → Bild enthält sichtbar Datum+Uhrzeit.
- [ ] Foto **mit** GPS → zusätzlich Koordinatenzeile.
- [ ] Foto **ohne** GPS → nur Datum+Uhrzeit, Upload 200.
- [ ] Foto **mit** Kommentar → Stempel + Kommentar beide sichtbar.
- [ ] Web- und Android-Upload-Pfade abgedeckt (gleiche Server-Pipeline).
- [ ] Unit-Test(s) für Stempel-Textbau / „immer brennen auch ohne comment“.
- [ ] Manuell: hochgeladenes JPEG öffnen, Stempel lesbar.

### Version / APK
- Mobile `version` / `versionCode` erhöhen (z. B. **1.3.2 / 1302**), damit Feldgeräte das Live-UI + ggf. GPS-Mitnahme bekommen.
- EAS Production-APK bauen **oder** im PR klar sagen „APK Follow-up in Cursor“ – wenn Cloud EAS kann: bauen und Artefakt-URL nennen; Publish auf Server nur wenn Credentials/Script vorhanden, sonst Cursor übernimmt Publish.

---

## 4. Explizit nicht

- Phase 3 Kiosk Hard-Delete
- iOS
- PL-App nativ Android
- Geofence
- Änderung am Activity-Gate (HOURLY/MIXED)

---

## 5. Technische Leitplanken

- Branch von aktuellem `main`: `feat/38-android-live-foto-stempel`
- Deploy-Regeln: kein `down -v`; `--env-file .env.production`
- Texte DE; bestehende i18n-Muster Mobile
- Keine Secrets committen
- PR gegen `main` mit Testplan; kurze Notiz was offen bleibt

---

## 6. Lieferobjekt Cloud-Agent

1. Teil A + B implementiert
2. Tests grün (mind. Overlay/Stempel + ggf. Live-Client-Smoke)
3. PR-URL + Zusammenfassung
4. Version-Bump Mobile dokumentiert; APK-Status (gebaut / Follow-up)
5. Stopp – kein Phase-3-Vorgriff

---

## 7. Referenzen

- Spec #37 Phase 1: `claude-arbeitsitems-37-personal-app-statt-kiosk.md`
- Notizen/Checkliste: `claude-arbeitsitems-37-notizen.md`
- Overlay: `apps/api/src/time-entries/photo-overlay.ts`
- Upload: `time-entries.service.ts` → `uploadPhoto`
- Mobile Upload: `apps/mobile/lib/upload-site-photo.ts`
