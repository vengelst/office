# Claude Code – Auftrag #3: Kundenmodul Verbesserungen (Geocoding, Filter, Branch-Detail)

## Kontext

Auftrag #2 ist abgeschlossen. Das Kundenmodul läuft vollständig in Docker. Jetzt sollen drei UX-Verbesserungen umgesetzt werden.

Stack: NestJS API (Port 3801/3901), Next.js Web (Port 3800/3900), PostgreSQL, MinIO. Alle Container laufen.

---

## 1. Auto-Geocoding: Koordinaten über Adresse füllen

### Anforderung:
Die Koordinatenfelder (`latitude`, `longitude`, `mapsUrl`) sollen NICHT manuell eingegeben werden, sondern automatisch über die eingegebene Adresse ermittelt werden.

### Backend: Neuer Endpoint

Erstelle einen Geocoding-Proxy-Endpoint:

```
GET /api/geocode?address=Hafenstraße+12,+20457+Hamburg,+DE
```

- Nutzt OpenStreetMap Nominatim API: `https://nominatim.openstreetmap.org/search?format=json&q={address}&limit=1`
- Setzt User-Agent Header: `Office-App/1.0`
- Gibt zurück: `{ latitude: number, longitude: number, mapsUrl: string }` oder 404 wenn nichts gefunden
- `mapsUrl` wird generiert als: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
- Endpoint ist durch JwtAuthGuard geschützt (aber kein RolesGuard nötig – alle eingeloggten User dürfen geocoden)
- Rate-Limiting: max 1 Request pro Sekunde an Nominatim (einfacher in-memory Throttle)

Lege diesen Endpoint in einem eigenen Modul an: `apps/api/src/geocode/`

### Frontend: Änderungen

**Im Kunden-Stammformular (`customer-form.tsx`):**
- Entferne die manuellen Eingabefelder für `latitude`, `longitude` (werden nur noch readonly angezeigt wenn Werte vorhanden)
- `mapsUrl` entfällt als Eingabefeld komplett (wird automatisch generiert)
- Füge einen Button "Koordinaten ermitteln" neben der Adress-Section hinzu
- Button ruft `GET /api/geocode?address={addressLine1},{postalCode} {city},{country}` auf
- Bei Erfolg: setzt latitude, longitude, mapsUrl im Formular und zeigt Toast "Koordinaten ermittelt"
- Bei Fehler: Toast "Adresse konnte nicht gefunden werden"
- Button ist disabled wenn addressLine1 oder city leer ist

**Im Niederlassungs-Dialog (`branches-tab.tsx`):**
- Gleiche Logik: Koordinatenfelder entfernen, stattdessen Button "Koordinaten ermitteln"
- Füllt latitude, longitude, mapsUrl automatisch
- Button ist disabled wenn addressLine1 oder city leer
- Koordinaten werden readonly angezeigt (wenn vorhanden), nicht editierbar

### Frontend-API-Client:
Erweitere `apps/web/src/lib/customers.ts` (oder neues File `geocode.ts`):
```typescript
export const geocodeApi = {
  lookup: (address: string) => apiClient.get<{ latitude: number; longitude: number; mapsUrl: string }>(`/geocode?address=${encodeURIComponent(address)}`),
};
```

---

## 2. Ansprechpartner-Tab: Filter nach Niederlassung

### Anforderung:
Im Tab "Ansprechpartner" soll über der Kontaktliste ein Filter-Dropdown stehen, mit dem man nach Niederlassung filtern kann.

### Umsetzung in `contacts-tab.tsx`:

- Füge über dem "Hinzufügen"-Button ein `<Select>` hinzu mit den Optionen:
  - "Alle Standorte" (Standardwert – zeigt alle)
  - "Hauptsitz" (zeigt nur Kontakte ohne branchId)
  - Jede Niederlassung als Option (zeigt nur Kontakte mit dieser branchId)
- Die bestehende Gruppierung nach Niederlassung bleibt erhalten wenn "Alle" gewählt ist
- Bei Auswahl einer spezifischen Niederlassung: nur die Kontakte dieser Niederlassung anzeigen (ohne Gruppen-Header)
- Filter und "Hinzufügen"-Button in einer Zeile (flex, justify-between)
- Alle UI-Texte in `texts.ts` ergänzen

---

## 3. Niederlassungs-Tab: Detail-Ansicht mit Ansprechpartnern

### Anforderung:
Wenn man eine Niederlassungs-Card anklickt, soll ein Detail-Dialog (Sheet oder großer Dialog) aufgehen, der:
1. Alle Details der Niederlassung zeigt (nicht nur Kurzform wie in der Card)
2. Eine klickbare Liste der zugeordneten Ansprechpartner anzeigt

