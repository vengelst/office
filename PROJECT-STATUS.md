# Office App – Projekt-Status-Freeze (02.07.2026)

## Aktueller Stand

**Repository:** github.com:vengelst/office.git  
**Branch:** main  
**Letzter Commit:** `34cf930` – Kiosk-Modus  
**Alle Änderungen sind committed und auf GitHub gepusht.**

---

## Implementierte Module (produktionsreif)

| # | Modul | Commit | Beschreibung |
|---|-------|--------|-------------|
| 1 | Projektbasis | `41c01c2` | NestJS API, Next.js Web, PostgreSQL, MinIO, Docker, Auth (JWT) |
| 2 | Kundenverwaltung | `c964876` | CRUD, Niederlassungen, Ansprechpartner, Bankverbindungen, Geocoding |
| 3 | Projektverwaltung | `0f50521` | CRUD, 7-Tab-Detail, Standorte, Equipment, Timeline/Kalender |
| 4 | Monteure/Teams/Subs | `a8edd60` | Workers mit 6 Tabs, Subunternehmen, Teams, Sprachen, Zertifikate |
| 5 | Zeiterfassung | `ec0c8b0` | PIN-Login, Clock-In/Out, Stundenzettel, Unterschriften, PDF-Export |
| 6 | Abrechnungen | `517e0e2` | Ausgangs-/Eingangsrechnungen, Auto-Generierung, Teilrechnungen, PDF |
| 7 | Fahrzeuge | `cd2847b` | Fahrzeugverwaltung (rudimentär), Zuweisungen, TÜV-Warnungen |
| 8 | Dokumente (Overhaul) | `5dc46e8` | Bild-Editor, Kamera, Ordner, Versionen, Lightbox, Multi-Upload |
| 9 | PIN/E-Mail/Drive | `c03bfc1` | PIN-Verwaltung, SMTP-Config, Google Drive Sync, Delete/Deaktivieren |
| 10 | Storage-Struktur | `981030b` | Lesbare MinIO-Pfade, Drive-Ordnerstruktur, Auto-PDF-Exports |
| 11 | Kiosk-Modus | `34cf930` | Tablet-Stempeluhr, dunkles Theme, Live-Übersicht, GPS |

---

## Tech-Stack

- **Backend:** NestJS, Prisma ORM, PostgreSQL, MinIO (S3-kompatibel)
- **Frontend:** Next.js 14, React, shadcn/ui, Tailwind CSS, React Hook Form + Zod
- **Auth:** JWT (User + Worker-PIN), bcrypt
- **PDF:** pdfkit
- **E-Mail:** nodemailer
- **Cloud:** Google Drive API (googleapis)
- **Docker:** docker-compose.dev.yml (postgres, minio, api, web)
- **Deployment:** Noch nicht konfiguriert (aktuell nur Docker Dev)

---

## Offene Punkte / Backlog

### Hohe Priorität (nächste Schritte)

1. **Seed-Daten-Bug:** Seed erstellt TimeEntries in der Zukunft → `getStatus()` findet falsche Clock-Outs. Fix: Seed so anpassen, dass keine Einträge nach "heute" generiert werden.

2. **Unauthorized beim Kunden-Speichern:** Fix wurde implementiert (handleUnauthorized in api-client.ts + CORS), aber noch nicht vollständig verifiziert im Browser.

3. **Worker-Equipment-Tab:** Backend-Endpoint für Equipment-Ausgaben fehlt noch – Tab ist aktuell read-only.

4. **DocumentsTab Upload-Dialog:** Zeigt bei Monteuren noch Kunden-Dokumenttypen statt monteurspezifische (types-for-context Endpoint existiert, muss im alten Upload-Dialog integriert werden).

5. **Google Drive:** Noch nicht konfiguriert/getestet mit echtem Google Workspace. Service Account Key muss erstellt und in /settings/storage hinterlegt werden.

