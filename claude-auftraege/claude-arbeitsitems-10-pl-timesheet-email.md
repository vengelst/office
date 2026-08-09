# Cloud-Auftrag #10: Stundenzettel-PDF per E-Mail an Kunden-PL

## Kontext

Repo: Office-Monorepo, Produktion `office.vivahome.de`.

**Anforderung:** Am Kunden-Projektleiter (`CUSTOMER_PL`) soll eine **Zustell-E-Mail** hinterlegt werden können (vom Büro definiert, nicht zwingend die Login-Mail). Wenn ein Wochen-Stundenzettel vom Kunden-PL **abgezeichnet/genehmigt** ist (`SUBMITTED` → `APPROVED`), soll das Stundenzettel-PDF **nicht nur gespeichert**, sondern zusätzlich **an diese E-Mail** versendet werden.

Bestehend:
- `ProjectCustomerPlAssignment` (User ↔ Projekt), UI in `customer-pls-section.tsx` (PIN setzen möglich, E-Mail nur Anzeige von `User.email`)
- `TimesheetsService.approve` → async `exportTimesheetPdf` (PDFKit → Documents/MinIO) – **kein Mail-Versand**
- `EmailService.send(to, subject, html)` – nodemailer, **keine Attachments**
- SMTP über AppSettings (`/settings/email`)

---

## Ziel

1. Pro Kunden-PL-Zuordnung am Projekt: editierbare **Zustell-E-Mail** (`notificationEmail`)
2. Nach erfolgreicher Genehmigung: PDF erzeugen (wie heute) **und** per E-Mail mit PDF-Anhang an diese Adresse senden
3. Genehmigung darf bei Mail-Fehler **nicht** fehlschlagen (log + soft fail)
4. Ohne gesetzte Zustell-E-Mail: kein Versand (oder Fallback auf `User.email` – siehe Regel unten)

---

## 1. Prisma

`ProjectCustomerPlAssignment` erweitern:

```prisma
notificationEmail String?  // Zustelladresse für Stundenzettel-PDF
```

Migration anlegen. Kein neues Modell nötig.

---

## 2. API – Kunden-PL

### 2.1 DTO / Service

`ProjectCustomerPlsService` / Controller:

- Response enthält `notificationEmail`
- Neuer oder erweiterter Endpoint, z. B.:
  - `PATCH /projects/:projectId/customer-pls/:userId` `{ notificationEmail?: string | null }`
  - Validierung: gültige E-Mail oder leer/`null` zum Löschen
- Optional beim `POST` (Zuordnen) bereits `notificationEmail` mitgeben

Rollen: SUPERADMIN / OFFICE (wie bestehende PL-CRUD).

### 2.2 Typen / Frontend-Client

`CustomerPlAssignment` in `apps/web/src/lib/work-items.ts` um `notificationEmail` erweitern; API-Wrapper für PATCH.

---

## 3. UI – Kunden-PL-Section

Datei: `apps/web/src/components/projects/tabs/work-items/customer-pls-section.tsx`

- Spalte oder Icon (z. B. Mail) neben PIN: **Zustell-E-Mail setzen/ändern**
- Dialog mit E-Mail-Input, speichern → PATCH
- Anzeige: gesetzte Adresse sichtbar; wenn leer, Hinweis „nicht gesetzt“ (Login-Mail nur als Hinweis/Placeholder, nicht stillschweigend überschreiben)
- Texte in `texts.ts` (DE)

---

## 4. E-Mail-Versand

### 4.1 `EmailService`

`send` erweitern um optionale Attachments, z. B.:

```ts
attachments?: { filename: string; content: Buffer; contentType?: string }[]
```

Rückwärtskompatibel (PIN-/Test-Mails unverändert).

### 4.2 Trigger in `TimesheetsService`

In `exportTimesheetPdf` (oder direkt nach PDF-Buffer-Erzeugung in dem async-Pfad von `approve`):

1. PDF-Buffer wie bisher speichern
2. Empfänger auflösen:
   - Primär: `ProjectCustomerPlAssignment.notificationEmail` für `projectId` + `approvedByUserId` (aktive Zuordnung)
   - Fallback: wenn `notificationEmail` leer → `User.email` des genehmigenden Users
   - Wenn weder Adresse noch User → kein Versand, log info
3. Mail senden:
   - Subject z. B. `Stundenzettel KW{n} – {Worker} – {Projekt}`
   - Kurzer HTML-Body (Deutsch)
   - Attachment: PDF mit sinnvollem Filename (wie Storage-Filename)
4. Fehler nur loggen (`warn`), Approve-Response bleibt erfolgreich

**Hinweis:** `approve` kann auch von Office-Rollen aufgerufen werden – trotzdem an die aufgelöste Adresse des `approvedByUserId` senden, sofern Zuordnung/User-Mail existiert. Wenn der Genehmiger kein Kunden-PL ist: Empfänger = alle **aktiven** PLs des Projekts mit gesetzter `notificationEmail` (Fallback User.email). Bevorzugte einfache Variante, wenn zu aufwendig: **nur senden wenn `approvedByUserId` eine aktive PL-Zuordnung am Projekt hat**, sonst still skip.

Empfohlene klare Regel (verbindlich):

> Mail nur wenn der Genehmiger (`approvedByUserId`) eine **aktive** `ProjectCustomerPlAssignment` am Timesheet-Projekt hat. Empfänger = `notificationEmail ?? user.email`. Sonst kein Mail.

---

## 5. Module / DI

`TimesheetsModule` muss `EmailService` / `EmailModule` importieren falls noch nicht vorhanden. Keine Zyklen einführen.

---

## 6. Akzeptanzkriterien

- [ ] Migration läuft; Feld `notificationEmail` persistiert
- [ ] Büro kann am Projekt → Arbeitsitems → Kunden-PL eine Zustell-E-Mail setzen und ändern
- [ ] Nach Kiosk- oder Web-Abzeichnung (`sign` + `approve`) liegt PDF wie bisher im Dokumentenbereich **und** eine E-Mail mit PDF-Anhang geht an die konfigurierte Adresse (SMTP muss auf dem Server gesetzt sein)
- [ ] Ohne SMTP / bei Sendefehler: Approve trotzdem OK, Fehler im API-Log
- [ ] Ohne PL-Zuordnung / ohne E-Mail: kein Crash, kein Versand
- [ ] Worker-Kiosk und bestehende PIN-Mails unverändert

## Nicht im Scope

- Mehrere Empfänger / CC / ProjectEmailRecipient-Verdrahtung
- UI-Benachrichtigung „Mail gesendet“ im Kiosk
- Änderung der Login-E-Mail des Users
- Neuer SMTP-Setup-Wizard

## Self-Check

Kurz in `claude-auftraege/claude-arbeitsitems-10-notizen.md` dokumentieren.
