# Office

Webanwendung für CRM, Projektverwaltung, Monteurverwaltung, mobile Zeiterfassung
mit GPS, Wochen-Stundenzettel mit Signatur, Dokumentenmanagement und Kiosk-/PIN-Modus.

Monorepo auf Basis von **pnpm Workspaces** (ohne Turborepo).

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
  packages/
    types/        Geteilte TypeScript-Typen (re-exportiert Prisma-Typen)
  prisma/
    schema.prisma Datenmodell
    migrations/   Versionierte SQL-Migrationen
    seed.ts       Seed-Daten
  docker/         Dockerfiles (Produktion)
  docker-compose.dev.yml   Entwicklungs-Stack (Hot-Reload)
  docker-compose.yml       Produktions-Stack
```

## Schnellstart (Docker, empfohlen)

Voraussetzung: Docker mit Compose-Plugin.

```bash
cp .env.example .env        # Werte bei Bedarf anpassen
docker compose -f docker-compose.dev.yml up --build
```

Beim ersten Start werden automatisch Abhängigkeiten installiert, die Datenbank
migriert und Seed-Daten eingespielt. Anschließend erreichbar:

| Dienst             | URL                              |
| ------------------ | -------------------------------- |
| Web-Frontend       | http://localhost:3800            |
| API (Health-Check) | http://localhost:3801/api        |
| API-Doku (Swagger) | http://localhost:3801/api/docs   |
| MinIO Console      | http://localhost:9001            |

## Lokale Entwicklung (ohne Docker)

```bash
pnpm install
# PostgreSQL + MinIO bereitstellen, DATABASE_URL in .env auf localhost setzen
pnpm prisma generate
pnpm prisma migrate deploy   # oder: pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                     # startet web + api parallel
```

## Standard-Zugangsdaten (Seed)

| Rolle           | E-Mail              | Passwort   |
| --------------- | ------------------- | ---------- |
| SUPERADMIN      | admin@office.local  | `admin123` |
| OFFICE          | buero@office.local  | `buero123` |
| PROJECT_MANAGER | pl@office.local     | `pl123`    |

Beispiel-Monteur „Max Muster" – **PIN: `123456`** (Login über `/api/auth/pin-login`).

> ⚠️ Diese Zugangsdaten sind nur für die Entwicklung gedacht.

## Nützliche Skripte (Root)

| Befehl                  | Beschreibung                          |
| ----------------------- | ------------------------------------- |
| `pnpm dev`              | web + api im Watch-Modus              |
| `pnpm build`            | alle Pakete bauen                     |
| `pnpm lint`             | Lint/Typecheck über alle Pakete       |
| `pnpm prisma:migrate`   | Migration erstellen/anwenden (dev)    |
| `pnpm prisma:seed`      | Seed-Daten einspielen                 |
| `pnpm prisma:studio`    | Prisma Studio öffnen                  |

## API-Überblick (Auftrag #1)

- `GET  /api` – Health-Check
- `POST /api/auth/login` – E-Mail + Passwort → JWT
- `POST /api/auth/pin-login` – Monteur-PIN → JWT (`type: worker`)
- `POST /api/auth/logout` – Session invalidieren
- `POST /api/auth/refresh` – Token erneuern
- `GET/POST/PATCH/DELETE /api/users` – Benutzerverwaltung (nur SUPERADMIN)

Authentifizierung per `Authorization: Bearer <token>`. Routen sind standardmäßig
geschützt (globaler `JwtAuthGuard`); öffentliche Routen sind mit `@Public()` markiert.
