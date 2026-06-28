# Claude Code – Auftrag #1: Projekt-Fundament

## Kontext

Dieses Projekt ist eine neue Webanwendung ("Office") für CRM, Projektverwaltung, Monteurverwaltung, mobile Zeiterfassung mit GPS, Wochen-Stundenzettel mit Signatur, Dokumentenmanagement und Kiosk-/PIN-Modus. Max. 20 Benutzer.

## Auftrag

Erstelle das komplette Projekt-Fundament. Nach Abschluss muss `docker compose up` einen lauffähigen Stack starten mit:
- Web-Frontend unter http://localhost:3800
- API-Backend unter http://localhost:3801/api
- PostgreSQL-Datenbank
- MinIO (S3-kompatibler Storage)

---

## 1. Repo-Struktur (Monorepo mit pnpm Workspaces, OHNE Turborepo)

```
office/
  apps/
    web/                → Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui
    api/                → NestJS + TypeScript
  packages/
    types/              → Shared TypeScript Types (re-exportiert Prisma-Types)
  prisma/
    schema.prisma       → Komplettes Datenmodell (siehe unten)
  docker/
    Dockerfile.web
    Dockerfile.api
  docker-compose.yml          → Produktion
  docker-compose.dev.yml      → Entwicklung (Hot-Reload, Volumes)
  pnpm-workspace.yaml
  package.json                → Root: Scripts für dev, build, lint
  .env.example
  .gitignore
  README.md
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 2. Prisma-Schema (komplett)

Erstelle `prisma/schema.prisma` mit ALLEN folgenden Modellen. Verwende `cuid()` als Default-ID. Verwende `@updatedAt` wo sinnvoll. Setze Soft-Delete (`deletedAt DateTime?`) bei Kunden, Projekten. Verwende Enums konsequent.

### Enums

```prisma
enum RoleCode { SUPERADMIN, OFFICE, PROJECT_MANAGER, WORKER }
enum CustomerStatus { ACTIVE, INACTIVE }
enum ProjectStatus { DRAFT, PLANNED, ACTIVE, PAUSED, COMPLETED, CANCELED }
enum ServiceType { VIDEO, ELECTRICAL, SERVICE, OTHER }
enum Priority { LOW, MEDIUM, HIGH, URGENT }
enum BreakScopeType { GLOBAL, PROJECT }
enum TimeEntryType { CLOCK_IN, CLOCK_OUT, MANUAL_ADJUSTMENT }
enum GpsEventType { CLOCK_IN, CLOCK_OUT, MANUAL }
enum WeeklyTimesheetStatus { DRAFT, WORKER_SIGNED, CUSTOMER_SIGNED, COMPLETED, LOCKED }
enum SignerType { WORKER, CUSTOMER }
enum DocumentType { PHOTO, DELIVERY_NOTE, INVOICE, PROJECT_DOC, OTHER }
enum EquipmentCategory { TOOL, PSA, ELECTRONICS, OTHER }
```

### Modelle (fachliche Mindestfelder)

**Identity / System:**
- `User`: id, email (unique), passwordHash, displayName, notes?, isActive, createdAt, updatedAt → Relationen zu UserRole, AuditLog
- `Role`: id, code (RoleCode, unique), name, description?
- `UserRole`: id, userId, roleId → unique([userId, roleId])
- `Permission`: id, code (unique), description?
- `RolePermission`: id, roleId, permissionId → unique([roleId, permissionId])
- `Session`: id, userId, token, expiresAt, createdAt
- `AuditLog`: id, actorUserId?, actorType, entityType, entityId, action, beforeJson?, afterJson?, createdAt
- `Setting`: id, key (unique), valueJson, updatedAt

**CRM:**
- `Customer`: id, customerNumber (unique), companyName, legalForm?, status (CustomerStatus), billingEmail?, phone?, email?, website?, vatId?, addressLine1?, addressLine2?, postalCode?, city?, country?, notes?, createdAt, updatedAt, deletedAt?
- `CustomerBranch`: id, customerId (FK), name, addressLine1?, addressLine2?, postalCode?, city?, country?, phone?, email?, notes?, active (default true)
- `CustomerContact`: id, customerId (FK), branchId? (FK), firstName, lastName, role?, email?, phoneMobile?, phoneLandline?, isAccountingContact (default false), isProjectContact (default false), isSignatory (default false), notes?
- `CustomerNote`: id, customerId (FK), body, createdByUserId (FK), createdAt
- `CustomerCallLog`: id, customerId (FK), contactId? (FK), projectId? (FK), subject, callDate, direction, summary, nextAction?, createdByUserId (FK), createdAt

**Projects:**
- `Project`: id, projectNumber (unique), customerId (FK), branchId? (FK), title, description?, serviceType (ServiceType), status (ProjectStatus), priority (Priority), siteName?, siteAddressLine1?, sitePostalCode?, siteCity?, siteCountry?, accommodationAddress?, plannedStartDate?, plannedEndDate?, actualStartDate?, actualEndDate?, internalProjectManagerUserId? (FK), primaryCustomerContactId? (FK), pauseRuleId? (FK), notes?, createdAt, updatedAt, deletedAt?
- `ProjectNote`: id, projectId (FK), body, createdByUserId (FK), createdAt
- `ProjectAssignment`: id, projectId (FK), workerId (FK), roleName?, startDate, endDate?, active (default true), notes?
- `ProjectEmailRecipient`: id, projectId (FK), email, recipientType, name?

**Workers:**
- `Worker`: id, workerNumber (unique), firstName, lastName, email?, phone?, addressLine1?, addressLine2?, postalCode?, city?, country?, nationality?, languageCode?, active (default true), photoPath?, emergencyContact?, qualifications?, hasDriversLicense (default false), notes?, userId? (FK, optional link to User), createdAt, updatedAt
- `WorkerPin`: id, workerId (FK), pinHash, validFrom, validTo?, isActive (default true), createdAt

**Vehicles / Equipment:**
- `Vehicle`: id, licensePlate (unique), make?, model?, internalName?, active (default true), notes?
- `WorkerVehicleAssignment`: id, workerId (FK), vehicleId (FK), assignedFrom, assignedTo?, notes?
- `EquipmentItem`: id, itemNumber (unique), category (EquipmentCategory), name, serialNumber?, trackable (default false), active (default true), notes?
- `WorkerEquipmentIssue`: id, workerId (FK), equipmentItemId (FK), issuedAt, returnedAt?, conditionOut?, conditionIn?, notes?

**Time Tracking:**
- `BreakRule`: id, scopeType (BreakScopeType), projectId? (FK), name, autoDeductEnabled (default true), thresholdMinutes1, breakMinutes1, thresholdMinutes2?, breakMinutes2?, active (default true)
- `TimeEntry`: id, workerId (FK), projectId (FK), entryType (TimeEntryType), occurredAtClient, occurredAtServer (default now()), latitude?, longitude?, accuracy?, comment?, sourceDevice?, createdByUserId? (FK), createdAt
- `GpsEvent`: id, workerId (FK), projectId? (FK), relatedTimeEntryId? (FK), latitude, longitude, accuracy?, recordedAt, eventType (GpsEventType)

**Timesheets:**
- `WeeklyTimesheet`: id, workerId (FK), projectId (FK), weekYear, weekNumber, status (WeeklyTimesheetStatus, default DRAFT), totalMinutesGross?, totalBreakMinutes?, totalMinutesNet?, generatedAt (default now()), lockedAt? → unique([workerId, projectId, weekYear, weekNumber])
- `WeeklyTimesheetDay`: id, weeklyTimesheetId (FK), workDate, firstClockInAt?, lastClockOutAt?, grossMinutes?, breakMinutes?, netMinutes?, summaryComment?, clockInLatitude?, clockInLongitude?, clockOutLatitude?, clockOutLongitude?
- `WeeklyTimesheetSignature`: id, weeklyTimesheetId (FK), signerType (SignerType), signerName, signerRole?, signatureImagePath, signedAt (default now()), ipAddress?, deviceInfo?

**Documents:**
- `Document`: id, storageKey, originalFilename, mimeType, fileSize, uploadedByUserId? (FK), documentType (DocumentType), title?, description?, createdAt
- `DocumentLink`: id, documentId (FK), entityType, entityId

**Communication:**
- `EmailLog`: id, recipientEmail, subject, body?, attachmentPath?, sentAt?, status, errorMessage?, relatedEntityType?, relatedEntityId?, createdAt

---

## 3. Docker Compose (Dev)

`docker-compose.dev.yml`:
- **postgres**: PostgreSQL 16, Port 5432, Volume für Persistenz
- **minio**: MinIO, Ports 9000 + 9001 (Console), Volume
- **api**: NestJS mit Hot-Reload (Volume-Mount von apps/api/src), Port 3801, depends_on postgres + minio
- **web**: Next.js mit Hot-Reload (Volume-Mount von apps/web/src), Port 3800, depends_on api

Umgebungsvariablen über `.env`-Datei. Erstelle `.env.example` mit allen benötigten Variablen:
- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
- NEXT_PUBLIC_API_URL

---

## 4. NestJS API (apps/api)

### Grundstruktur:
```
apps/api/
  src/
    main.ts
    app.module.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      dto/
        login.dto.ts
        pin-login.dto.ts
      guards/
        jwt-auth.guard.ts
        roles.guard.ts
      decorators/
        roles.decorator.ts
        current-user.decorator.ts
      strategies/
        jwt.strategy.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
    common/
      filters/
        http-exception.filter.ts
      interceptors/
        audit-log.interceptor.ts
  package.json
  tsconfig.json
  nest-cli.json
