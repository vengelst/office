# Claude Code – Auftrag #3: Monteur-App Arbeitsitems

## Kontext

Repo: Office-Monorepo. Aufträge #1 (API) und #2 (Web Büro) sind live.

**Spez (verbindlich):** `SPEZ-arbeitsitems.md` Abschnitte 4.1, 5, 6, 8.2  
**API:** `apps/api/src/work-items/README.md` + `worker-work-items.controller.ts`  
**Mobile App:** Expo Router unter `apps/mobile/` (dunkles Theme, PIN-Login, Stempel-Dashboard in `app/(app)/index.tsx`)

Dieser Auftrag: **Monteur kann Items in der App abarbeiten**. Sorgfältig, regressiv-sicher für bestehende Stempel-Funktion.

---

## Ziel-Flow (exakt)

1. Monteur stempelt Projekt ein (bestehend).
2. Wenn Projekt `itemBased`: Bereich/Screen „Arbeitsitems“ sichtbar.
3. Liste: eigene offenen Items + Pool (`OPEN`); Suche nach **Kennung** (`itemKey`).
4. Item **nehmen** (`claim`) → `IN_PROGRESS`.
5. Item als **aktuell** setzen (`sessions/start`) – nur sinnvoll wenn clocked-in; sonst klarer Hinweis „Erst einstempeln“.
6. Detail: Metadaten, Material DE+SK, Arbeitsumfang DE+SK, PDF öffnen wenn verfügbar.
7. **Fertig**: mind. **2 Fotos** (besser 2–3), Kamera/Galerie wie bestehender Photo-Upload → `reports/complete`.
8. **Nacharbeit**: optional Fotos + Bemerkung → `reports/rework`; Item bleibt beim Monteur.
9. Feierabend / Clock-Out: bestehend (API schließt Sessions bereits). Am nächsten Tag: eigene `IN_PROGRESS`/`REWORK` weiter sichtbar.

UI-Labels **DE + SK** (wie auf der TAS-Karte).

---

## 1. Kleine API-Erweiterung (erlaubt, minimal)

In `WorkerAuthService.me` bei `project.select` ergänzen:

- `itemBased: true`

Damit die App ohne Extra-Call erkennt, ob Items-UI für das gestempelte/gewählte Projekt aktiv ist.

Optional (nur wenn nötig für PDF-Anzeige): in Worker-Item-Detail sicherstellen, dass Block-PDF-Download-URL oder `pdfDocumentId` + Download-Endpoint nutzbar ist (bestehende Documents-Download-Routen prüfen). Keine großen API-Umbauten.

---

## 2. Mobile API-Client

`apps/mobile/lib/api.ts` erweitern (oder `lib/work-items.ts`):

- `GET /workers/me/work-items?projectId=`
- `GET /workers/me/work-items/:id`
- `POST /work-items/:id/claim`
- `POST /work-items/:id/sessions/start|stop`
- `POST /work-items/:id/reports/complete` – multipart Feld `photos` (min 2)
- `POST /work-items/:id/reports/rework` – multipart optional + comment

`WorkerMeAssignment.project` um `itemBased?: boolean` erweitern.

Multipart analog zu `uploadPhoto` (Authorization Bearer, kein JSON Content-Type).

---

## 3. Navigation / Screens

Expo Router, dunkles Theme beibehalten (`#030712` etc.).

### 3.1 Dashboard-Integration (`app/(app)/index.tsx`)

- Wenn clocked-in **und** aktives Projekt `itemBased === true`: prominenter Button/Card  
  **„Arbeitsitems / Pracovné položky“** → navigiert zu Items-Screen mit `projectId`.
- Wenn nicht itemBased: unverändert nur Stempel-UI.
- Keine Stempel-Logik entfernen oder umbauen außer klarer Einstieg.

### 3.2 Items-Liste – neue Route z. B. `app/(app)/work-items/index.tsx`

Query: `projectId` Pflicht.

Anzeige:
- Laufende Session / aktuelles Item hervorgehoben
- Sektionen: **Meine** (IN_PROGRESS, REWORK, ggf. REVIEW wenn noch relevant) und **Offen** (OPEN Pool)
- Suche nach Kennung
- Status-Badges DE+SK Kurzlabels
- Tap → Detail

