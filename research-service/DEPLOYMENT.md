# Research-Microservice – Deployment

## Voraussetzungen

- Docker und Docker Compose
- Externes Docker-Netzwerk `vivahome`:
  ```bash
  docker network create vivahome
  ```
- API-Keys als Umgebungsvariablen

## Konfiguration

`.env`-Datei im Projektverzeichnis anlegen:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...         # optional, für Fallback
RESEARCH_API_KEY=ein-sicherer-api-key
```

## Start

```bash
docker compose up --build -d
```

## Health-Check

```bash
curl http://localhost:5900/health
```

## API-Nutzung

```bash
curl -X POST http://localhost:5900/research/company \
  -H "Content-Type: application/json" \
  -H "x-api-key: ein-sicherer-api-key" \
  -d '{"url": "https://example.de", "include_social_media": true}'
```

## Netzwerk

Der Service ist im `vivahome`-Netzwerk unter `research-service:8000` erreichbar.
Die Office-API kann den Service darüber direkt ansprechen.

## Port-Mapping

| Container-Port | Host-Port | Beschreibung     |
|----------------|-----------|------------------|
| 8000           | 5900      | API (nur lokal)  |