```

### Auth-Modul implementieren:
- **POST /auth/login** – E-Mail + Passwort → JWT
- **POST /auth/pin-login** – Worker-PIN → JWT (mit type: 'worker', workerId)
- **POST /auth/logout** – Session invalidieren
- **POST /auth/refresh** – Token erneuern
- JWT enthält: sub (userId oder workerId), type ('user' | 'worker'), roles[]
- Passwörter mit bcrypt hashen
- PINs mit bcrypt hashen (6-stellig)
- `RolesGuard` prüft @Roles()-Decorator gegen JWT-Rollen
- Globaler `JwtAuthGuard` mit @Public()-Decorator für offene Routes

### Users-Modul:
- **GET /users** – alle Benutzer (nur SUPERADMIN)
- **POST /users** – Benutzer anlegen (nur SUPERADMIN)
- **PATCH /users/:id** – Benutzer bearbeiten
- **DELETE /users/:id** – Benutzer deaktivieren

### Globale Konfiguration:
- ValidationPipe global (class-validator + class-transformer)
- CORS für localhost:3800
- Prefix: `/api`
- Swagger/OpenAPI Setup (optional aber empfohlen)

---

## 5. Next.js Frontend (apps/web)

### Grundstruktur:
```
apps/web/
  src/
    app/
      layout.tsx          → Root Layout mit ThemeProvider, Sidebar
      page.tsx            → Dashboard (Platzhalter)
      login/
        page.tsx          → Login-Seite
      (authenticated)/
        layout.tsx        → Authenticated Layout mit Sidebar
        dashboard/
          page.tsx
        customers/
          page.tsx        → Platzhalter "Kunden"
        projects/
          page.tsx        → Platzhalter "Projekte"
        workers/
          page.tsx        → Platzhalter "Monteure"
        timesheets/
          page.tsx        → Platzhalter "Stundenzettel"
        settings/
          page.tsx        → Platzhalter "Einstellungen"
    components/
      ui/                 → shadcn/ui Komponenten
      layout/
        sidebar.tsx       → Hauptnavigation
        header.tsx        → Top-Bar mit User-Info, Theme-Toggle
        theme-provider.tsx
    lib/
      api-client.ts       → Fetch-Wrapper für API-Calls (mit JWT)
      auth-context.tsx    → Auth-State (Login/Logout/Token)
      utils.ts
  tailwind.config.ts
  next.config.ts
  package.json
  tsconfig.json
