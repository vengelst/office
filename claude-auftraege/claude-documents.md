# Claude Code – Auftrag: Dokumenten-Verbesserung

## Kontext

Alle bisherigen Module laufen (Kunden, Projekte, Monteure, Zeiterfassung, Abrechnungen, Fahrzeuge):
- API: NestJS auf Port 3801 (extern 3901)
- Web: Next.js auf Port 3800 (extern 3900)
- DB: PostgreSQL auf Port 5432 (extern 5433)
- Storage: MinIO auf Port 9000 (extern 9002)

Das Dokumenten-System existiert bereits:
- `Document` – id, storageKey, originalFilename, mimeType, fileSize, uploadedByUserId, documentType, title, description, createdAt
- `DocumentLink` – id, documentId, entityType, entityId (Verknüpfung zu Kunden/Projekten/Monteuren)
- `DocumentType` enum mit vielen Typen (PHOTO, INVOICE, CONTRACT, PASSPORT, ID_CARD, WORK_PERMIT, etc.)
- Upload geht nach MinIO, Download über API
- `DocumentsTab`-Komponente existiert im Frontend (für Kunden + Projekte)

**Ziel:** Das Dokumenten-System massiv verbessern:
1. **Kontextbezogene Dokumenttypen** – Beim Upload nur relevante Typen je nach Kontext (Monteur, Projekt, Kunde, Fahrzeug)
2. **Ordnerstruktur im Storage** – Dokumente in logischer Verzeichnisstruktur ablegen (nicht flach)
3. **Kamera-Upload** – Direkt von Kamera fotografieren und hochladen
4. **Bildbearbeitung** – Zuschneiden, Drehen, Helligkeit anpassen vor dem Upload
5. **Vorschau** – Bilder inline anzeigen, PDFs im Browser öffnen
6. **Versions-Management** – Neues Dokument kann altes ersetzen (z.B. neuer Pass-Scan)
7. **Massen-Upload** – Mehrere Dateien gleichzeitig
8. **Suchfunktion** – Über alle Dokumente suchen

### Wichtige übergreifende Regeln:
- Desktop, Tablet und Handy bedienbar
- Alle klickbaren Elemente mind. 44px Touch-Target
- Alle UI-Texte zentral in `texts.ts`
- CORS: `http://localhost:3900`
- Bilder die hochgeladen werden SIND Dokumente (kein Unterschied)

---

## 1. Schema-Ergänzung (Prisma-Migration)

### Document erweitern:

```prisma
model Document {
  // Bestehende Felder bleiben
  
  // Neue Felder:
  storagePath     String?     // Logischer Pfad: z.B. "customers/cuid123/contracts/vertrag.pdf"
  thumbnailKey    String?     // MinIO-Key für Thumbnail (bei Bildern)
  version         Int         @default(1)
  replacesId      String?     // ID des Vorgänger-Dokuments (bei Versionen)
  isLatest        Boolean     @default(true)    // Nur die aktuelle Version ist "latest"
  expiryDate      DateTime?   // Ablaufdatum (für Pässe, Zertifikate, etc.)
  tags            String?     // Komma-separierte Tags für Suche
  uploadSource    String?     // "web", "camera", "mobile"
  
  replacedBy      Document?   @relation("DocumentVersions", fields: [replacesId], references: [id])
  previousVersions Document[] @relation("DocumentVersions")
}
```

### Neues Model: DocumentFolder (für logische Struktur)

```prisma
model DocumentFolder {
  id          String  @id @default(cuid())
  entityType  String  // "CUSTOMER", "PROJECT", "WORKER", "VEHICLE"
  entityId    String
  name        String  // z.B. "Verträge", "Ausweise", "Fotos"
  parentId    String? // Für Unterordner
  sortOrder   Int     @default(0)
  
  parent   DocumentFolder?  @relation("FolderTree", fields: [parentId], references: [id])
  children DocumentFolder[] @relation("FolderTree")
  
  @@unique([entityType, entityId, name, parentId])
}
```

### DocumentLink erweitern:

```prisma
model DocumentLink {
  // Bestehende Felder bleiben
  
  // Neue Felder:
  folderId String?   // Optional: In welchem Ordner liegt das Dokument
  
  folder DocumentFolder? @relation(fields: [folderId], references: [id])
}
```

---

## 2. Backend (NestJS)

### 2.1 Documents-Controller erweitern (`/api/documents`)

