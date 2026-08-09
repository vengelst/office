# Cloud-Auftrag #11 – Self-Check / Notizen

## Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Kiosk PIN → Tabs Items \| Stundenzettel (Default Items wenn `itemBased`) | ✅ | `itemBased` aus `GET /pl/projects`; sonst nur Stundenzettel |
| 2 | Board zeigt Items des Kiosk-Projekts; Statusfilter + Suche | ✅ | `KioskPlItemBoard` → `GET /pl/projects/:id/work-items` |
| 3 | Item in `REVIEW`: Approve → `APPROVED`, Board aktualisiert | ✅ | `POST /work-items/:id/reviews/approve` via Kiosk-Token |
| 4 | Force-Complete mit Confirm → `APPROVED` | ✅ | Dark Confirm-Dialog am Kiosk |
| 5 | Fotos der Fertigmeldung sichtbar (kein 403) | ✅ | Stream über `office_kiosk_pl_token`, Lightbox |
| 6 | Stundenzettel-Flow (#9/#10) unverändert | ✅ | Sign/Approve/PDF-Mail unverändert; State `timesheet_detail` |
| 7 | Logout/Idle löscht PL-Token; kein Office-Routen-Zugriff | ✅ | Idle Items ≥180s; Token-Keys unverändert |
| 8 | Worker-Kiosk `/kiosk/terminal` unverändert | ✅ | Nicht angefasst |
| 9 | Keine neue Prisma-Migration | ✅ | Nur UI / Client |
| – | Web-Build grün (Docker web-only) | ✅ | `/kiosk/pl` im Bundle; ThemeProvider-Typfix (vorbestehend) |

## Geänderte Dateien

### Neu
- `apps/web/src/lib/kiosk-pl-api.ts` – Fetch + `kioskPlApi` mit `office_kiosk_pl_token`
- `apps/web/src/lib/work-item-display.ts` – shared Location/Monteur-Labels
- `apps/web/src/components/kiosk/pl-item-board.tsx` – Touch-Board
- `apps/web/src/components/kiosk/pl-item-detail.tsx` – Vollbild-Detail inkl. Fotos/Aktionen
- `claude-auftraege/claude-arbeitsitems-11-notizen.md` – diese Datei

### Erweitert
- `apps/web/src/app/kiosk/pl/page.tsx` – Tabs nach Login; Token-Pfad über `kiosk-pl-api`
- `apps/web/src/lib/texts.ts` – `kiosk.pl.tabs` + `kiosk.pl.items`
- `apps/web/src/app/(authenticated)/pl/projects/[projectId]/page.tsx` – shared Labels
- `apps/web/src/components/layout/theme-provider.tsx` – explizite Props (Build-Fix next-themes/`@types/react`)

## Architektur

- Alle Board-/Detail-/Review-/Foto-Calls: Bearer `office_kiosk_pl_token` (nicht `office_token` / `apiClient`)
- Projekt-ID: immer `config.projectId` aus Kiosk-Setup
- Office-`PlItemDetailSheet` / `customerPlApi` bleiben für `/pl`-Login; Kiosk hat eigene Touch-UI (Dark)

## Testpfad (Produktion)

1. Kiosk-Setup Modus Kunden-PL + item-basiertes Projekt → `/kiosk/pl`
2. PIN → Tab **Arbeitsitems** (Default) und **Stundenzettel**
3. Status-Chips + Suche; Item öffnen → Fotos; Approve / Force-Complete
4. Stundenzettel: Liste → Detail → Signatur → Approve (wie zuvor)
5. Idle/Logout: Token weg; Worker-Kiosk unberührt

## Bewusst nicht implementiert (#12 / Out of Scope)

- PDF-Import-Feinschliff, Offline, Mobile-APK, Reporting
- Keine neuen API-Endpunkte
