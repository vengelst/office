# Office 1.0.0 – Kurzanleitung (Büro)

**Viva Home**  
**Viva Home GmbH**  
Am Ringwall 16  
51491 Overath  

**Version:** 1.0.0 (Production)  
**App:** https://office.vivahome.de  
**Kiosk:** https://work.vivahome.de  
**Stand:** 2026-08-24  
**PDF:** [HANDBUCH.pdf](./HANDBUCH.pdf) (helles Design, druckgeeignet)

© Viva Home GmbH

Diese Kurzanleitung beschreibt die festen Büro-Schritte für die Stammdaten:  
Kunde, Projekt, Monteur, Subunternehmen sowie die Zuordnungen Monteur↔Sub und Monteur↔Projekt.

Anmeldung Büro: E-Mail und Passwort. Monteure stempeln mit 6-stelliger PIN (App/Kiosk).

Screenshots: `docs/handbuch-screens/` (helles App-Design). PDF neu erzeugen:

```bash
python3 -m venv .pdf-venv && .pdf-venv/bin/pip install fpdf2 pillow
.pdf-venv/bin/python scripts/build-handbuch-pdf.py
```

---

## Inhaltsverzeichnis

1. [Orientierung im Menü](#1-orientierung-im-menü)
2. [Kunde anlegen](#2-kunde-anlegen)
3. [Projekt anlegen](#3-projekt-anlegen)
4. [Monteur anlegen](#4-monteur-anlegen)
5. [Subunternehmen anlegen](#5-subunternehmen-anlegen)
6. [Monteur einem Subunternehmen zuordnen](#6-monteur-einem-subunternehmen-zuordnen)
7. [Monteur einem Projekt zuweisen](#7-monteur-einem-projekt-zuweisen)
8. [Stempel und Stundenzettel (Kurz)](#8-stempel-und-stundenzettel-kurz)

---

## 1. Orientierung im Menü

Nach dem Login öffnet sich das Dashboard. Links steht die Hauptnavigation. Für die Stammdaten nutzen Sie vor allem:

- **Kunden** – Firmenkunden anlegen und pflegen  
- **Projekte** – Aufträge anlegen und Monteure zuweisen  
- **Monteure** – Personenstammdaten, PIN, Typ Angestellt/Sub  
- **Subunternehmen** – Firmen der Fremdmonteure  

Oben rechts können Sie das Design wechseln. Für Ausdrucke und diese Anleitung ist das **helle Design** vorgesehen.

---

## 2. Kunde anlegen

1. Menü **Kunden** öffnen.  
2. Oben rechts **Neuer Kunde** wählen (`/customers/new`).  
3. Mindestens den **Firmennamen** ausfüllen. Empfohlen: Adresse (Straße, PLZ, Ort), Status **Aktiv**.  
4. **Speichern**. Die Kundennummer (z. B. `K-2026-…`) wird vergeben.  
5. Im Kundendetail bei Bedarf ergänzen: Kontakte, Niederlassungen, E-Mails, Bankverbindungen, Dokumente.

Hinweis: Der Google-Contacts-Sync gilt nur für Kontakte mit gesetzter Sync-Option (Einstellungen → Google Contacts).

---

## 3. Projekt anlegen

1. Menü **Projekte** → **Neues Projekt** (`/projects/new`).  
2. Pflicht: **Titel** und bestehender **Kunde**.  
3. Optional: Leistungsart und Priorität.  
4. **Speichern**. Die Projektnummer (z. B. `P-2026-…`) wird vergeben.  
5. Im Projektdetail: Standorte pflegen und im Tab **Monteure** die Zuweisungen setzen (siehe Abschnitt 7).

Wichtig für den Kiosk: Normale Monteure dürfen nur mit gültiger, aktiver Projektzuweisung einstempeln. Ausnahme: **Master-Monteur**.

---

## 4. Monteur anlegen

1. Menü **Monteure** → **Neuer Monteur** (`/workers/new`).  
2. Pflicht: Vorname und Nachname.  
3. Typ wählen: **Angestellt** oder **Subunternehmen**. Verfügbarkeit z. B. **Verfügbar**.  
4. **Speichern**. Die Monteurnummer (z. B. `W-2026-…`) wird vergeben.  
5. Im Detail: optional **Master-Monteur**; unter PIN eine 6-stellige PIN setzen; bei Bedarf **Kiosk nutzen** und Gültig ab/bis.

Die PIN gilt für Monteur-App und Kiosk (`work.vivahome.de`). Ohne Kiosk-Freigabe ist der PIN-Login am Kiosk gesperrt.

---

## 5. Subunternehmen anlegen

1. Menü **Subunternehmen** → **Neues Subunternehmen**.  
2. Pflicht: Firmenname. Empfohlen: Kontaktperson, E-Mail, Telefon, Adresse.  
3. Optional: Steuer- und Bankdaten.  
4. **Speichern**.

Danach können Monteure vom Typ „Subunternehmen“ diesem Sub zugeordnet werden.

---

## 6. Monteur einem Subunternehmen zuordnen

1. Menü **Monteure** → gewünschten Monteur öffnen.  
2. Tab **Stammdaten** bearbeiten.  
3. Typ auf **Subunternehmen** stellen.  
4. Im Pflichtfeld **Subunternehmen** den Eintrag aus Abschnitt 5 wählen.  
5. **Speichern**.

- Bei Typ **Angestellt** wird die Sub-Zuordnung entfernt.  
- Der Monteur bleibt in der Monteurliste; der Sub erscheint in den Stammdaten.

---

## 7. Monteur einem Projekt zuweisen

### Weg A – vom Projekt (empfohlen)

1. Menü **Projekte** → Projekt öffnen.  
2. Tab **Monteure**.  
3. **Monteur zuordnen**.  
4. Zeitraum Von/Bis, Monteur, optional Funktion/Teamleitung.  
5. **Speichern** (Zuweisung aktiv).

### Weg B – vom Monteur

1. Monteur öffnen → Tab **Projekte & Teams**.  
2. Projekt und Datumsfenster setzen → speichern.

### Kiosk-Regel

Zum Einstempeln muss die Zuweisung **aktiv** sein und das heutige Datum im Fenster Von–Bis liegen (oder Bis leer). Sonst: keine gültige Zuweisung – außer beim Master-Monteur.

---

## 8. Stempel und Stundenzettel (Kurz)

| Was | Wo |
|-----|-----|
| Kiosk einrichten | `work.vivahome.de` → Setup (Admin-PIN) → aktives Projekt → starten |
| Einstempeln | Kiosk oder Monteur-App mit PIN |
| Stundenzettel | Büro → **Stundenzettel** → Anlegen/öffnen (Monteur, Projekt, KW) |
| Manuell | Entwurf → **Tag erfassen** / Tageszeile bearbeiten |
| Neu aus Stempelungen | Entwurf → **Aus Stempelungen neu laden** |

Backup: **Einstellungen → Backup** (Europe/Berlin).

---

## Empfohlene Reihenfolge für einen neuen Auftrag

1. Kunde anlegen oder bestehenden Kunden wählen  
2. Projekt anlegen und Kunden verknüpfen  
3. Subunternehmen anlegen (nur bei Fremdmonteuren)  
4. Monteure anlegen und ggf. dem Sub zuordnen  
5. Monteure dem Projekt zuweisen (Datum beachten)  
6. PIN setzen und ggf. Kiosk-Freigabe aktivieren  
7. Kiosk auf der Baustelle auf dieses Projekt einrichten  

---

*Viva Home | © Viva Home GmbH | Am Ringwall 16, 51491 Overath | Office Version 1.0.0*