Bestehende Endpoints behalten + neue hinzufügen:

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/documents` | Globale Suche mit Filter (entityType, entityId, documentType, search, tags, folderId) |
| GET | `/api/documents/:id` | Detail inkl. Versions-Historie |
| GET | `/api/documents/:id/thumbnail` | Thumbnail abrufen (für Bilder) |
| GET | `/api/documents/:id/preview` | Voransicht (Bild original oder PDF-erste-Seite) |
| POST | `/api/documents/upload` | Einzel-Upload (erweitert: mit storagePath, folderId, tags, expiryDate, uploadSource) |
| POST | `/api/documents/upload-multiple` | Massen-Upload (mehrere Dateien gleichzeitig, gleicher Kontext) |
| POST | `/api/documents/:id/replace` | Neue Version hochladen (altes Dokument wird versioniert) |
| PATCH | `/api/documents/:id` | Metadaten bearbeiten (title, description, tags, expiryDate) |
| DELETE | `/api/documents/:id` | Löschen (inkl. aus MinIO) |
| GET | `/api/documents/expiring` | Dokumente die bald ablaufen (30 Tage) |

### 2.2 Document-Folders (`/api/document-folders`)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/document-folders` | Ordner für eine Entität (entityType + entityId) |
| POST | `/api/document-folders` | Ordner erstellen |
| PATCH | `/api/document-folders/:id` | Umbenennen |
| DELETE | `/api/document-folders/:id` | Löschen (nur wenn leer) |

### 2.3 Storage-Pfad-Logik

Dokumente werden in MinIO in einer logischen Struktur abgelegt:

```
documents/
  customers/{customerId}/
    contracts/
    logos/
    ...
  projects/{projectId}/
    photos/
    protocols/
    drawings/
    ...
  workers/{workerId}/
    passports/
    certificates/
    id-cards/
    ...
  vehicles/{vehicleId}/
    registration/
    insurance/
    ...
```

Der `storagePath` im Document-Model speichert diesen logischen Pfad.
Der `storageKey` in MinIO bleibt der physische Key (kann gleich sein).

### 2.4 Thumbnail-Generierung

Bei Bild-Uploads (JPEG, PNG, WebP):
- Thumbnail generieren (300x300, Cover-Fit)
- Falls `sharp` verfügbar: Verwende sharp
- Falls nicht: Speichere Original auch als Thumbnail (Fallback)
- Thumbnail-Key in `thumbnailKey` speichern

### 2.5 Versions-Management

```
POST /api/documents/:id/replace
- Lädt neues File hoch
- Setzt altes Dokument: isLatest=false
- Neues Dokument: version=alt.version+1, replacesId=alt.id, isLatest=true
- Übernimmt: entityLinks, folderId, documentType, title vom Original
```

### 2.6 Kontextbezogene Dokumenttypen

Neuer Endpoint oder Konfiguration:

```
GET /api/documents/types-for-context?entityType=WORKER
→ ["PASSPORT", "ID_CARD", "WORK_PERMIT", "RESIDENCE_PERMIT", "CERTIFICATION", "HEALTH_CERTIFICATE", "WORKER_PHOTO", "CONTRACT", "OTHER"]

GET /api/documents/types-for-context?entityType=CUSTOMER
→ ["CONTRACT", "BUSINESS_CARD", "LOGO", "INVOICE", "CERTIFICATE", "NOTE_DOCUMENT", "OTHER"]

GET /api/documents/types-for-context?entityType=PROJECT
→ ["PHOTO", "SITE_PHOTO", "DELIVERY_NOTE", "INVOICE", "PROJECT_DOC", "DRAWING", "WORK_CONTRACT", "SPECIFICATION", "HANDOVER_PROTOCOL", "OTHER"]

GET /api/documents/types-for-context?entityType=VEHICLE
→ ["REGISTRATION_DOC", "INSURANCE_DOC", "INSPECTION_DOC", "PHOTO", "OTHER"]
```

Hierfür DocumentType enum erweitern:
```prisma
// Neue Werte:
  REGISTRATION_DOC    // Fahrzeugschein
  INSURANCE_DOC       // Versicherungsnachweis
  INSPECTION_DOC      // TÜV/HU-Bericht
```

---

## 3. Frontend

### 3.1 Neue DocumentsTab-Komponente (Ersatz für die bestehende)

Die bestehende `DocumentsTab` komplett neu bauen als universelle Komponente:

**Props:** `entityType`, `entityId`

**Features:**
- **Ordner-Ansicht**: Ordner links (Baumstruktur oder Tabs), Dateien rechts
- **Grid/Listen-Umschaltung**: Grid zeigt Thumbnails, Liste zeigt Details
- **Kontextbezogene Typen**: Upload-Dialog zeigt nur passende DocumentTypes
- **Kamera-Button**: `<input type="file" accept="image/*" capture="environment">` für direktes Fotografieren
- **Massen-Upload**: Drag&Drop-Zone + Multi-File-Input
- **Vorschau**: Bilder inline (Lightbox bei Klick), PDFs im neuen Tab
- **Ablaufwarnungen**: Gelb/Rot-Badges bei Dokumenten mit expiryDate
- **Versions-Indikator**: Badge "V2", "V3" + Link zu älteren Versionen
- **Suche**: Innerhalb der Entität nach Dateiname/Title/Tags suchen

### 3.2 Upload-Dialog (neu)

- **Drag&Drop-Zone**: Große Drop-Area mit "Dateien hierher ziehen oder klicken"
- **Kamera-Button**: Separater Button "Foto aufnehmen" (öffnet Kamera)
- **Multi-Select**: Mehrere Dateien gleichzeitig auswählen
- **Pro Datei**: Dokumenttyp (Dropdown, kontextbezogen), Titel, Beschreibung, Tags, Ablaufdatum (optional), Ordner
- **Bildbearbeitung**: Wenn Bild ausgewählt → "Bearbeiten"-Button öffnet Editor

