# Claude Code – Auftrag: Fahrzeugverwaltung (rudimentär)

## Kontext

Alle bisherigen Module laufen (Kunden, Projekte, Monteure, Zeiterfassung, Abrechnungen):
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Das Fahrzeug-Schema existiert bereits:
- `Vehicle` – id, licensePlate (unique), make, model, internalName, active, notes
- `WorkerVehicleAssignment` – workerId, vehicleId, assignedFrom, assignedTo, notes

**Scope:** Rudimentäre Implementierung – Fahrzeuge erfassen (eigene + Sub-Fahrzeuge), Zuweisungen an Monteure. Kein Fahrtenbuch, kein Tankkosten-Tracking, keine Schadensmeldungen – das kommt später.

### Wichtige übergreifende Regeln:
- Desktop, Tablet und Handy bedienbar
- Alle klickbaren Elemente mind. 44px Touch-Target
- Alle UI-Texte zentral in `texts.ts`
- CORS: `http://localhost:3900`

---

## 1. Schema-Ergänzung (Prisma-Migration)

### Vehicle erweitern:

```prisma
model Vehicle {
  // Bestehende Felder bleiben
  
  // Neue Felder:
  ownerType       String?     // "OWN" oder "SUBCONTRACTOR"
  subcontractorId String?     // Falls Sub-Fahrzeug: welcher Sub
  category        String?     // "PKW", "Transporter", "LKW", "Anhänger"
  year            Int?        // Baujahr
  vin             String?     // Fahrgestellnummer
  color           String?
  fuelType        String?     // "Diesel", "Benzin", "Elektro", "Hybrid"
  nextInspection  DateTime?   // Nächster TÜV/HU
  insuranceExpiry DateTime?   // Versicherung Ablauf
  registrationDoc String?     // Pfad zum Fahrzeugschein in MinIO
  
  subcontractor Subcontractor? @relation(fields: [subcontractorId], references: [id], onDelete: SetNull)
}
```

### Subcontractor: Relation ergänzen

```prisma
// Subcontractor:
  vehicles Vehicle[]
```

---

## 2. Backend (NestJS)

### 2.1 Vehicles (`/api/vehicles`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/vehicles` | Liste mit Filter (ownerType, active, subcontractorId, category), Suche (licensePlate, internalName), Sort, Pagination |
| GET | `/api/vehicles/:id` | Detail mit aktueller Zuweisung + Zuweisung-Historie |
| POST | `/api/vehicles` | Neues Fahrzeug |
| PATCH | `/api/vehicles/:id` | Bearbeiten |
| DELETE | `/api/vehicles/:id` | Deaktivieren (active=false, kein Hard-Delete) |
| POST | `/api/vehicles/:id/assign` | Monteur zuweisen (workerId, notes) |
| POST | `/api/vehicles/:id/unassign` | Zuweisung beenden (assignedTo = now) |
| GET | `/api/vehicles/expiring` | Fahrzeuge mit TÜV/Versicherung die in 30 Tagen ablaufen |

**Business-Regeln:**
- Ein Fahrzeug kann nur einem Monteur gleichzeitig zugewiesen sein (prüfe ob offene Zuweisung existiert)
- Beim Zuweisen: Alte offene Zuweisung automatisch beenden, neue erstellen
- licensePlate bleibt unique

---

## 3. Frontend

### 3.1 Fahrzeug-Liste (`/vehicles`)

- Tabelle (Desktop) / Karten (Mobile):
  - Kennzeichen, Marke+Modell, Kategorie-Badge, Eigentümer (Firma/Sub-Name), Status (Zugewiesen an X / Verfügbar)
- Filter: Eigentümer (Eigene/Sub), Kategorie, Status (verfügbar/zugewiesen)
- Suche: Kennzeichen, interner Name
- Button "Neues Fahrzeug"
- Ablaufwarnungen: TÜV/Versicherung gelb (<30 Tage), rot (abgelaufen)

### 3.2 Fahrzeug-Detail (`/vehicles/[id]`) – 2 Tabs

#### Tab 1: Stammdaten
- **Section "Fahrzeug"**: Kennzeichen, Marke, Modell, interner Name, Kategorie (Dropdown: PKW, Transporter, LKW, Anhänger), Baujahr, Farbe, Kraftstoff, FIN
- **Section "Eigentümer"**: Typ (Dropdown: Eigenes Fahrzeug / Subunternehmen), Subunternehmen (Dropdown, nur wenn Typ=Sub)
- **Section "Dokumente & Fristen"**: Nächster TÜV (Datum, Warnung), Versicherung Ablauf (Datum, Warnung)
- **Section "Notizen"**: Freitext

#### Tab 2: Zuweisungen
- **Aktuelle Zuweisung**: Monteur (Avatar + Name, anklickbar), seit wann, Notizen. Button "Zuweisung beenden"
- **Falls nicht zugewiesen**: Button "Monteur zuweisen" → Dialog mit Worker-Dropdown
- **Historie**: Tabelle vergangener Zuweisungen (Monteur, von, bis, Notizen)

### 3.3 Neues Fahrzeug (`/vehicles/new`)

- Formular mit Stammdaten-Feldern
- Nach Speichern → Weiterleitung zur Detail-Seite

### 3.4 Sidebar

Link "Fahrzeuge" → `/vehicles` im Bereich "Verwaltung" (oder passend zum bestehenden Sidebar-Layout)

### 3.5 Dashboard

Kleine Karte: "Fahrzeuge" – X gesamt, Y zugewiesen, Z mit ablaufendem TÜV/Versicherung

---

## 4. Seed-Daten

### 4 Fahrzeuge:
1. "B-OF 1234" – VW Transporter, Eigenes Fahrzeug, Kategorie Transporter, zugewiesen an Stefan Müller (bestehendes Seed-Fahrzeug erweitern!)
2. "D-EK 567" – Mercedes Sprinter, Sub: Kovačević, Kategorie Transporter, zugewiesen an Marko
3. "GD-BP 89" – Fiat Ducato, Sub: Baltic Power, Kategorie Transporter, verfügbar
4. "D-OF 4321" – VW Caddy, Eigenes Fahrzeug, Kategorie PKW, TÜV läuft in 15 Tagen ab (Warnung!)

### Zuweisungs-Historie:
- B-OF 1234: War vorher an Ahmed (beendet), jetzt Stefan
- D-EK 567: Seit Projektstart an Marko

---

## 5. Technische Hinweise

- Das bestehende Vehicle + WorkerVehicleAssignment Schema NICHT löschen, nur erweitern
- Der bestehende Seed hat bereits "B-OF 1234" – diesen upsert erweitern statt neu erstellen
- Migration: npx prisma migrate dev --name extend_vehicles --create-only
- Modul in app.module.ts registrieren
- JwtAuthGuard auf allen Endpoints
- Ablaufwarnungen: Gleicher Pattern wie bei Monteuren (gelb/rot Badges)

---

## 6. Ausführungsreihenfolge

1. Schema + Migration
2. Backend (Controller, Service, DTOs)
3. Frontend (API-Client, Texte, Seiten, Komponenten)
4. Seed-Daten
5. Sidebar + Dashboard
