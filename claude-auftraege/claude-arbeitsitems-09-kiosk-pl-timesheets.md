# Cloud-Auftrag #9: Kunden-PL Stundenzettel am Kiosk (PIN only)

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de`.

**Anforderung (verbindlich):** Der Kunden-Projektleiter (`CUSTOMER_PL`) geht **nicht** in die Office-App. Er nutzt ausschließlich den **Kiosk** (Baustellen-Tablet) mit **PIN**. Dort muss er:

1. Sich per PIN anmelden
2. Die **Stundenliste / Wochen-Stundenzettel** des Kiosk-Projekts sehen
3. Digital **unterschreiben und abzeichnen**

Bestehend:
- Worker-Kiosk: `/kiosk/terminal` – PIN → Worker-JWT → Stempeln / Items
- Kunden-PL Web: `/pl/timesheets` – Signatur+Approve (E-Mail-Login) – **nicht** für Kunden gedacht
- API: `POST /timesheets/:id/sign` + `approve` für `CUSTOMER_PL` (User-JWT)
- **Kein** User-PIN-Schema bisher (nur `WorkerPin`)

---

## Ziel

Nach Abschluss:

1. Kunden-PL hat eine **6-stellige PIN** (Büro setzt sie)
2. Kiosk-Setup wählt Modus **Monteur** oder **Kunden-PL**
3. Im Modus Kunden-PL: PIN → User-JWT mit Rolle `CUSTOMER_PL` → Liste eingereichter Stundenzettel des konfigurierten Projekts → Detail mit Stunden-Tabelle → SignatureCanvas → `sign(CUSTOMER)` + `approve`
4. Auto-Logout wie Kiosk; keine Navigation in die Office-App
5. Worker-Kiosk unverändert funktionsfähig

---

## 1. Prisma / Auth

### 1.1 `UserPin` (analog `WorkerPin`)

```prisma
model UserPin {
  id        String    @id @default(cuid())
  userId    String
  pinHash   String
  validFrom DateTime
  validTo   DateTime?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  user      User      @relation(...)
}
```

Migration + Relation an `User`.

**PIN-Eindeutigkeit:** Aktive PINs müssen **über WorkerPin und UserPin global eindeutig** sein (sonst Kollision am gleichen Pad). Beim Setzen prüfen.

### 1.2 Auth

Neuer Endpoint (klar getrennt vom Worker-Login):

`POST /auth/user-pin-login` `{ "pin": "123456" }` → User-JWT wie E-Mail-Login  
- User aktiv, hat Rolle `CUSTOMER_PL` (andere Rollen optional ablehnen oder erlauben – **Pflicht: mindestens CUSTOMER_PL**)
- Aktive UserPin
- Response analog `/auth/login` (`accessToken`, `user`)

Optional Seed: PIN für `kunden-pl@office.local` (z. B. `654321`) – dokumentieren.

### 1.3 Admin: PIN setzen

- API: `PUT /users/:id/pin` `{ pin: "######" }` – Rollen SUPERADMIN/OFFICE
- Nur sinnvoll für User mit `CUSTOMER_PL` (sonst 400 mit Hinweis)
- UI: in Benutzerverwaltung oder Kunden-PL-Zuordnung am Projekt ein kleines „PIN setzen“ – **minimal** reicht Benutzer-Detail falls vorhanden; sonst neuer Button bei Kunden-PL-Section im Projekt-Tab Arbeitsitems

---

## 2. Kiosk Setup

`KioskConfig` erweitern:

```ts
mode: 'worker' | 'customer_pl'  // Default 'worker'
```

Setup-UI (`/kiosk/setup`): Modus wählen + Projekt (Kunden-PL braucht ebenfalls `projectId` zum Filtern).

---

## 3. Kiosk UI – Kunden-PL Terminal

Neue Route oder Branch im Terminal, z. B. `/kiosk/pl` **oder** `terminal/page.tsx` mit `config.mode === 'customer_pl'`.

### 3.1 Idle

- PIN-Pad (wie Worker)
- Anzeige: „Kunden-PL · Projekt X“
- Login via `user-pin-login` → Token in **separatem** Key speichern, z. B. `office_kiosk_pl_token` (nicht Worker-Token vermischen)
- `apiClient`/timesheets: für diese Session Token aus PL-Key nutzen (Wrapper oder temporär Token setzen und nach Logout löschen)

### 3.2 Nach Login – Liste

`GET /timesheets?projectId={config.projectId}&status=SUBMITTED` (ggf. auch APPROVED read-only anzeigen)

Touch-Liste: Monteur, KW, Netto-Stunden, Status.

### 3.3 Detail

Stunden-Tabelle (Tage) wie `/pl/timesheets/[id]` – read-only.

Bei `SUBMITTED`:

- SignatureCanvas
- Name vorausgefüllt (`user.displayName`)
- Button: Unterschreiben & abzeichnen → `sign({ signerType: 'CUSTOMER', ... })` dann `approve`
- Bestätigung → zurück zur Liste / Auto-Logout

### 3.4 Idle / Logout

Bestehende Auto-Logout-Logik; Token löschen. Längeres Idle auf Signatur-Screen (≥120–180 s).

---

## 4. Explizit nicht

- Kein Kunden-Zugang zur Office-App erzwingen (bestehendes `/pl` darf bleiben für interne Tests, aber Kiosk ist der Produktivweg)
- Keine Mobile-APK-Änderung
- Worker-Stempel-Flow nicht regressiv ändern
- Kein E-Mail-Login im Kiosk

---

## 5. Texte / UX

`texts.kiosk.pl` o. ä.: PIN-Hinweis, Liste leer, Signatur-Pflicht, Erfolg.

Dark Kiosk-Theme beibehalten, Touch ≥44px.

---

## 6. Akzeptanz

| # | Kriterium |
|---|---|
| 1 | Büro kann Kunden-PL-User eine PIN setzen |
| 2 | Kiosk-Setup Modus „Kunden-PL“ + Projekt |
| 3 | PIN → nur bei gültigem CUSTOMER_PL + Zuordnung sinnvoll nutzbar |
| 4 | Liste der eingereichten Wochenzettel des Projekts |
| 5 | Stunden-Tabelle sichtbar |
| 6 | Digitale Unterschrift + Approve; PDF enthält Unterschrift |
| 7 | Worker-Kiosk unverändert |
| 8 | PINs Worker/PL kollidieren nicht |

---

## 7. Deliverables

- Migration + API + Kiosk-UI + minimale Admin-PIN-UI
- `claude-auftraege/claude-arbeitsitems-09-notizen.md` Self-Check
- Commit: `feat: Kunden-PL Stundenzettel-Abzeichnung am Kiosk per PIN`
- Branch pushen

## Referenzen

- Signatur-Dialog: `apps/web/src/app/(authenticated)/pl/timesheets/[id]/page.tsx`
- Canvas: `apps/web/src/components/timesheets/signature-canvas.tsx`
- Kiosk Terminal: `apps/web/src/app/kiosk/terminal/page.tsx`
- SPEZ: Kunden-PL darf PIN nutzen
