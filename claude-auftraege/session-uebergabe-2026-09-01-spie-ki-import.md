# Session-Übergabe – SPIE-Import & KI-Kontakt-Import (#24/#25)

**Stand:** 2026-09-01 · **Prod:** `office.vivahome.de` · Branch `main` · Version **1.0.1**  
**Zweck:** Projektwechsel – alles Wichtige für die Fortsetzung hier.

---

## Kurz: Was in dieser Arbeitsserie passiert ist

1. **Interessenten-Import diskutiert** – heterogene Listen, kein klassischer CSV-Importer; pragmatisch Agent oder später KI in der App.
2. **SPIE-PDF analysiert** (`SPIE_Kontaktliste_und_Outreach.pdf` in Google Drive unter Potential) – Vorschau ohne DB-Write.
3. **Manueller SPIE-Import auf Prod** – Kunde **SPIE** `K-2026-0012`, Kontakte + Firmen-E-Mails; Google-Sync aus. Skript: `scripts/import-spie-outreach.cjs`.
4. **Deploy-Unfall** – Compose **ohne** `--env-file .env.production` → leere DB-Credentials, API-Crash, Web mit `localhost:3801` gebacken → App wirkte „leer“. Datenvolumen war intakt.
5. **Reparatur** – Stack mit `--env-file` neu gestartet; Web neu gebaut; Daten wieder sichtbar. Regel: **immer** `--env-file .env.production`.
6. **Cloud #24** – KI-Import in der App (Settings + Preview/Commit + NL-Web-Anreicherung). PR #21, auf Prod.
7. **Review** – Lücken: keine Transaction, NOT_FOUND merge Adressen, COMPANY_EMAIL als Person.
8. **Cloud #25** – harte Fixes. PR #22 (+1518/−413), auf Prod.
9. **KI-Anbindung Prod** (Stand 27.08. Abend / bestätigt später): aktiv, OpenAI `gpt-4.1-mini`, Key hinterlegt, `/settings/ai/test` grün.
10. **SPIE-KI-Import End-to-End** – vom Nutzer noch nicht final durchgetestet (Key war zwischendurch leer; danach nur Connection-Test).

---

## Live auf Prod (relevant)

| Thema | Status |
|--------|--------|
| Kunde SPIE `K-2026-0012` | angelegt (manueller Import) |
| Feature KI-Import (#24+#25) | Code live |
| Einstellungen → KI | konfiguriert & Test OK (Stand Prüfung) |
| Research/OCR (älter) | weiter über Env, **separat** vom KI-Import |

**UI:**
- Einstellungen → **KI**
- Kunden → **KI-Import** (Upload → Preview → Freigabe)

**API:**
- `GET/PUT /settings/ai`, `POST /settings/ai/test`
- `POST /ai-import/contacts/preview`, `POST /ai-import/contacts/commit`

---

## Wichtige Betriebsregeln (nicht vergessen)

```bash
# Deploy IMMER so (sonst wieder „leere App“):
cd /opt/office && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d

# SSH: ve@vivahome.de Port 2805, Admin mit sudo -n
# Nie: compose ohne --env-file; nie down -v
```

- Cloud-Agenten können oft **nicht** SSH-deployen (Key) → Deploy vom Mac-Agent.
- `deploy/server-deploy.sh` hatte CRLF → LF gefixt (Commit `337bbbe`).

---

## Specs / Code

| Artefakt | Pfad |
|----------|------|
| Auftrag #24 | `claude-auftraege/claude-arbeitsitems-24-ki-kontakt-import.md` |
| Auftrag #25 | `claude-auftraege/claude-arbeitsitems-25-ki-import-fixes.md` |
| Backlog | `claude-auftraege/offen-backlog.md` |
| API-Modul | `apps/api/src/ai-import/` |
| UI Dialog | `apps/web/src/components/customers/ai-import-dialog.tsx` |
| Settings UI | `apps/web/src/app/(authenticated)/settings/ai/` |
| Notfall-Skript SPIE | `scripts/import-spie-outreach.cjs` |

---

## Offen / nächste Schritte Office

1. **KI-Import mit SPIE-PDF einmal End-to-End testen** (Preview, NL-Adressen, Commit) – fachliche Abnahme.
2. Bei Bedarf: weitere Listen über KI-Import statt Agent-Skript.
3. Cloud **#20** Google Calendar (Spec startklar) – Google Admin Calendar-Scope.
4. Phase 2 Calendar / UNIT_BASED wie bisher im Backlog.

---

## Chat-Referenz

Cursor-Chat: „Office: SPIE + KI-Import #24/#25“ (diese Session-Serie).