### Umsetzung:

**Props erweitern:**
- `BranchesTab` bekommt zusätzlich `contacts: CustomerContact[]` als Prop
- Im `CustomerDetailPage` (`/customers/[id]/page.tsx`): `contacts={customer.contacts}` an `<BranchesTab>` übergeben

**Neuer Detail-Dialog in `branches-tab.tsx`:**
- Klick auf die Branch-Card (auf den Namen oder einen "Details"-Button) → öffnet Detail-Dialog
- Der bestehende Edit-Button bleibt separat (öffnet weiterhin das Edit-Formular)

**Inhalt des Detail-Dialogs:**
- **Kopfzeile:** Branch-Name + Typ-Badge
- **Adresse:** Vollständige Adresse (Straße, PLZ, Ort, Land)
- **Kontakt:** Telefon (`tel:`-Link), E-Mail (`mailto:`-Link)
- **Maps:** "Route öffnen"-Button (wenn Koordinaten vorhanden)
- **Notizen** (wenn vorhanden)
- **Ansprechpartner-Sektion:**
  - Überschrift "Ansprechpartner ({Anzahl})"
  - Liste aller Kontakte die `branchId === branch.id` haben
  - Jeder Kontakt als klickbare Card/Row:
    - Name (Anrede + Vorname + Nachname)
    - Rolle / Abteilung
    - E-Mail (`mailto:`-Link), Telefon (`tel:`-Link)
  - Klick auf einen Kontakt: schließt den Detail-Dialog und öffnet den Kontakt-Bearbeitungs-Dialog
  - Wenn keine Kontakte: "Keine Ansprechpartner für diese Niederlassung" + Button "Ansprechpartner hinzufügen" (öffnet Create-Dialog mit vorausgewählter Branch)
- **Footer:** "Schließen"-Button + "Bearbeiten"-Button (öffnet Edit-Dialog)

**Interaktion Kontakt-Klick:**
- Der einfachste Weg: Callback-Prop `onOpenContact?: (contact: CustomerContact) => void`
- Oder: State-Management innerhalb BranchesTab der den Contact-Edit-Dialog direkt öffnet
- Wähle die sauberste Lösung – wichtig ist dass der Nutzer direkt vom Branch-Detail zum Kontakt-Edit kommt

### Änderung in `CustomerDetailPage`:
```tsx
<BranchesTab
  customerId={id}
  branches={customer.branches}
  contacts={customer.contacts}  // NEU
  onChange={load}
/>
```

---

## 4. Texte ergänzen (`texts.ts`)

Alle neuen UI-Texte zentral ergänzen:
- "Koordinaten ermitteln"
- "Koordinaten ermittelt"
- "Adresse konnte nicht gefunden werden"
- "Alle Standorte" (Filter-Option)
- "Hauptsitz" (falls nicht schon vorhanden)
- "Ansprechpartner" (Sektion im Branch-Detail)
- "Keine Ansprechpartner für diese Niederlassung"
- "Details" (Button)
- Sonstige neue Strings

---

## 5. Technische Anforderungen

- Keine neuen npm-Packages nötig (HTTP-Request an Nominatim via fetch im Backend)
- Kein Prisma-Schema-Änderung nötig
- Docker muss weiterhin laufen (`docker compose -f docker-compose.dev.yml up --build`)
- Der Geocode-Endpoint braucht Netzwerkzugang nach außen (Container hat das bereits)
- TypeScript fehlerfrei (`tsc --noEmit`)
- Bestehende Funktionalität darf nicht brechen

---

## 6. Smoke-Tests

- [ ] `GET /api/geocode?address=Hafenstraße+12,+20457+Hamburg,+DE` → `{ latitude: ~53.54, longitude: ~9.98, mapsUrl: "https://..." }`
- [ ] `GET /api/geocode?address=xyznonexistent` → 404
- [ ] Frontend Kunden-Formular: "Koordinaten ermitteln" Button sichtbar, füllt Felder
- [ ] Frontend Branch-Dialog: "Koordinaten ermitteln" Button funktioniert
- [ ] Contacts-Tab: Filter-Dropdown vorhanden, filtert korrekt nach Niederlassung
- [ ] Branches-Tab: Klick auf Card öffnet Detail-Dialog mit allen Infos + Kontakt-Liste
- [ ] Kontakt im Branch-Detail anklicken → öffnet Bearbeitungs-Dialog

---

## 7. NICHT in diesem Auftrag

- Kein automatisches Geocoding beim Speichern (nur manuell per Button-Klick)
- Kein Google Maps API Key
- Keine Karten-Einbettung (nur externer Maps-Link)
- Keine Schema-Änderungen
