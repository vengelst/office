# Office App – Projekt-Status

**Version:** **1.0.0 (Production)**  
**Stand:** 26. August 2026  
**Repository:** github.com/vengelst/office · Tag [`v1.0.0`](https://github.com/vengelst/office/releases/tag/v1.0.0)  
**Branch:** `main`  
**Produktion:** https://office.vivahome.de · Kiosk: https://work.vivahome.de (`/opt/office`)

> Handbuch Stammdaten: **`HANDBUCH.md`** · **`HANDBUCH.pdf`**  
> Ausführliche Feature-Liste: **`STATUS.md`**  
> Session-/Backlog: **`claude-auftraege/offen-backlog.md`**  
> Nächster Cloud-Auftrag: **`claude-auftraege/claude-arbeitsitems-20-google-calendar.md`**  
> Deployment: **`DEPLOYMENT.md`**

### Release 1.0.0 – Produktivstart (Ende Beta)

Eingefrorener Produktionsstand. Weitere Änderungen erfolgen als **1.x** in der Produktion.

**Neu / gefestigt für 1.0.0 (Auswahl):**
- Kiosk-Domain `work.vivahome.de`, PWA, Zuweisungspflicht, PIN-Kiosk-Freigabe, Foto-Kommentar im Bild
- Master-Monteur (Stempeln ohne Projektzuweisung)
- Stundenzettel: anlegen/öffnen, KW-Bereich, volle Woche Mo–So, manuelle Tage, Neu laden aus Stempelungen
- Backup-Zeitplan **Europe/Berlin**; Seed nicht mehr bei jedem API-Start in Prod
- Google Contacts produktiv

**Nachgezogen seit 1.0.0 (Auswahl, 24.–26.08.):**
- GPS-Übersicht, Filter, Karten-Spur; GPS bei Login/Logout/Foto/Aktionen
- Baustellenfotos-Tab (Monteur + Projekt); Kiosk-Stabilität
- Handbuch als druckfreundliches PDF

---

## Implementierte Module (produktionsreif)

| # | Modul | Beschreibung |
|---|-------|-------------|
| 1 | Projektbasis | NestJS API, Next.js Web, PostgreSQL, MinIO, Docker, JWT-Auth |
| 2 | Kundenverwaltung | CRUD, Filialen, Kontakte, Bank, OCR-Visitenkarten, Drucken, Google Contacts Sync |
| 3 | Projektverwaltung | CRUD, Detail-Tabs, Baustellen, Zuweisungen |
| 4 | Monteure / Teams / Subs | Workers, Qualifikationen, Subunternehmen, Teams, Master-Monteur, PIN |
| 5 | Zeiterfassung | PIN-Login, Clock-In/Out, Stundenzettel (manuell + Generate), PDF, Signaturen, Live, Offline-Queue |
| 6 | Abrechnungen | Ein-/Ausgangsrechnungen (Modul vorhanden; Daten je Instanz) |
| 7 | Fahrzeuge | CRUD, Zuweisungen, Fristen |
| 8 | Dokumente | Ordner, Versionen, Drive-Sync |
| 9 | Storage / Drive / E-Mail | MinIO, Google Drive DWD, SMTP |
| 10 | Kiosk (Web) | Stempeluhr DE/SK/SL, Kunden-PL, GPS, PWA auf work.vivahome.de |
| 11 | OCR | Visitenkarten (+ Rotation) |
| 12 | Auto-Recherche | Research-Microservice |
| 13 | Equipment | Werkzeuge/Geräte |
| 14 | Kommunikation | Kundenhistorie |
| 15 | To-Dos | Prioritäten, Dashboard |
| 16 | Ausschreibungen | Submissions |
| 17 | Einstellungen | Firma, Pausen, Storage, Contacts, Backup, System, Feature-Flags |
| 18 | Mobile Kiosk-App | Expo/Android APK |
| 19 | Arbeitsitems | Import, Büro, Monteur, Kunden-PL |
| 20 | Feature-Flags | Module an/aus |

---

## Tech-Stack

- **Backend:** NestJS, Prisma ORM (v5.22), PostgreSQL 16, MinIO, sharp (Foto-Overlay)
- **Frontend Web:** Next.js 14, shadcn/ui, Tailwind
- **Frontend Mobile:** React Native / Expo
- **Auth:** JWT (User + Worker-PIN); Rollen u. a. `SUPERADMIN`, `OFFICE`, `PROJECT_MANAGER`, `WORKER`, `CUSTOMER_PL`
- **Deployment:** vivahome.de, Docker Compose + Nginx + TLS · immer `--env-file .env.production`

---

## Offene Punkte / Backlog

Siehe **`claude-auftraege/offen-backlog.md`**. Nächster Auftrag: **Google Calendar Phase 1 (#20)** – Spec startklar; davor Google Admin Calendar-Scope.
