# Office

**Version 1.0.0 (Production)** · Release: https://github.com/vengelst/office/releases/tag/v1.0.0

Webanwendung für CRM, Projektverwaltung, Monteurverwaltung, mobile Zeiterfassung
mit GPS, Wochen-Stundenzettel mit Signatur, Dokumentenmanagement und Kiosk-/PIN-Modus.

Monorepo auf Basis von **pnpm Workspaces**.

| | URL |
|---|-----|
| Büro-App | https://office.vivahome.de |
| Kiosk | https://work.vivahome.de |
| Handbuch (Stammdaten) | [HANDBUCH.md](./HANDBUCH.md) · [HANDBUCH.pdf](./HANDBUCH.pdf) |
| Deployment | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Feature-Status | [STATUS.md](./STATUS.md) |
| Session-Backlog | [claude-auftraege/offen-backlog.md](./claude-auftraege/offen-backlog.md) |

## Tech-Stack

| Bereich    | Technologie                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui |
| Backend    | NestJS, TypeScript, Passport-JWT                        |
| Datenbank  | PostgreSQL 16, Prisma ORM                               |
| Storage    | MinIO (S3-kompatibel)                                   |

## Projektstruktur

```
office/
  apps/
    web/          Next.js Frontend (Port 3800)
    api/          NestJS Backend  (Port 3801, Prefix /api)
    mobile/       Expo Kiosk-App (Android)
  packages/
    types/        Geteilte TypeScript-Typen
  prisma/
    schema.prisma Datenmodell
    migrations/   Versionierte SQL-Migrationen
    seed.ts       Seed-Daten (nur Dev – nicht in Prod-Start)
  docker/         Dockerfiles (Produktion)
  docker-compose.prod.yml   Produktion (--env-file .env.production)
  docker-compose.dev.yml    Entwicklung
  HANDBUCH.md     Kurzanleitung Büro (Stammdaten)
  HANDBUCH.pdf    Gleiche Anleitung als PDF
```

## Schnellstart (Docker, empfohlen)

Voraussetzung: Docker mit Compose-Plugin.

```bash
cp .env.example .env        # Werte bei Bedarf anpassen
docker compose -f docker-compose.dev.yml up --build
```

Beim ersten Start werden Abhängigkeiten installiert, die Datenbank
migriert und Seed-Daten eingespielt. Anschließend:

| Dienst             | URL                              |
| ------------------ | -------------------------------- |
| Web-Frontend       | http://localhost:3800            |
| API (Health-Check) | http://localhost:3801/api        |
| API-Doku (Swagger) | http://localhost:3801/api/docs   |
| MinIO Console      | http://localhost:9001            |

## Produktion (vivahome.de)

```bash
cd /opt/office
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

**Wichtig:** Immer `--env-file .env.production` – sonst sind DB/Secrets leer.  
In Prod läuft **kein** `prisma db seed` mehr beim API-Start.

## Standard-Zugangsdaten (nur Seed / Entwicklung)

| Rolle           | E-Mail              | Passwort   |
| --------------- | ------------------- | ---------- |
| SUPERADMIN      | admin@office.local  | `admin123` |
| OFFICE          | buero@office.local  | `buero123` |
| PROJECT_MANAGER | pl@office.local     | `pl123`    |

> ⚠️ Nicht für produktive Passwörter verwenden.

## Nützliche Skripte (Root)

| Befehl                  | Beschreibung                          |
| ----------------------- | ------------------------------------- |
| `pnpm dev`              | web + api im Watch-Modus              |
| `pnpm build`            | alle Pakete bauen                     |
| `pnpm lint`             | Lint/Typecheck über alle Pakete       |
| `pnpm prisma:migrate`   | Migration erstellen/anwenden (dev)    |
| `pnpm prisma:seed`      | Seed-Daten einspielen (nur Dev)       |
| `pnpm prisma:studio`    | Prisma Studio öffnen                  |

## API-Überblick

- `GET  /api` – Health-Check
- `POST /api/auth/login` – E-Mail + Passwort → JWT
- `POST /api/auth/pin-login` / `/api/worker-auth/pin-login` – Monteur-PIN → JWT
- `POST /api/auth/logout` – Session invalidieren
- `POST /api/auth/refresh` – Token erneuern

Authentifizierung: `Authorization: Bearer <token>`.
