# Cloud-Auftrag #37: Personal-App statt Baustellen-Kiosk

**Status:** bereit zur Umsetzung · **Datum:** 2026-09-10  
**Auftraggeber:** Cursor-Session (Volkhard) · Prüfung nach Cloud-Lauf in Cursor

---

## 1. Produktentscheidung (verbindlich)

Es gibt **kein festes Baustellen-Tablet** mehr als Primärweg.

Alles läuft über **persönliche Geräte** (Handy):

| Rolle | Gerät | Login | Kernfunktionen |
|-------|--------|--------|----------------|
| **Monteur** | eigenes Handy | Worker-PIN | Projekt aus **eigener Zuweisung**, Stempeln, Tätigkeit, Fotos, Work-Items, Wochen-Stundenzettel **selbst gegenzeichnen** |
| **Projektleiter / Kunden-PL** | eigenes Handy | User-PIN (oder bestehender PL-Login) | Projekt aus **Zuordnung**, Stundenzettel der Monteure sehen und **abzeichnen**, **Live: wer arbeitet** |
| **Kunde** (falls getrennt vom PL) | eigenes Handy | User-PIN Rolle `CUSTOMER_PL` | Projekt aus Zuordnung, **unterschreiben / abzeichnen** ohne Kiosk-Setup |

**Konsequenz:** Der Web-Kiosk (`/kiosk`, `work.vivahome.de` als Geräte-Terminal mit Setup + Multi-User + Auto-Logout) ist **nicht mehr Primärprodukt**. Er wird **weich abgekündigt** und später entfernt.

**Ziel-Oberflächen (nur noch diese):**

1. **Web-Worker / Personal-App** (Browser/PWA) – eine Oberfläche für Monteur + PL/Kunde (rollenabhängig)
2. **Android-App** (`apps/mobile`) – gleiche fachliche Parität wie die Web-Personal-App für Monteure (PL/Kunde Web-first, Android Follow-up wenn Aufwand gering)

Web-Kiosk und Worker-App werden **nicht** zu einer Conditional-Spaghetti-App verschmolzen. Stattdessen: **Kiosk-Funktionen, die noch gebraucht werden, wandern in die Personal-App**; das Geräte-Terminal stirbt.

---

## 2. Ist-Stand (kurz)

