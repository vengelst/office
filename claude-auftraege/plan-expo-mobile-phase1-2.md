# Plan: Expo-Mobile als Monteur-Stempel-App

Stand: 2026-09-08 · Entscheidung: **bestehende Expo-App ausbauen**, keine zweite App.  
Kiosk-Web bleibt für Baustellen-Tablet. Handy = Expo (`apps/mobile`).

---

## Ausgangslage (Ist)

Die App **„VH Kiosk“** (`apps/mobile`) kann bereits:

- PIN-Login gegen Office-API
- Einstempeln / Ausstempeln inkl. GPS
- Projektwahl bei Assignment
- Arbeitsdoku nach Clock-Out (#30)
- Baustellenfotos / Work-Items
- EAS intern: Android-APK → `https://office.vivahome.de/api`

Noch **nicht** (bzw. unvollständig vs. Worker-Web):

- Stundenzettel-Liste + digitale Unterschrift (P2)
- Tätigkeitswechsel mid-day / Pflicht bei HOURLY_PACKAGE (P3)
- Pause start/ende (falls gewünscht)
- Periodischer GPS-Ping wie Web (robuster)
- iOS-Build (aktuell nur `platforms: ["android"]`)
- Geofence / Hintergrund-Standort

---

## Phase 1 – Stempel-Client Parität (jetzt planen / umsetzen)

**Ziel:** Monteure können den Arbeitsalltag zuverlässig **nur mit der Expo-App** erledigen (Android zuerst, iOS optional parallel oder direkt danach).

### 1.1 Funktionsumfang

| Feature | Status | Phase-1-Ziel |
|---------|--------|--------------|
| Clock-In / Out + GPS | da | behalten, UX polieren |
| #30 Arbeitsdoku | da | Regression sicher |
| Fotos | da | behalten |
| Pause Start/Ende | prüfen | wenn API da → UI |
| Tätigkeiten HOURLY / Master (#34) | fehlt mobil | Select + switch-activity |
| Stundenzettel signieren (#33) | fehlt mobil | Liste + Canvas/Sign |
| Stempel-Lock nach Signatur | API da | Fehlermeldung anzeigen |
| Periodischer GPS-Ping | nur Web | in App während Schicht |

### 1.2 Verteilung (intern, ohne Store)

- **Android:** EAS Preview/Production APK (bereits in `eas.json`) – Sideload auf Handys
- **iOS:** später in Phase 1b – Apple Developer + TestFlight oder Ad-hoc (ohne öffentlichen App Store)
- API-URL: Prod `office.vivahome.de` (wie EAS-Profile)

### 1.3 Nicht in Phase 1

- Geofence Auto-In/Out
- Hintergrund-Standort „Immer“
- Polygon-Zaun
- Ersetzen des Web-Kiosks

### 1.4 Akzeptanz Phase 1

1. Monteur stempelt In/Out auf Android-APK gegen Prod.
2. Bei HOURLY_PACKAGE: Tätigkeit wählen/wechseln.
3. Wochenende: Stundenzettel in der App unterschreiben → KW gesperrt.
4. Fotos + Arbeitsdoku weiter nutzbar.
5. Klare Fehlermeldung bei Stempel-Lock / fehlendem GPS.

### 1.5 Grober Aufwand

Ca. **1–2 Cloud-Durchläufe** (UI + API-Anbindung an bestehende Endpoints; wenig Backend-Neubau).

---

## Phase 2 – Geofence (später)

**Ziel:** Auf dem Handy: Bereich betreten → Zeiten starten, verlassen → stoppen (wo fachlich erlaubt).

### 2.1 Voraussetzungen

- Phase 1 stabil in Nutzung
- Org-Feature-Flag + Projekt-Schalter (Modul verkaufbar)
- Projekt Lat/Lng + Radius (Kreis zuerst)
- Background Location in Expo (iOS/Android Permissions)

### 2.2 Inhalt (Skizze)

1. Projekt: `geofenceEnabled`, `geofenceRadiusM`, Modus (Warn / Auto-Out / Auto-In+Out)
2. App: Region registrieren für zugewiesene Projekte; Enter/Exit → API
3. Server: Events validieren (Assignment, Stempel-Lock, Hysterese), System-Clock wie P1
4. Soft-Mode optional zuerst (nur Warnung)

### 2.3 Nicht in Phase 2 v1

- Polygon-Editor (Phase 2b / D)
- Kiosk-Geofence

---

## Reihenfolge

```text
Phase 1a  Android-App Parität (Stempel, Tätigkeiten, Signatur, GPS-Ping)
    ↓
Phase 1b  iOS-Build intern (wenn Geräte da)
    ↓
Phase 2   Geofence-Modul (Flag + Radius + Auto-In/Out)
```

Web-Kiosk und Worker-PWA bleiben parallel; Handy wird zum **primären** Feld-Client.

---

## Nächster Schritt

Cloud-Auftrag **#36 Phase 1 Expo Stempel-Parität** – Spec: `claude-arbeitsitems-36-expo-phase1-stempel.md`