### 3.3 Bild-Editor (neue Komponente)

Leichtgewichtiger Bild-Editor BEVOR das Bild hochgeladen wird:

**Features:**
- **Drehen**: 90° links/rechts
- **Zuschneiden**: Rechteck-Auswahl mit Drag-Handles
- **Helligkeit**: Slider (-50% bis +50%)
- **Kontrast**: Slider (-50% bis +50%)
- **Vorschau**: Live-Vorschau der Änderungen
- **Zurücksetzen**: Original wiederherstellen
- **Übernehmen**: Bearbeitetes Bild als neuen Blob zurückgeben

**Technisch:**
- HTML5 Canvas für Transformationen
- CSS Filters für Helligkeit/Kontrast-Preview (performant)
- Beim "Übernehmen": Canvas.toBlob() → neuer File-Blob für Upload
- Bibliothek: Eigene Implementierung mit Canvas API (kein externes Paket nötig)
- Crop: Mouse/Touch-Drag für Auswahlrechteck, Resize-Handles an Ecken

### 3.4 Dokument-Vorschau (Lightbox)

- Bilder: Vollbild-Overlay mit Zoom (Pinch-to-Zoom auf Mobile)
- PDFs: Neuer Browser-Tab mit der PDF-URL
- Andere Dateien: Download-Link
- Navigation: Vor/Zurück-Pfeile wenn mehrere Dokumente im Ordner

### 3.5 Globale Dokumenten-Suche (`/documents`)

Eigene Seite für die dokumentenübergreifende Suche:
- Suchfeld (Dateiname, Titel, Tags)
- Filter: Dokumenttyp, Entitätstyp, Zeitraum, ablaufend
- Ergebnis-Liste: Thumbnail, Dateiname, Typ, verknüpfte Entität (anklickbar), Hochladedatum
- Vorschau bei Klick

### 3.6 Sidebar

Link "Dokumente" → `/documents` (globale Suche)

### 3.7 Integration in bestehende Module

Die NEUE DocumentsTab-Komponente muss die ALTE ersetzen in:
- `apps/web/src/components/customers/tabs/documents-tab.tsx` → Neue Komponente nutzen
- Projekt-Detail: Documents-Tab → Neue Komponente nutzen
- Worker-Detail: Documents-Tab → Neue Komponente nutzen
- Vehicle-Detail: Ggf. Documents-Section ergänzen

---

## 4. Seed-Daten

Keine neuen Seed-Dokumente nötig (die Upload-Infrastruktur braucht echte Dateien in MinIO). Aber:
- Standard-Ordner für bestehende Entitäten anlegen:
  - Kunden: "Verträge", "Korrespondenz", "Logos"
  - Projekte: "Baustellenfotos", "Pläne & Zeichnungen", "Protokolle", "Lieferscheine"
  - Monteure: "Ausweise & Pässe", "Zertifikate", "Verträge"
  - Fahrzeuge: "Fahrzeugschein", "Versicherung", "TÜV"

---

## 5. Technische Hinweise

- **Bildbearbeitung**: KEINE externe Bibliothek. Reine Canvas API + CSS Filters. Das ist leichtgewichtig und ausreichend.
- **Crop**: PointerEvents für Mouse+Touch, Auswahlrechteck mit 4 Resize-Handles
- **Thumbnail**: Backend generiert bei Upload. Falls `sharp` nicht installiert: `pnpm add sharp` in API-App (oder Fallback: Original als Thumbnail)
- **Kamera**: `<input type="file" accept="image/*" capture="environment">` – öffnet auf Mobile die Kamera, auf Desktop den Datei-Dialog
- **Drag&Drop**: HTML5 Drag&Drop API (`onDragOver`, `onDrop`)
- **Multi-Upload**: Promise.all für parallele Uploads, Fortschrittsanzeige pro Datei
- **PDF-Vorschau**: Einfach die MinIO-URL in neuem Tab öffnen (Browser hat eingebauten PDF-Viewer)
- **Lightbox**: Eigene Komponente mit `position: fixed`, Backdrop, Keyboard-Navigation (Esc, Pfeile)
- **Bestehende DocumentsTab**: Die alte Komponente NICHT löschen, sondern die neue parallel erstellen und dann in den Tab-Seiten die Import-Referenz austauschen
- **sharp**: Falls Installation Probleme macht → Fallback ohne Thumbnail (Original-Bild als Thumbnail verwenden)

---

## 6. Ausführungsreihenfolge

1. Schema + Migration
2. Backend: Documents-Controller erweitern, Folders, Thumbnail-Service, Versions-Logik, Kontexttypen
3. Frontend: Bild-Editor-Komponente
4. Frontend: Neue DocumentsTab-Komponente (Upload-Dialog, Ordner, Vorschau, Lightbox)
5. Frontend: Globale Dokumente-Seite (/documents)
6. Frontend: Bestehende Module auf neue DocumentsTab umstellen
7. Seed: Standard-Ordner anlegen
8. Sidebar erweitern
