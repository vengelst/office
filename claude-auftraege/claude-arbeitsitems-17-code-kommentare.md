# Cloud-Auftrag #17: Ausführliche deutsche JSDoc/TSDoc-Kommentare

## Kontext

Repo: Office-Monorepo (pnpm), NestJS-API (`apps/api`) und Next.js-Web (`apps/web`).
Produktion: `office.vivahome.de` (`/opt/office`).

Ziel ist bessere Wartbarkeit und Onboarding: exportierte Klassen, Funktionen, Methoden und Interfaces sollen **ausführlich auf Deutsch** dokumentiert sein (Was/Warum, `@param`, `@returns`, `@throws` wo sinnvoll). Dateiköpfe ergänzen.

**Keine** Logik-, API- oder UI-Änderungen. Keine Refactors. Kein Format-only außer Kommentaren.

---

## Ziel

Nach Abschluss:

1. **P0** `apps/api/src/`: alle `*.service.ts`, `*.controller.ts`, wichtige utils/guards/config mit ausführlichen DE-JSDocs + Dateiköpfen.
2. **P1** `apps/web/src/lib/**/*.ts` und `apps/web/src/components/layout/**` ebenso.
3. **P2** (Kapazität): große components/pages – nur Dateikopf + exportierte Komponenten + nicht-triviale Handler, kein Zeilen-Spam.
4. Bereits gute JSDocs **erweitern**, nicht verschlechtern. Keine trivialen Zeilenkommentare (`// i++`).
5. `api` + `web` Build bzw. `tsc` grün.

---

## Nicht-Ziele

- Verhalten ändern, Refactors, reine Formatierung
- `apps/mobile` (außer zwingend nötig)
- `seed.ts` romanhaft kommentieren
- `dist/`, `.next/`

---

## Scope-Priorität

### P0 – API

- Alle `*.service.ts` und `*.controller.ts` unter `apps/api/src/`
- Guards, Decorators, Filters, Interceptors, wichtige Utils/Config:
  - `auth/guards/*`, `auth/decorators/*`
  - `common/filters/*`, `common/interceptors/*`, `common/slug.util.ts`, `common/storage-path.service.ts`
  - `invoices/company.config.ts`, `timesheets/timesheet.util.ts`

### P1 – Web Lib + Layout

- `apps/web/src/lib/**/*.ts` (inkl. `texts/` – Dateikopf + Export-Übersicht, keine Kommentarflut pro String)
- `apps/web/src/components/layout/**`

### P2 – Kapazität

- Große Components/Pages: Dateikopf + exportierte Komponenten + nicht-triviale Handler

---

## Kommentar-Standard

```ts
/**
 * Kurzbeschreibung: Was die Einheit tut und warum sie existiert.
 *
 * @param name - Bedeutung und erwartete Werte/Constraints
 * @returns Was zurückkommt (Form/Semantik)
 * @throws {NotFoundException} Wann und warum
 */
```

- Sprache: **Deutsch**
- Dateikopf: Modulzweck, Domänenbezug (1–5 Zeilen)
- Private Helfer nur kommentieren, wenn nicht-trivial
- Swagger-`@ApiOperation` bleibt; JSDoc ergänzt, ersetzt nicht

---

## Abschlusskriterien

- [ ] Branch von `main`, Commits, PR gegen `main`
- [ ] P0 + P1 weitgehend abgedeckt; P2-Rest im Report
- [ ] `pnpm` Build / `tsc` für api + web grün
- [ ] Report: erledigte Ordner, offenes P2
- [ ] Diese Auftragsdatei mitcommitten

---

## Prompt (Kurzfassung für Cloud)

Exportierte Klassen/Funktionen/Methoden/Interfaces in den Scope-Pfaden ausführlich auf Deutsch kommentieren (was/warum, @param, @returns, @throws). Dateiköpfe ergänzen. KEINE Logik-/API-/UI-Änderungen. P0 API services/controllers/utils, P1 web lib+layout, P2 Kapazität. Bereits gute JSDocs erweitern. Branch, PR, Build grün, Report.
