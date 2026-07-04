# Office — Deployment

Dieses Dokument beschreibt den vollständigen Weg

```
Development-PC  →  GitHub (Office)  →  Server /opt/office  →  Docker Production
```

mit klarer Aufgabenteilung:

| Wer | Macht |
|---|---|
| **Development-PC** | Codeänderungen, Tests, `git commit`, `git push`, Deploy auslösen via `abgleich/office.sh` |
| **GitHub** | Übergabestelle. Einzige Quelle, aus der der Server zieht. |
| **Server** | `git pull`, Docker Build, `prisma migrate deploy`, Container-Start. **Kein** `git push`, **keine** Codeänderungen. |

---

## Domain & Pfade

- Domain App: `office.vivahome.de`
- Domain MinIO Console: `minio.office.vivahome.de`
- Server-App-Pfad: `/opt/office`
- GitHub-Repo: `https://github.com/vengelst/office.git`
- Branch: `main`

---

## Ports (Server, localhost-only)

| Service | Interner Port | Externer Port | Zweck |
|---|---|---|---|
| Web (Next.js) | 3800 | `127.0.0.1:5700` | Frontend |
| API (NestJS) | 3801 | `127.0.0.1:5701` | Backend-API |
| MinIO API | 9000 | `127.0.0.1:5702` | S3-kompatibel |
| MinIO Console | 9001 | `127.0.0.1:5703` | Web-UI |
| PostgreSQL | 5432 | keiner | Nur internes Docker-Netz |

Nginx proxiert von außen:

- `office.vivahome.de/api` → `127.0.0.1:5701`
- `office.vivahome.de/*` → `127.0.0.1:5700`
- `minio.office.vivahome.de` → `127.0.0.1:5703`

---

## Einmalig — Server

```bash
sudo mkdir -p /opt/office
sudo chown -R $USER:$USER /opt/office
git clone https://github.com/vengelst/office.git /opt/office
cd /opt/office

cp .env.production.example .env.production
nano .env.production            # echte Secrets eintragen
chmod 600 .env.production

chmod +x deploy/server-deploy.sh
./deploy/server-deploy.sh \
    --repo-url https://github.com/vengelst/office.git \
    --branch main \
    --path /opt/office
```

`.env.production` muss ausgefüllt sein **bevor** das Skript läuft, sonst bricht es ab.

### Pflichtfelder in `.env.production`

| Variable | Hinweis |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | DB-Credentials |
| `DATABASE_URL` | Muss zur DB-Service-Konfiguration passen, Host = `postgres` |
| `JWT_SECRET` | Lang, zufällig. z. B. `openssl rand -hex 48` |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | MinIO-Zugangsdaten |
| `NEXT_PUBLIC_API_URL` | `https://office.vivahome.de/api` |
| `WEB_ORIGIN` | `https://office.vivahome.de` |

### Nginx + TLS

```bash
# Office
sudo cp /opt/office/deploy/nginx/office.vivahome.de.conf \
        /etc/nginx/sites-available/office.vivahome.de.conf
sudo ln -s /etc/nginx/sites-available/office.vivahome.de.conf \
           /etc/nginx/sites-enabled/office.vivahome.de.conf

# MinIO Console
sudo cp /opt/office/deploy/nginx/minio.office.vivahome.de.conf \
        /etc/nginx/sites-available/minio.office.vivahome.de.conf
sudo ln -s /etc/nginx/sites-available/minio.office.vivahome.de.conf \
           /etc/nginx/sites-enabled/minio.office.vivahome.de.conf

sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d office.vivahome.de -d minio.office.vivahome.de
```

---

## Laufender Deploy von lokal

Vom Development-PC aus:

```bash
./abgleich/office.sh
```

Interaktives Menü:

| Option | Wirkung |
|---|---|
| 1 | Committen + Pushen nach GitHub |
| 2 | Pushen + Server deployen (Build + Migrate + Start) |
| 3 | Deploy-Konfiguration anzeigen/ändern |
| 5 | Nur Nginx-Konfiguration auf Server |
| 6 | App neu starten (kein Build) |

### Deploy-Ablauf (Option 2)

1. **Lokal**: `git add -A`, `git commit`, `git push origin main`
2. **Server**: SSH-Befehl startet `deploy/server-deploy.sh`
3. **Server**: `git fetch` + `git reset --hard origin/main`
4. **Server**: `docker compose -f docker-compose.prod.yml --env-file .env.production build`
5. **Server**: PostgreSQL + MinIO starten, auf healthy warten
6. **Server**: API-Container starten (führt `prisma migrate deploy` + `prisma db seed` aus)
7. **Server**: Web-Container starten
8. **Server**: `docker compose ps` + Logs

---

## Server — direkter Zugriff

```bash
cd /opt/office
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 postgres
```

### Was auf dem Server **nie** passieren darf

- `git push` aus `/opt/office` heraus
- Codeänderungen direkt auf dem Server
- `docker compose down -v`  ⟶ würde Postgres- und MinIO-Volumes löschen
- `pnpm dev` oder `prisma migrate dev`
- Echte Secrets in eine getrackte Datei einchecken

---

## Sicherheitsregeln (Kurzfassung)

- `.env`, `.env.production`, `.env.local` sind in `.gitignore` ausgeschlossen
- `.env.production.example` ist die einzige Env-Datei im Repo
- App-Container exponieren ihre Ports **nur** auf `127.0.0.1` — Nginx ist die einzige öffentliche Schnittstelle
- Postgres-Container exponiert keinen Port nach außen
- `docker compose down -v` ist im Server-Skript nirgends enthalten
- `prisma migrate deploy` (additiv, sicher) statt `migrate dev` (kann DB resetten)
