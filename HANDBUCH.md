# Office 1.0.0 – Kurzanleitung (Büro)

**Version:** 1.0.0 (Production)  
**App:** https://office.vivahome.de  
**Kiosk:** https://work.vivahome.de  
**Stand:** 2026-08-24  
**PDF:** [HANDBUCH.pdf](./HANDBUCH.pdf)

Diese Anleitung beschreibt die wichtigsten Stammdaten-Schritte im Büro.  
Login: E-Mail + Passwort (Büro-Benutzer). Monteure nutzen PIN (App/Kiosk).

---

## Inhaltsverzeichnis

1. [Kunde anlegen](#1-kunde-anlegen)
2. [Projekt anlegen](#2-projekt-anlegen)
3. [Monteur (Engineer) anlegen](#3-monteur-engineer-anlegen)
4. [Subunternehmen anlegen](#4-subunternehmen-anlegen)
5. [Monteur einem Subunternehmen zuordnen](#5-monteur-einem-subunternehmen-zuordnen)
6. [Monteur einem Projekt zuweisen](#6-monteur-einem-projekt-zuweisen)
7. [Kurz: Stempel & Stundenzettel](#7-kurz-stempel--stundenzettel)

---

## 1. Kunde anlegen

1. Menü **Kunden** → Button **Neuer Kunde** (oder `/customers/new`).
2. Pflicht-/Kerndaten ausfüllen, z. B.:
   - Firmenname  
   - Adresse, PLZ, Ort  
   - optional Bewertung, Notizen  
3. **Speichern**. Die Kundennummer (z. B. `K-2026-…`) wird vergeben.
4. Auf der Kunden-Detailseite ergänzen Sie bei Bedarf:
   - **Kontakte** (Ansprechpartner, optional Visitenkarten-Scan)  
   - **Niederlassungen**  
   - **E-Mails / Bankverbindungen**  
   - **Dokumente**

> Tipp: Google-Contacts-Sync nur für Kontakte mit gesetzter Sync-Option (Einstellungen → Google Contacts).

---

## 2. Projekt anlegen

1. Menü **Projekte** → **Neues Projekt** (`/projects/new`).
2. Mindestens wählen/ausfüllen:
   - **Kunde** (bestehend)  
   - **Titel**  
   - Status (z. B. Geplant / Aktiv)  
3. **Speichern**. Projektnummer (z. B. `P-2026-…`) wird vergeben.
4. Im Projekt-Detail bei Bedarf:
   - Standorte / Baustellen  
   - Tab **Monteure** (Zuweisungen) – siehe Abschnitt 6  
   - Arbeitsitems (nur wenn Item-Modus aktiv)  
   - Dokumente, Notizen  

Ohne gültige **Projektzuweisung** dürfen normale Monteure am Kiosk nicht einstempeln (Ausnahme: **Master-Monteur**).

---

## 3. Monteur (Engineer) anlegen

1. Menü **Monteure** → **Neuer Monteur** (`/workers/new`).
2. Stammdaten:
   - Vorname, Nachname  
   - **Typ:** `Angestellt` oder `Subunternehmen`  
   - Verfügbarkeit, Kontaktdaten nach Bedarf  
3. **Speichern**. Monteurnummer (z. B. `W-2026-…`) wird vergeben.
4. Auf der Detailseite:
   - Tab **Stammdaten:** optional **Master-Monteur** (darf ohne Zuweisung auf jedes Projekt stempeln)  
   - Bereich **PIN:** 6-stellige PIN setzen; optional **Kiosk nutzen** und Gültig ab/bis  
   - Qualifikationen, Vertrag, Dokumente nach Bedarf  

PIN wird für Monteur-App und Kiosk (`work.vivahome.de`) verwendet.

---

## 4. Subunternehmen anlegen

1. Menü **Subunternehmen** → **Neues Subunternehmen** (`/subcontractors/new`).
2. Name und Kontaktdaten (Person, E-Mail, Telefon, Adresse) eintragen.
3. Optional Bank-/Steuerdaten.
4. **Speichern**.

Danach können Monteure vom Typ „Subunternehmen“ diesem Sub zugeordnet werden.

---

## 5. Monteur einem Subunternehmen zuordnen

1. **Monteure** → gewünschten Monteur öffnen.
2. Tab **Stammdaten** bearbeiten:
   - **Typ** auf **Subunternehmen** stellen  
   - Im Feld **Subunternehmen** den Eintrag aus Abschnitt 4 wählen  
3. **Speichern**.

Hinweise:
- Bei Typ **Angestellt** entfällt die Sub-Zuordnung (Feld wird geleert).  
- Sub-Monteure erscheinen in Listen weiterhin unter Monteure; der Sub ist in den Stammdaten sichtbar.

---

## 6. Monteur einem Projekt zuweisen

Zwei übliche Wege:

### A) Vom Projekt aus (empfohlen)

1. **Projekte** → Projekt öffnen.  
2. Tab **Monteure**.  
3. Monteur wählen, **Startdatum** setzen, optional Endedatum / Rolle / Vorarbeiter.  
4. Zuweisung speichern (**aktiv**).

### B) Vom Monteur aus

1. **Monteure** → Monteur öffnen.  
2. Tab **Projekte & Teams**.  
3. Projekt wählen und Datumsfenster setzen, speichern.

Wichtig für den Kiosk:
- Zuweisung muss **aktiv** sein.  
- **Heute** muss im Fenster `Startdatum` … `Endedatum` (oder ohne Ende) liegen.  
- Sonst erscheint am Kiosk: keine gültige Zuweisung (außer Master-Monteur).

---

## 7. Kurz: Stempel & Stundenzettel

| Was | Wo |
|-----|-----|
| Kiosk einrichten | Tablet: https://work.vivahome.de → Setup (Admin-PIN) → Projekt wählen |
| Einstempeln | Kiosk oder Monteur-App mit PIN |
| Stundenzettel | Büro: **Stundenzettel** → „Anlegen / öffnen“ (Monteur, Projekt, KW; optional bis KW) |
| Manuell ohne Handy | Stundenzettel öffnen (Entwurf) → **Tag erfassen** oder Tageszeile bearbeiten |
| Neu aus Stempelungen | Im Entwurf: **Aus Stempelungen neu laden** |

Backup: **Einstellungen → Backup** (Uhrzeit = Europe/Berlin).

---

## Empfohlene Reihenfolge beim Start eines Auftrags

1. Kunde anlegen (falls neu)  
2. Projekt anlegen und Kunde verknüpfen  
3. Subunternehmen anlegen (falls Fremdmonteure)  
4. Monteure anlegen / Subs zuordnen  
5. Monteure dem Projekt zuweisen (Datum!)  
6. PIN setzen + ggf. Kiosk-Freigabe  
7. Kiosk auf Baustelle auf das Projekt einrichten  

---

*Office Vivahome · Version 1.0.0*
