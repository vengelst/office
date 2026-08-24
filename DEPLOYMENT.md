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
- Domain Kiosk: `work.vivahome.de` (Root → `/kiosk`; Setup/Terminal/PL)
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
- `work.vivahome.de/api` → `127.0.0.1:5701` (gleiche API)
- `work.vivahome.de/*` → `127.0.0.1:5700` (Next; Middleware erzwingt Kiosk)
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
| `WEB_ORIGIN` | `https://office.vivahome.de,https://work.vivahome.de` |

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

# Kiosk (work)
sudo cp /opt/office/deploy/nginx/work.vivahome.de.conf \
        /etc/nginx/sites-available/work.vivahome.de.conf
sudo ln -s /etc/nginx/sites-available/work.vivahome.de.conf \
           /etc/nginx/sites-enabled/work.vivahome.de.conf

sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d office.vivahome.de -d minio.office.vivahome.de
sudo certbot --nginx -d work.vivahome.de
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

## SSH-Zugang (Produktion)

| Feld | Wert |
|---|---|
| Host / IP | `vivahome.de` bzw. `109.199.112.176` (Hostname `vmd200614`) |
| User | `root` |
| **SSH-Port** | **`2805`** (nicht 22 — von Cloud/außen oft Timeout) |
| App-Pfad | `/opt/office` |

```bash
# Vom Mac / lokal
ssh -p 2805 root@109.199.112.176
# oder
ssh -p 2805 root@vivahome.de
```

Damit Tools ohne `-p` (z. B. `abgleich/office.sh`) funktionieren, lokal in `~/.ssh/config`:

```
Host vivahome.de 109.199.112.176
  User root
  Port 2805
```

### `authorized_keys` auf dem Server

Datei: `/root/.ssh/authorized_keys`  
Jede Zeile = genau ein Key. **Keine** Dateipfade, Screenshot-Namen oder Zeilenumbrüche mitten in der Key-Zeile.

Typische Einträge (Stand 2026-08-24):

| Kommentar am Zeilenende | Zweck |
|---|---|
| `volkhard@macbook` | Lokaler Mac (Standard-Deploy) |
| `office-api-monitor` | Monitoring |
| `cursor-cloud-agent` | Vorgesehener Cloud-Key (Private Key muss zur Umgebung passen) |
| `cursor-cloud-office-deploy` | Cursor-Cloud-Agent (Keypaar in der Cloud-VM) |

**Aktueller Cloud-Deploy-Public-Key** (VM-Datei `~/.ssh/id_ed25519_office_deploy`):

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHEIjZdqg3/4jmozOADs/Ft7QYCeAY7EyN0nbn/gQjFK cursor-cloud-office-deploy
```

Freischalten (auf dem Server, z. B. aus Mac-SSH-Session):

```bash
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHEIjZdqg3/4jmozOADs/Ft7QYCeAY7EyN0nbn/gQjFK cursor-cloud-office-deploy' >> /root/.ssh/authorized_keys
```

Test vom Cloud-Agenten:

```bash
ssh -p 2805 -i ~/.ssh/id_ed25519_office_deploy root@109.199.112.176 hostname
# erwartet: vmd200614
```

### Cursor Cloud Agent vs. lokaler Mac

| Umgebung | SSH zum Server |
|---|---|
| **Mac-Terminal / lokaler Cursor-Agent** | Ja — Key `volkhard@macbook` (`ssh-add --apple-use-keychain ~/.ssh/id_ed25519`) |
| **Cursor Cloud Agent (AWS-VM)** | Nur mit **eigenem** Keypaar in der VM + Public Key in `authorized_keys`. Weitergeleiteter Mac-Agent liefert oft `agent refused operation` (kein Signieren). `ping` scheitert oft (`CAP_NET_RAW`) — normal; `curl`/`ssh` nutzen. |

Cloud-Agent: Key in der VM erzeugen, Public Key auf dem Server eintragen:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_office_deploy -N '' -C 'cursor-cloud-office-deploy'
cat ~/.ssh/id_ed25519_office_deploy.pub
```

Empfohlene SSH-Config in der Cloud-VM (`~/.ssh/config`):

```
Host office
  HostName 109.199.112.176
  User root
  Port 2805
  IdentityFile ~/.ssh/id_ed25519_office_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
```

Danach: `ssh office`.

**Hinweis:** Cloud-VMs sind ephemer. Nach neuem Agent-Lauf ggf. neues Keypaar + erneuter `authorized_keys`-Eintrag (oder Private Key dauerhaft im Cursor-Environment hinterlegen).

### Was 2026-08-24 passiert ist (Kurzprotokoll)

1. Cloud-Agent: Port **22** Timeout; SSH lauscht auf **2805**.
2. Mac-Key lokal ok; Agent-Forwarding in die Cloud-VM signierte nicht (`agent refused operation`).
3. Neues Keypaar `id_ed25519_office_deploy` in der Cloud-VM; Public Key in `authorized_keys` → SSH ok.
4. `authorized_keys` kurz durch Screenshot-Pfad in Zeile 1 beschädigt — bereinigt.
5. `/root/kiosk.apk` überschreibt **nicht** `/root/.ssh` (`ls -l` blendet Dotfiles aus).
6. Deploy `main` (PR #19 Master-Tätigkeitsbereiche); API ok; ActivityTypes geseedet.

### Direkter Deploy per SSH

Skript: `deploy/server-deploy.sh` (Flags: `--repo-url`, `--branch`, `--path`, optional `--force-reset`).

```bash
ssh -p 2805 root@109.199.112.176 'cd /opt/office && bash deploy/server-deploy.sh --repo-url https://github.com/vengelst/office.git --branch main --path /opt/office'
```

Lokale Server-Änderungen verwerfen (z. B. nach `sed`):

```bash
ssh -p 2805 root@109.199.112.176 'cd /opt/office && bash deploy/server-deploy.sh --repo-url https://github.com/vengelst/office.git --branch main --path /opt/office --force-reset'
```

Bei `/usr/bin/env: 'bash\r'`: CRLF entfernen (`sed -i 's/\r$//' deploy/server-deploy.sh`) und/oder `bash deploy/server-deploy.sh …` nutzen.

---

## Server — direkter Zugriff

```bash
cd /opt/office
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 postgres
```

### Kiosk-APK (Download)

Die APK liegt **außerhalb** des Images und wird per Bind-Mount eingehängt:

| Host | Container |
|---|---|
| `/opt/office/data/kiosk.apk` | `/app/apps/web/public/kiosk.apk` (ro) |

Einmalig / nach neuem EAS-Build:

```bash
mkdir -p /opt/office/data
# von lokal (Port 2805):
scp -P 2805 apps/mobile/kiosk.apk root@109.199.112.176:/opt/office/data/kiosk.apk
# oder vom Server, falls die Datei noch unter /root liegt:
cp -n /root/kiosk.apk /opt/office/data/kiosk.apk
```

**Hinweis:** `/root/kiosk.apk` überschreibt **nicht** `/root/.ssh` (`ls -l` blendet Dotfiles aus).

Die Datei muss vor dem Web-Container-Start unter `/opt/office/data/kiosk.apk` liegen (sonst erzeugt Docker ein Verzeichnis).

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