6. **SMTP:** Noch nicht konfiguriert. Muss in /settings/email mit echten SMTP-Daten befüllt werden.

### Mittlere Priorität (Verbesserungen)

7. **Dashboard:** "Stunden diese Woche" zeigt 200h – Berechnung prüfen (weeklyPackageHours × Monteure, evtl. zu hoch durch Test-Projekte).

8. **Kiosk:** Browser-Test noch ausstehend (visueller Test im Browser).

9. **Offline-Modus:** Worker-App/Kiosk sollte bei Netzausfall Stempel lokal speichern und später synchronisieren.

10. **DATEV-Export:** Für Abrechnungsmodul geplant, noch nicht implementiert.

11. **Rechnungsvorlage:** User will eigene PDF-Vorlage hochladen (aktuell Standard-Layout).

12. **Einheitsbasierte Abrechnung:** UNIT_BASED billingMode nur als Typ definiert, Detail-Logik fehlt.

### Niedrige Priorität (nice-to-have)

13. **Mahnwesen:** User hat explizit gesagt "kein Mahnwesen" – evtl. später.

14. **Fahrtenbuch:** Für Fahrzeuge geplant, kommt später.

15. **Tankkosten/Schadensmeldungen:** Fahrzeug-Management-Erweiterung, später.

16. **Nacht-/Wochenend-Zuschläge:** User hat explizit gesagt "keine Zuschläge".

17. **Deployment:** Production-Setup (Server, Domain, SSL, CI/CD) noch nicht geplant.

---

## Datenbankstruktur (Prisma-Migrationen)

```
prisma/migrations/
├── 20260618_initial/
├── 20260630073614_initial/
├── 20260630081922_add_projects_module/
├── 20260630200608_add_workers_module/
├── 20260630212811_add_timesheets_module/
├── 20260630220641_add_invoices_module/
├── 20260630223422_extend_vehicles/
├── 20260630225651_improve_documents/
└── 20260701192000_add_drive_fields/
```

---

## Konfigurationen (Docker Dev)

```
API:      localhost:3901
Web:      localhost:3900
Postgres: localhost:5433 (User: office, DB: office)
MinIO:    localhost:9002 (User: office_minio, PW: office_minio_pw)
```

**Admin-Login:** admin@office.local / admin123  
**Worker-PINs:** 001001 (Marko), 001002 (Ivan), 001003 (Piotr), 001004 (Tomasz), 001005 (Stefan), 001006 (Ahmed)

---

## Ordnerstruktur Aufträge

```
claude-auftraege/
├── claude-customers-v2.md      (Kunden-Verbesserungen)
├── claude-projects.md          (Projektverwaltung)
├── claude-workers.md           (Monteure/Teams/Subs)
├── claude-timesheets.md        (Zeiterfassung)
├── claude-invoices.md          (Abrechnungen)
├── claude-vehicles.md          (Fahrzeuge)
├── claude-documents.md         (Dokumente-Overhaul)
└── drive-ordnerstruktur.md     (Google Drive Struktur-Definition)
```

---

## Workflow-Erinnerung

- **Kleine Fixes:** Cursor direkt → Docker-Container rebuild
- **Große Features:** Claude Code Auftrag in 2 Teilen (Backend → Frontend)
- **Aufträge:** Spec in `claude-auftraege/` schreiben, dann `claude -p` mit --dangerously-skip-permissions
- **Bei Timeout:** Auftrag in kleinere Teile splitten

---

## Nächste große Features (noch nicht spezifiziert)

1. **Deployment/Production** – Server-Setup, Domain, SSL
2. **Benutzer-Rollen-Verwaltung** – Aktuell nur Admin, fehlt: Projektleiter, Büro, etc.
3. **Benachrichtigungen** – E-Mail bei ablaufenden Dokumenten, Rechnungserinnerungen
4. **Mobile PWA** – Worker-App als installierbare App
5. **Reporting/Dashboards** – Auswertungen, Charts, Export