Pull-to-refresh.

### 3.3 Item-Detail – z. B. `app/(app)/work-items/[id].tsx`

- Kopf: itemKey, title, Status, Ort (floor/area/room), Typ/RC
- Arbeitsumfang DE + SK
- Materialtabelle (qty, unit, DE, SK)
- PDF-Button wenn Block-PDF / Dokument verfügbar (WebView oder Linking.openURL auf signierte/download URL)
- Aktionen:
  - **Nehmen** wenn OPEN und noch nicht assigned
  - **Als aktuell setzen** (`sessions/start`) wenn assigned und clocked-in; wenn nicht clocked-in → Alert
  - **Fertig** → Foto-Flow (min 2, UI fordert 2–3)
  - **Nacharbeit** → Kommentar + optional Fotos
- Nach erfolgreicher Meldung: zurück zur Liste / Refresh

### 3.4 i18n DE+SK

Kleine Text-Map `apps/mobile/lib/i18n-work-items.ts` (oder inline Konstanten):

Jeder sichtbare Button/Label zweisprachig, z. B.:
- „Fertig / Hotovo“
- „Nacharbeit / Dodatočná práca“ (oder passendes SK aus SPEZ-Karte: Nacharbeit-Kontext)
- „Nehmen / Prevziať“
- „Aktuell / Aktuálne“
- Status: Offen/Otvorené, In Arbeit/Prebieha, Kontrolle/Kontrola, Nacharbeit/…, Geprüft/Schválené

Kein schweres i18n-Framework nötig.

---

## 4. Foto-Flow Fertigmeldung

- Bestehende ImagePicker-Nutzung aus Dashboard wiederverwenden
- Mindestens 2 Fotos erzwingen (Button disabled + Alert)
- Ideal: UI-Text „mindestens 2–3 Fotos“
- Upload als `photos` Multipart ans complete-Endpoint
- Fehler der API (400 bei <2) verständlich anzeigen

---

## 5. Regeln / Guards in der UI

| Situation | Verhalten |
|---|---|
| Nicht clocked-in, Session starten | Alert: erst einstempeln |
| Clock-Out | Bestehend; Session-Close macht API |
| Item REWORK | Weiter bei Monteur; „Als aktuell“ + später erneut fertig möglich |
| Item REVIEW nach eigener Fertigmeldung | Read-only Hinweis „wartet auf Kontrolle“ |
| Mehrere Monteure | UI muss nichts Spezielles; API Variante B |

---

## 6. Explizit NICHT

- Kein Web-Büro umbauen
- Keine Kunden-PL-Screens
- Kein neues Design-System / helle Theme-Umschaltung
- Kein Offline-Queue (außer trivialer Fehlerhinweis)
- Kein EAS-Build/APK in diesem Auftrag (Code + ggf. Hinweis reicht)
- Keine großen Refactors am Stempel-Screen

---

## 7. Qualität

- TypeScript strict, an bestehenden Mobile-Stil anlehnen
- Touch-Ziele groß (wie bestehendes Dashboard)
- `npx tsc --noEmit` im mobile-Paket soweit üblich / keine neuen TS-Fehler
- Kurz testen: API-Typen matchen Response-Shapes aus `findForWorker` / `findOneForWorker` (Services lesen!)

---

## 8. Abnahme

- [ ] itemBased-Projekt: Einstieg von Dashboard sichtbar
- [ ] Nicht-itemBased: kein Items-Einstieg
- [ ] Liste + Suche Kennung
- [ ] Claim / Session start-stop
- [ ] Detail Material + DE/SK
- [ ] Complete mit <2 Fotos blockiert; ≥2 geht
- [ ] Rework funktioniert
- [ ] Stempel In/Out unverändert nutzbar
- [ ] `itemBased` kommt in `/worker-auth/me`

---

## 9. Commit

`feat(mobile): Arbeitsitems für Monteure (nehmen, Session, Fertig/Nacharbeit)`

Auch `claude-auftraege/claude-arbeitsitems-03-mobile.md` committen.  
Kein git push.

Ende Auftrag #3.
