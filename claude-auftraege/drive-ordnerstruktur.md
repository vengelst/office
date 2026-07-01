# Google Drive & MinIO Ordnerstruktur – Definition

## Sprache: Deutsch

## Root-Ordner in Google Drive: "Office App" (konfigurierbar in /settings/storage)

---

## Ordnerstruktur

```
📁 Office App
├── 📁 Kunden
│   ├── 📁 Müller Elektrotechnik GmbH [K-0001]
│   │   ├── 📁 Verträge
│   │   ├── 📁 Korrespondenz
│   │   ├── 📁 Rechnungen
│   │   ├── 📁 Logos & Visitenkarten
│   │   └── 📁 Sonstiges
│   └── 📁 Hafenbetrieb Hamburg AG [K-0002]
│       └── ...
├── 📁 Projekte
│   ├── 📁 Videoüberwachung Hafenterminal [PRJ-2026-0001]
│   │   ├── 📁 Baustellenfotos
│   │   ├── 📁 Pläne & Zeichnungen
│   │   ├── 📁 Protokolle
│   │   ├── 📁 Lieferscheine
│   │   ├── 📁 Stundenzettel
│   │   ├── 📁 Rechnungen
│   │   └── 📁 Sonstiges
│   └── 📁 Elektroinstallation Neubau Süd [PRJ-2026-0002]
│       └── ...
├── 📁 Monteure
│   ├── 📁 Kovačević, Marko [W-2026-0001]
│   │   ├── 📁 Ausweise & Pässe
│   │   ├── 📁 Zertifikate
│   │   ├── 📁 Verträge
│   │   └── 📁 Fotos (Verknüpfungen)
│   └── 📁 Müller, Stefan [W-2026-0005]
│       └── ...
├── 📁 Subunternehmen
│   ├── 📁 Elektro Kovačević d.o.o.
│   │   ├── 📁 Verträge
│   │   └── 📁 Rechnungen
│   └── 📁 Baltic Power Solutions
│       └── ...
└── 📁 Fahrzeuge
    ├── 📁 B-OF 1234 (VW Transporter)
    │   ├── 📁 Fahrzeugschein
    │   ├── 📁 Versicherung
    │   └── 📁 TÜV
    └── ...
```

---

## Dateinamen-Konventionen

| Dokument-Typ | Namensformat | Beispiel |
|-------------|-------------|----------|
| Baustellenfoto | `{Projekt}_{Monteur}_{Datum}_{Uhrzeit}.jpg` | `Hafenterminal_Kovacevic-Marko_2026-06-30_0732.jpg` |
| Vertrag | `Vertrag_{Partner}_{Datum}.pdf` | `Vertrag_Mueller-Elektro_2026-01-15.pdf` |
| Reisepass | `Reisepass_{Name}_{Ablauf}.pdf` | `Reisepass_Kovacevic-Marko_2027-03-15.pdf` |
| Ausweis | `Ausweis_{Name}.pdf` | `Ausweis_Kovacevic-Marko.pdf` |
| Arbeitserlaubnis | `Arbeitserlaubnis_{Name}_{Ablauf}.pdf` | `Arbeitserlaubnis_Kovacevic-Marko_2027-06-01.pdf` |
| Zertifikat | `{Zertifikat}_{Name}_{Ablauf}.pdf` | `SCC-017_Kovacevic-Marko_2027-12-01.pdf` |
| Stundenzettel | `Stundenzettel_KW{Nr}_{Monteur}.pdf` | `Stundenzettel_KW26_Kovacevic-Marko.pdf` |
| Ausgangsrechnung | `RE-{Nr}_{Kunde}.pdf` | `RE-2026-0001_Hafenbetrieb-Hamburg.pdf` |
| Eingangsrechnung | `ER-{Nr}_{Sub}.pdf` | `ER-2026-0001_Elektro-Kovacevic.pdf` |
| Fahrzeugschein | `Fahrzeugschein_{Kennzeichen}.pdf` | `Fahrzeugschein_B-OF-1234.pdf` |

---

## Regeln für Monteur-Fotos

1. **Primär-Speicherort**: `Projekte/{Projektname}/Baustellenfotos/{Foto}`
2. **Sekundär** (Verknüpfung): `Monteure/{Name}/Fotos/` → Google Drive Shortcut zum Original
3. **Dateiname**: `{Projekt}_{Monteur}_{Datum}_{Uhrzeit}.jpg`
4. **Berechtigungen Monteur**:
   - Baustellenfotos-Ordner seines Projekts: NUR Hochladen + Ansehen (kein Löschen)
   - Alle anderen Ordner: KEIN Zugriff
5. **Bei Projektzuweisung**: Monteur bekommt automatisch Schreibzugriff auf den Baustellenfotos-Ordner
6. **Bei Zuweisung-Ende**: Schreibzugriff entfernen (optional: Lesezugriff behalten)

---

## Automatische PDF-Exports

| Trigger | Ziel-Ordner | Dateiname |
|---------|-------------|-----------|
| Stundenzettel → Status APPROVED | `Projekte/{Projekt}/Stundenzettel/` | `Stundenzettel_KW{Nr}_{Monteur}.pdf` |
| Ausgangsrechnung → Status SENT | `Projekte/{Projekt}/Rechnungen/` UND `Kunden/{Kunde}/Rechnungen/` | `RE-{Nr}_{Kunde}.pdf` |
| Eingangsrechnung → Status SENT | `Subunternehmen/{Sub}/Rechnungen/` | `ER-{Nr}_{Sub}.pdf` |

---

## MinIO-Spiegel (technische Pfade)

MinIO nutzt die gleiche logische Struktur, aber mit IDs statt lesbaren Namen:

```
documents/
  customers/{customerId}/{folder}/{originalFilename}
  projects/{projectId}/baustellenfotos/{timestamp}_{workerId}.jpg
  projects/{projectId}/stundenzettel/{timesheetId}.pdf
  projects/{projectId}/rechnungen/{invoiceId}.pdf
  workers/{workerId}/{folder}/{originalFilename}
  subcontractors/{subId}/rechnungen/{invoiceId}.pdf
  vehicles/{vehicleId}/{folder}/{originalFilename}
```

---

## Datenbank-Mapping (Document-Model)

Jedes Document hat:
- `storageKey` → MinIO-Key (technisch, mit IDs)
- `storagePath` → Lesbarer Pfad (für Anzeige + Google Drive Zuordnung)
- `driveFileId` → Google Drive File-ID (neues Feld, für direkten Link)
- `driveFolderId` → Google Drive Ordner-ID wo die Datei liegt

---

## Zusammenfassung der Berechtigungen

| Rolle | Zugriff |
|-------|---------|
| Admin/Office | Voller Zugriff auf alles |
| Projektleiter | Voller Zugriff auf seine Projekte |
| Monteur (via App) | NUR Fotos hochladen + ansehen im eigenen Projekt-Baustellenfotos-Ordner. Kein Löschen. |