```

### UI-Anforderungen:
- **Dark/Light Mode** mit next-themes + shadcn/ui Theme-System
- **Sidebar-Navigation** mit Icons: Dashboard, Kunden, Projekte, Monteure, Stundenzettel, Einstellungen
- **Login-Seite**: E-Mail + Passwort, modern, zentriert
- **Responsiv**: Sidebar kollabiert auf Mobile zu Hamburger-Menu
- **Stil**: nüchtern, professionell, kompakt – keine verspielten Elemente
- **shadcn/ui Komponenten installieren**: Button, Input, Card, Table, Dialog, Dropdown, Tabs, Badge, Toast

### Auth-Flow:
- JWT in httpOnly Cookie oder localStorage (Pragmatisch: localStorage für V1)
- Auth-Context mit Login/Logout/isAuthenticated
- Geschützte Routes leiten auf /login um wenn kein Token
- Nach Login: Redirect zu /dashboard

---

## 6. Seed-Daten

Erstelle `prisma/seed.ts` mit:
- **Rollen**: SUPERADMIN, OFFICE, PROJECT_MANAGER, WORKER
- **Permissions**: customers.view, customers.create, customers.edit, customers.delete, projects.view, projects.create, projects.edit, projects.delete, workers.view, workers.create, workers.edit, workers.delete, timesheets.view, timesheets.create, timesheets.sign, settings.manage, users.manage
- **RolePermissions**: SUPERADMIN bekommt alle, OFFICE bekommt alle außer users.manage, PROJECT_MANAGER bekommt view + projects.edit + timesheets.*, WORKER bekommt nur eigene views
- **Admin-User**: admin@office.local / admin123 (SUPERADMIN)
- **Büro-User**: buero@office.local / buero123 (OFFICE)
- **Projektleiter**: pl@office.local / pl123 (PROJECT_MANAGER)
- **Beispiel-Kunde**: "Mustermann GmbH" mit einer Niederlassung und einem Ansprechpartner
- **Beispiel-Projekt**: "Videoüberwachung Hauptsitz" (Status: ACTIVE)
- **Beispiel-Monteur**: Max Muster, PIN: 123456, zugeordnet zum Beispielprojekt
- **Beispiel-BreakRule**: Global, ab 360min → 30min Pause, ab 540min → 45min Pause
- **Beispiel-Fahrzeug**: "B-OF 1234", VW Transporter

---

## 7. Erwartetes Ergebnis

Nach `docker compose -f docker-compose.dev.yml up --build`:
1. PostgreSQL startet, Prisma-Migrationen laufen automatisch
2. Seed-Daten werden eingespielt
3. API antwortet auf http://localhost:3801/api (Health-Check GET /api → 200)
4. Web startet unter http://localhost:3800
5. Login mit admin@office.local / admin123 funktioniert
6. Nach Login: Dashboard mit Sidebar-Navigation sichtbar
7. Dark/Light Toggle funktioniert
8. Alle Platzhalter-Seiten (Kunden, Projekte, etc.) sind erreichbar

---

## 8. Technische Regeln

- Keine hartcodierten deutschen Texte in Komponenten → alle UI-Texte als Konstanten in einer zentralen Datei (Vorbereitung i18n)
- TypeScript strict mode
- Alle Eingaben serverseitig validieren (class-validator DTOs)
- Keine `any`-Types
- Prisma Client als Singleton im NestJS-Modul
- Fehlerhafte API-Calls geben strukturierte JSON-Fehlermeldungen zurück
- `.env.example` mit allen Variablen und Kommentaren

---

## 9. NICHT in diesem Auftrag

- Kein CRUD für Kunden/Projekte/Monteure (kommt in Auftrag #2)
- Keine Zeiterfassungs-Logik
- Kein PDF-Export
- Kein E-Mail-Versand
- Keine Mobile-App / PWA
- Kein Kiosk-Modus
- Keine Tests (kommen später)