| Baustein | Heute |
|----------|--------|
| Worker-Web `/worker-app` | Persönliche Monteur-Session, Stempeln, Timesheets+Signatur (#33), Work-Items |
| Android `apps/mobile` | Fachlich nah an Worker-Web; eigene RN-UI; APK-Update |
| Web-Kiosk `/kiosk` | Gerätebindung an ein Projekt, Multi-User-PIN, Auto-Logout, Live am Terminal, Kunden-PL-Modus |
| Kunden-PL `/pl` | Item-Board + Timesheet-Approve (E-Mail/Passwort; PIN über Kiosk `user-pin-login`) |
| Live-Anwesenheit | Office `/time-clock/live` (Desktop) – **nicht** in Worker-App |

---

## 3. Rollen-Mapping (für Implementierung)

| User-Sprache | Technische Rolle | Auth |
|--------------|------------------|------|
| Monteur | `WORKER` / Worker-JWT | `POST` Worker-PIN (bestehend) |
| Projektleiter (Stundenzettel abzeichnen, Live) | **`CUSTOMER_PL`** (bestehende PL-Zuordnung am Projekt) | User-PIN `POST /auth/user-pin-login` **oder** bestehender Session-Login → `/pl` |
| Internes Büro / PM | `PROJECT_MANAGER` / `OFFICE` | unverändert Office-Web; **nicht** Gegenstand dieses Auftrags außer Leserechten Live |

Wenn später ein **interner** Vorarbeiter auf dem Handy Live sehen soll: Follow-up (nicht Phase 1), Rolle klar trennen.

---

## 4. Phasen

### Phase 1 – Personal-App-Kern (DIESE Cloud-Umsetzung)

**Ziel:** Primärweg ohne Kiosk-Tablet; fehlende Personal-App-Features nachziehen; Kiosk weich abkündigen.

#### 1.1 Live-Anwesenheit in der Personal-App (Web)

- In **Worker-Web** (`/worker-app/...`): Ansicht „Wer arbeitet jetzt?“ für Projekte, denen der Monteur **zugewiesen** ist (oder aktuelles/gewähltes Projekt).
- Datenquelle: bestehende Live-/Open-Clock-API wiederverwenden oder schmalen Worker-scoped Endpoint ergänzen (nur zugewiesene Projekte, keine Büro-weiten Daten).
- Für **CUSTOMER_PL** unter `/pl`: gleiche Live-Info für **zugeordnete** Projekte (Reuse-Komponente wenn möglich).
- UI: touch-tauglich, Liste Name / Projekt / seit wann / Tätigkeit falls vorhanden.

#### 1.2 Kunden-PL / Abzeichnung ohne Kiosk-Setup

- Sicherstellen: `CUSTOMER_PL` kann sich **ohne** `/kiosk/setup` am Handy anmelden und:
  - zugeordnete Projekte sehen
  - Stundenzettel der Monteure sehen und **approve** (Status `WORKER_SIGNED` / `SUBMITTED` wie #33)
  - optional Item-Board wie `/pl` (bereits vorhanden) – mobil nutzbar machen (Viewport, große Tap-Targets)
- User-PIN-Login für CUSTOMER_PL: Einstieg von einer **mobilen Login-Seite** (Worker-App-Login oder `/pl/login` / gemeinsamer PIN-Entry), **nicht** über Kiosk-Gerätebindung.
- Bestehende API `user-pin-login` nutzen; keine zweite Auth erfinden.

#### 1.3 Monteur-Parität Web ↔ Hinweis Android

- Checkliste in PR/Notizen: Features Worker-Web vs Android (Stempeln, Tätigkeit inkl. MIXED/#37-Gate schon Prod, Timesheet-Signatur, Work-Items, Live neu).
- **Live-Anwesenheit in Android:** wenn Aufwand gering in Phase 1 mitziehen; sonst klar als **Phase 2** markieren und API so bauen, dass Mobile nur konsumiert.
- Keine neuen parallelen Business-Regeln nur in einem Client.

#### 1.4 Web-Kiosk weich abkündigen

- Auf `/kiosk` und `work.*`-Einstieg: Banner/Hinweis  
  „Bitte die persönliche App nutzen“ + Links zu `/worker-app` (Monteur) und `/pl` bzw. PIN-Login (PL/Kunde).
- Setup-Flow **nicht** löschen in Phase 1 (Rollback-Sicherheit), aber als „veraltet / Notfall“ kennzeichnen.
- Docs: `STATUS.md` / kurzer Absatz in Handbuch oder `claude-auftraege` – Primärweg = Personal-App.

#### 1.5 Explizit **nicht** in Phase 1

- Hard-Delete von `/kiosk/**` und Docker/Nginx-work-Host
- Vollständige UI-Vereinheitlichung React Native ↔ Next (Shared-UI-Monorepo)
- iOS-App
- Geofence
- Interne PROJECT_MANAGER-Handy-App

---

### Phase 2 – Android-Parität + Feinschliff (Follow-up-Auftrag)

- Live-Anwesenheit in Android, falls nicht in Phase 1
- PL/Kunde-PIN-Flow in Android nur wenn fachlich nötig (sonst Web-PWA reicht)
- UX-Angleich Worker-Web ↔ Android (Texte, Reihenfolge, leere Zustände)
- Feature-Flag oder Config: Kiosk-Terminal optional aus

### Phase 3 – Kiosk entfernen (Follow-up)

- Routen `/kiosk/**` entfernen oder Redirect-only
- Nginx/`work.`-Host auf Personal-App-Login umbiegen
- Flags `kioskAccessEnabled` evaluieren (ob noch gebraucht)
- Toten Code + Texte + E2E-Kiosk-Tests entfernen

---

## 5. Technische Leitplanken

- API-first: neue Fähigkeiten **serverseitig scoped** (Worker nur eigene Assignments; CUSTOMER_PL nur `ProjectCustomerPlAssignment`).
- Bestehende Timesheet-/Signatur-Flows (#33, #4, #9) **nicht** regressieren.
- MIXED-Tätigkeitspflicht bleibt (Commit `31ef413` / Gate HOURLY+MIXED).
- Deploy: `docker compose … --env-file .env.production`; **kein** `down -v`.
- Commits klar, PR-Beschreibung mit Testplan.
- UI-Texte in bestehenden `texts`-Modulen (DE); keine losen Hardcodings wo das Projekt Texte zentral hält.

---

## 6. Akzeptanzkriterien Phase 1

1. Monteur in Worker-Web sieht **Live**, wer auf relevanten Projekten eingestempelt ist (mind. gewähltes/zugewiesenes Projekt).
2. CUSTOMER_PL kann **ohne Kiosk-Setup** am Handy Stundenzettel abzeichnen (PIN oder bestehender PL-Login → `/pl`).
3. Kiosk-Einstieg zeigt **Abkündigungs-Hinweis** + Links zur Personal-App.
4. Worker-Timesheet-Signatur und Clock-In/Out unverändert grün (Regression).
5. Kein Datenleck: Worker sieht keine fremden Projekte; PL nur zugeordnete.
6. Kurze Checkliste Web↔Android im PR; fehlende Android-Live klar als Phase 2 benannt **oder** mitgeliefert.
7. Deploybar auf Prod-Compose; Dokumentation Primärweg aktualisiert.

---

## 7. Testplan (manuell / soweit sinnvoll automatisiert)

- Worker-PIN → Worker-App → Live-Liste plausibel
- Zweiter Monteur stempelt ein → erscheint in Live
- CUSTOMER_PL PIN/Login → `/pl` → Timesheet `WORKER_SIGNED` → approve
- Kiosk-URL öffnen → Banner sichtbar, Links funktionieren
- Clock-In MIXED weiterhin Tätigkeitspflicht (Regression Gate)
- Unzugeordnetes Projekt: kein Live-/PL-Zugriff (403/leer)

---

## 8. Lieferobjekt Cloud-Agent

1. Implementierung **Phase 1** vollständig laut Abschnitten 1.1–1.4.
2. PR gegen `main` (oder Branch `feat/37-personal-app-statt-kiosk`) mit Beschreibung + Testplan.
3. Kurze `*-notizen.md` oder PR-Abschnitt: was Phase 2/3 bleibt.
4. **Stopp** nach Phase 1 – kein Vorgriff auf Hard-Delete Kiosk ohne Freigabe.

---

## 9. Referenz

- Worker-Signatur: `claude-arbeitsitems-33-monteur-stundenzettel-signatur.md`
- Kunden-PL: `claude-arbeitsitems-04-customer-pl.md`, Kiosk-PL: `#9` / `#11`
- Expo/Android: `claude-arbeitsitems-36-expo-phase1-stempel.md`, `docs/ANDROID-LOKAL.md`
- Activity-Gate MIXED: Prod seit 2026-09-10
