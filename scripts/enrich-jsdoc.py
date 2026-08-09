#!/usr/bin/env python3
"""Erweitert TypeScript-Dateien um deutsche JSDoc/TSDoc-Kommentare (nur Kommentare)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Domänenbeschreibungen für Dateiköpfe (relativer Pfad-Suffix → Text)
DOMAIN = {
    "auth/auth.service.ts": (
        "Authentifizierung für Office-Benutzer und Monteure.",
        "Login (E-Mail/Passwort, PIN), JWT-Ausstellung und Session-Verwaltung.",
    ),
    "auth/auth.controller.ts": (
        "HTTP-Endpunkte für Login, PIN-Login, Logout und Token-Refresh.",
        "Öffentliche Routen sind rate-limitiert; geschützte Routen nutzen JWT.",
    ),
    "prisma/prisma.service.ts": (
        "NestJS-Wrapper um den Prisma-Client.",
        "Stellt die DB-Verbindung bereit und steuert Connect/Disconnect am Lifecycle.",
    ),
}

GENERIC_METHOD = {
    "findAll": ("Liefert eine (ggf. gefilterte/paginierte) Liste.", "Listenergebnis"),
    "findOne": ("Lädt einen einzelnen Datensatz anhand der ID.", "Datensatz"),
    "create": ("Legt einen neuen Datensatz an.", "Neu angelegter Datensatz"),
    "update": ("Aktualisiert einen bestehenden Datensatz.", "Aktualisierter Datensatz"),
    "remove": ("Löscht bzw. deaktiviert einen Datensatz.", "Ergebnis der Löschung"),
    "bulkRemove": ("Löscht bzw. deaktiviert mehrere Datensätze in einem Schritt.", "Ergebnis der Massenlöschung"),
    "list": ("Listet Einträge der Domäne.", "Liste"),
    "get": ("Liest einen Konfigurations- oder Datensatzwert.", "Gelesener Wert"),
    "save": ("Speichert Konfiguration oder Daten.", "Gespeicherter Wert"),
    "login": ("Authentifiziert und stellt ein JWT aus.", "LoginResponse mit Token und Benutzer"),
    "logout": ("Invalidiert die aktuelle Session bzw. das Token.", "Erfolgsbestätigung"),
    "refresh": ("Erneuert das JWT für den aktuellen Akteur.", "LoginResponse mit neuem Token"),
    "health": ("Health-Check für Load-Balancer und Monitoring.", "Statusobjekt"),
    "getStats": ("Aggregiert Kennzahlen für das Dashboard.", "Statistikobjekt"),
    "suggestions": ("Liefert Autocomplete-/Suchvorschläge.", "Vorschlagsliste"),
    "upload": ("Lädt eine Datei hoch und speichert Metadaten.", "Dokument- bzw. Upload-Metadaten"),
    "uploadLogo": ("Lädt das Firmenlogo hoch.", "Speicherpfad bzw. Key des Logos"),
    "getLogoKey": ("Liefert den Storage-Key des Firmenlogos.", "Key oder null"),
    "getConfig": ("Liest die aktuelle Konfiguration.", "Konfigurationsobjekt"),
    "saveConfig": ("Speichert die Konfiguration.", "Gespeicherte Konfiguration"),
    "updateConfig": ("Aktualisiert die Konfiguration.", "Aktualisierte Konfiguration"),
    "sendTest": ("Sendet eine Test-E-Mail zur SMTP-Prüfung.", "Sendestatus"),
    "send": ("Versendet die Ressource (z. B. E-Mail/Rechnung).", "Versandergebnis"),
    "testConnection": ("Prüft die Verbindung zum externen Dienst.", "Testergebnis"),
    "initFolders": ("Initialisiert die Ordnerstruktur im Storage.", "Ergebnis der Initialisierung"),
    "lookup": ("Geocodiert eine Adresse bzw. sucht Koordinaten.", "Geocode-Ergebnis"),
    "modules": ("Listet verfügbare Backup-Module.", "Modulliste"),
    "listJobs": ("Listet Backup-Jobs.", "Jobliste"),
    "listRestores": ("Listet Restore-Vorgänge.", "Restore-Liste"),
    "startManualBackup": ("Startet ein manuelles Backup.", "Gestarteter Job"),
    "start": ("Startet den Vorgang.", "Gestartetes Ergebnis"),
    "restore": ("Stellt Daten aus einem Backup wieder her.", "Restore-Ergebnis"),
    "deleteJob": ("Löscht einen Backup-Job und zugehörige Artefakte.", "void"),
    "ensureConfig": ("Stellt sicher, dass eine gültige Konfiguration existiert.", "Konfiguration"),
    "onModuleInit": ("Lifecycle-Hook: Initialisierung nach Modulstart.", "void"),
    "onModuleDestroy": ("Lifecycle-Hook: Aufräumen vor Modulende.", "void"),
    "enableShutdownHooks": ("Registriert Shutdown-Hooks für sauberes Trennen der DB.", "void"),
    "clockIn": ("Stempelt den Monteur ein (Arbeitsbeginn).", "Time-Entry"),
    "clockOut": ("Stempelt den Monteur aus (Arbeitsende).", "Time-Entry"),
    "uploadPhoto": ("Lädt ein Stempel-/Nachweisfoto hoch.", "Upload-Ergebnis"),
    "projectStatus": ("Liefert den Stempelstatus für ein Projekt.", "Status"),
    "status": ("Liefert den aktuellen Stempelstatus.", "Status"),
    "today": ("Liefert die heutigen Zeiteinträge.", "Liste der heutigen Einträge"),
    "live": ("Liefert live gestempelte Einträge.", "Live-Liste"),
    "submit": ("Reicht den Stundenzettel zur Freigabe ein.", "Aktualisierter Stundenzettel"),
    "approve": ("Gibt den Stundenzettel bzw. das Item frei.", "Freigegebenes Objekt"),
    "reject": ("Lehnt den Stundenzettel ab.", "Abgelehnter Stundenzettel"),
    "archive": ("Archiviert den Stundenzettel.", "Archivierter Stundenzettel"),
    "generate": ("Generiert Dokumente/Einträge (PDF, Stundenzettel o. Ä.).", "Generiertes Ergebnis"),
    "generateFromTimesheets": ("Erzeugt Rechnungen aus Stundenzetteln.", "Erzeugte Rechnungen"),
    "stats": ("Liefert aggregierte Statistiken.", "Statistik"),
    "updateDay": ("Aktualisiert einen Tageseintrag im Stundenzettel.", "Aktualisierter Tag"),
    "setPin": ("Setzt oder aktualisiert die PIN eines Benutzers.", "Ergebnis"),
    "deactivate": ("Deaktiviert den Datensatz (Soft-Delete/Status).", "Deaktivierter Datensatz"),
    "reactivate": ("Reaktiviert einen zuvor deaktivierten Datensatz.", "Reaktivierter Datensatz"),
    "unassign": ("Hebt eine Zuordnung auf.", "Aktualisierter Datensatz"),
    "assign": ("Erstellt eine Zuordnung.", "Zuordnung"),
    "expiring": ("Listet bald ablaufende Einträge.", "Liste"),
    "expiringDocuments": ("Listet bald ablaufende Dokumente.", "Liste"),
    "listWorkers": ("Listet Monteure für Auswahlfelder.", "Monteur-Liste"),
    "listUsers": ("Listet Benutzer für Auswahlfelder.", "Benutzer-Liste"),
    "listCategories": ("Listet Kategorien.", "Kategorie-Liste"),
    "listContacts": ("Listet Kontakte der Entität.", "Kontakt-Liste"),
    "createContact": ("Legt einen Kontakt an.", "Neuer Kontakt"),
    "updateContact": ("Aktualisiert einen Kontakt.", "Aktualisierter Kontakt"),
    "removeContact": ("Entfernt einen Kontakt.", "Ergebnis"),
    "addMember": ("Fügt ein Teammitglied hinzu.", "Mitgliedschaft"),
    "removeMember": ("Entfernt ein Teammitglied.", "Ergebnis"),
    "getMyTodos": ("Liefert Todos des aktuellen Benutzers.", "Todo-Liste"),
    "getDashboard": ("Liefert Todo-Daten für das Dashboard.", "Dashboard-Daten"),
    "getDashboardData": ("Aggregiert Todo-Kennzahlen für das Dashboard.", "Dashboard-Daten"),
    "getUsers": ("Listet Benutzer (z. B. für Todo-Zuweisung).", "Benutzer-Liste"),
    "updateStatus": ("Aktualisiert nur den Status.", "Aktualisierter Datensatz"),
    "nationalities": ("Liefert Nationalitäten-Stammdaten.", "Liste"),
    "getNationalities": ("Liefert Nationalitäten-Stammdaten.", "Liste"),
    "timeline": ("Liefert eine Zeitachse/Projekt-Timeline.", "Timeline-Daten"),
    "findEquipment": ("Listet Equipment der Entität.", "Equipment-Liste"),
    "createEquipment": ("Legt Equipment an.", "Neues Equipment"),
    "updateEquipment": ("Aktualisiert Equipment.", "Aktualisiertes Equipment"),
    "removeEquipment": ("Entfernt Equipment.", "Ergebnis"),
    "createSite": ("Legt einen Projektstandort an.", "Neuer Standort"),
    "updateSite": ("Aktualisiert einen Projektstandort.", "Aktualisierter Standort"),
    "removeSite": ("Entfernt einen Projektstandort.", "Ergebnis"),
    "getWorkerEquipment": ("Listet dem Monteur zugewiesenes Equipment.", "Equipment-Liste"),
    "uploadImage": ("Lädt ein Bild hoch.", "Bild-Metadaten"),
    "getImage": ("Liefert Bilddaten bzw. Stream.", "Bild"),
    "getAssignmentHistory": ("Liefert die Zuordnungshistorie.", "Historie"),
    "pinLogin": ("Authentifiziert per PIN und stellt ein JWT aus.", "LoginResponse"),
    "userPinLogin": ("Authentifiziert einen Benutzer (Kunden-PL) per PIN.", "LoginResponse"),
    "me": ("Liefert den aktuell authentifizierten Akteur.", "Auth-Profil"),
    "extract": ("Extrahiert Text/Daten per OCR.", "OCR-Ergebnis"),
    "businessCard": ("Erkennt Visitenkartendaten per OCR.", "Visitenkarten-Felder"),
    "businessCardFromDocument": ("OCR einer gespeicherten Visitenkarte/Dokument.", "Visitenkarten-Felder"),
    "calibrate": ("Kalibriert OCR-/Template-Regionen anhand einer PDF-Seite.", "Kalibrierungsergebnis"),
    "runCalibrate": ("Startet die Template-Kalibrierung.", "Kalibrierungsergebnis"),
    "rasterizePage": ("Rendert eine PDF-Seite als Rasterbild.", "Bildpuffer"),
    "dispose": ("Gibt native Ressourcen frei.", "void"),
    "findBlocks": ("Listet Work-Item-Blöcke eines Projekts.", "Block-Liste"),
    "createBlock": ("Legt einen Work-Item-Block an.", "Neuer Block"),
    "updateBlock": ("Aktualisiert einen Work-Item-Block.", "Aktualisierter Block"),
    "removeBlock": ("Entfernt einen Work-Item-Block.", "Ergebnis"),
    "previewPdfImport": ("Vorschau eines PDF-Imports ohne Commit.", "Import-Vorschau"),
    "commitPdfImport": ("Übernimmt die PDF-Import-Vorschau in die DB.", "Import-Ergebnis"),
    "import": ("Importiert Work-Items aus Quelldaten.", "Import-Ergebnis"),
    "previewImport": ("Vorschau eines Imports ohne Persistenz.", "Import-Vorschau"),
    "findMaterials": ("Listet Materialien eines Work-Items.", "Material-Liste"),
    "replaceMaterials": ("Ersetzt die Materialliste eines Work-Items.", "Aktualisierte Materialien"),
    "itemTime": ("Liefert die dem Item zugeordnete Stempelzeit.", "Zeitaggregation"),
    "findMine": ("Listet dem Monteur zugängliche/zugewiesene Items.", "Item-Liste"),
    "findMineOne": ("Lädt ein dem Monteur zugängliches Item.", "Item"),
    "findMinePdf": ("Liefert die PDF-Unterlage für ein Monteur-Item.", "PDF/Stream"),
    "claim": ("Nimmt ein Item für den Monteur in Anspruch.", "Aktualisiertes Item"),
    "startSession": ("Startet die Arbeitssession an einem Item.", "Session"),
    "stopSession": ("Beendet die Arbeitssession an einem Item.", "Session"),
    "reportComplete": ("Meldet ein Item als fertig (inkl. Fotos).", "Aktualisiertes Item"),
    "reportRework": ("Meldet Nacharbeit an einem Item.", "Aktualisiertes Item"),
    "findProjects": ("Listet dem Kunden-PL zugeordnete Projekte.", "Projekt-Liste"),
    "findWorkItems": ("Listet Work-Items für den Kunden-PL.", "Item-Liste"),
    "findWorkItem": ("Lädt ein Work-Item für den Kunden-PL.", "Item"),
    "forceComplete": ("Setzt ein Item seitens Kunden-PL auf fertig.", "Aktualisiertes Item"),
    "getSystemInfo": ("Sammelt System-/Host-Informationen.", "SystemInfo"),
    "updatePackages": ("Aktualisiert Systempakete (Wartung).", "Update-Ergebnis"),
    "sshExec": ("Führt einen Remote-Befehl per SSH aus.", "Kommandoausgabe"),
    "getDockerMemory": ("Liest Docker-Speicherverbrauch.", "Memory-Info"),
    "getTopMemoryProcesses": ("Listet speicherintensive Prozesse.", "Prozessliste"),
    "formatBytes": ("Formatiert Byte-Angaben lesbar.", "Formatierter String"),
    "getMany": ("Liest mehrere Einstellungsschlüssel.", "Key-Value-Map"),
    "set": ("Setzt einen Einstellungswert.", "Gespeicherter Wert"),
    "setMany": ("Setzt mehrere Einstellungswerte.", "Gespeicherte Werte"),
    "delete": ("Löscht einen Einstellungsschlüssel.", "Ergebnis"),
    "findForEntity": ("Listet Ordner einer Entität (Kunde/Projekt/…).", "Ordnerliste"),
    "serializeJob": ("Serialisiert einen Backup-Job für die API.", "DTO"),
    "safeJson": ("Parst JSON robust (Fallback bei Fehlern).", "Geparstes Objekt oder Fallback"),
    "validateScope": ("Prüft den Gültigkeitsbereich einer Pausenregel.", "void"),
    "validateThresholds": ("Prüft Schwellwerte einer Pausenregel.", "void"),
    "buildLineData": ("Baut Rechnungspositionsdaten.", "Positionszeilen"),
    "computeTotals": ("Berechnet Rechnungssummen (Netto/Steuer/Brutto).", "Summenobjekt"),
    "drawHeader": ("Zeichnet den PDF-Kopf.", "void"),
    "drawRecipient": ("Zeichnet den Empfängerblock im PDF.", "void"),
    "drawMeta": ("Zeichnet Metadaten (Nummer, Datum) im PDF.", "void"),
    "drawLineTable": ("Zeichnet die Positionstabelle im PDF.", "void"),
    "drawTotals": ("Zeichnet die Summen im PDF.", "void"),
    "drawPaymentNote": ("Zeichnet den Zahlungshinweis im PDF.", "void"),
    "drawFooter": ("Zeichnet die PDF-Fußzeile.", "void"),
    "drawRow": ("Zeichnet eine Tabellenzeile im PDF.", "void"),
    "drawSignatureBox": ("Zeichnet das Unterschriftenfeld im PDF.", "void"),
    "aggregateDays": ("Aggregiert Tageswerte für den Stundenzettel.", "Tagesaggregation"),
    "findOneForUser": ("Lädt einen Stundenzettel mit Berechtigungsprüfung.", "Stundenzettel"),
    "assertOwnWorker": ("Stellt sicher, dass der Aufrufer der betroffene Monteur ist.", "void"),
    "assertSubcontractorRule": ("Prüft Regeln für Nachunternehmer-Zuordnung.", "void"),
    "isWorkerType": ("Typwächter für WorkerType.", "boolean"),
    "isAvailability": ("Typwächter für Availability.", "boolean"),
    "findLanguages": ("Listet Sprachen eines Monteurs.", "Sprachliste"),
    "createLanguage": ("Fügt eine Sprache hinzu.", "Neue Sprache"),
    "updateLanguage": ("Aktualisiert eine Sprache.", "Aktualisierte Sprache"),
    "removeLanguage": ("Entfernt eine Sprache.", "Ergebnis"),
    "findCertifications": ("Listet Zertifikate eines Monteurs.", "Zertifikatsliste"),
    "toParseInputs": ("Bereitet Rohdaten für den Import-Parser vor.", "Parse-Inputs"),
    "validatePdfFile": ("Validiert eine hochgeladene PDF-Datei.", "void"),
    "validateCommitItems": ("Validiert Items vor dem PDF-Import-Commit.", "void"),
    "ensureProject": ("Stellt sicher, dass das Projekt existiert.", "Projekt"),
    "ensureItem": ("Stellt sicher, dass das Work-Item existiert.", "Work-Item"),
    "ensureBlock": ("Stellt sicher, dass der Block existiert.", "Block"),
    "listCandidates": ("Listet Kandidaten für die Kunden-PL-Zuordnung.", "Kandidatenliste"),
    "issueToken": ("Stellt JWT aus und persistiert ggf. die Session.", "LoginResponse"),
    "computeExpiry": ("Berechnet das Session-Ablaufdatum aus JWT_EXPIRES_IN.", "Date"),
    "uploadMultiple": ("Lädt mehrere Dateien hoch.", "Liste der Upload-Metadaten"),
    "replace": ("Ersetzt eine vorhandene Datei.", "Aktualisierte Metadaten"),
}


def indent_of(line: str) -> str:
    return re.match(r"^(\s*)", line).group(1)


def parse_params(sig: str) -> list[tuple[str, str]]:
    """Extrahiert (name, type) aus Parameterliste; grob, ohne verschachtelte Generics-Perfektion."""
    # sig is content inside (...)
    params = []
    depth = 0
    current = []
    for ch in sig:
        if ch in "<([{":
            depth += 1
            current.append(ch)
        elif ch in ">)]}":
            depth = max(0, depth - 1)
            current.append(ch)
        elif ch == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                params.append(part)
            current = []
        else:
            current.append(ch)
    part = "".join(current).strip()
    if part:
        params.append(part)

    result = []
    for p in params:
        p = p.strip()
        if not p or p.startswith("..."):
            # rest param
            name = p.lstrip(".").split(":")[0].strip().lstrip(".")
            typ = p.split(":", 1)[1].strip() if ":" in p else "unknown"
            if name:
                result.append((name.replace("...", ""), typ))
            continue
        # decorators like @Body() dto: LoginDto
        p = re.sub(r"@\w+(?:\([^)]*\))?\s*", "", p)
        p = re.sub(r"^(private|public|protected|readonly)\s+", "", p)
        if ":" in p:
            name, typ = p.split(":", 1)
            name = name.strip().rstrip("?")
            typ = typ.strip()
            # default value
            if "=" in typ:
                typ = typ.split("=", 1)[0].strip()
        else:
            name = p.split("=")[0].strip().rstrip("?")
            typ = "unknown"
        if name and re.match(r"^[a-zA-Z_][\w]*$", name):
            result.append((name, typ))
    return result


def param_desc(name: str, typ: str) -> str:
    n = name.lower()
    mapping = {
        "id": "Primärschlüssel der Entität",
        "dto": "Request-Body / Eingabedaten",
        "email": "E-Mail-Adresse",
        "password": "Klartext-Passwort (wird gehasht geprüft)",
        "pin": "PIN-Code (Klartext, Abgleich gegen Hash)",
        "token": "JWT bzw. Session-Token",
        "user": "Authentifizierter Akteur aus dem Request-Kontext",
        "workerid": "ID des Monteurs",
        "projectid": "ID des Projekts",
        "customerid": "ID des Kunden",
        "itemid": "ID des Work-Items",
        "blockid": "ID des Work-Item-Blocks",
        "file": "Hochgeladene Datei (Multer)",
        "files": "Hochgeladene Dateien (Multer)",
        "query": "Query-Parameter der Anfrage",
        "params": "Filter-, Sortier- und/oder Pagination-Parameter",
        "page": "Seitennummer (1-basiert)",
        "limit": "Seitengröße",
        "search": "Freitextsuche",
        "authheader": "Authorization-Header (Bearer …)",
        "req": "Express/Nest Request-Objekt",
        "res": "Express/Nest Response-Objekt",
        "context": "Nest ExecutionContext",
        "next": "Interceptor-Call-Handler",
        "exception": "Geworfene HTTP-Exception",
        "host": "ArgumentHost für Exception-Filter",
        "key": "Einstellungs- oder Storage-Schlüssel",
        "keys": "Liste von Schlüsseln",
        "value": "Zu setzender Wert",
        "values": "Key-Value-Paare",
        "config": "Konfigurationsobjekt",
        "buffer": "Binärdaten",
        "pdfbuffer": "PDF als Buffer",
        "pagenumber": "1-basierte PDF-Seitennummer",
        "options": "Optionale Einstellungen",
        "data": "Nutzdaten",
        "ids": "Liste von IDs",
        "status": "Zielstatus",
        "week": "ISO-Woche / Wochenkennzeichen",
        "year": "Jahr",
        "from": "Zeitraum-Beginn",
        "to": "Zeitraum-Ende",
        "address": "Adresszeile für Geocoding",
        "command": "Shell-/SSH-Befehl",
        "bytes": "Byte-Anzahl",
        "text": "Eingabetext",
        "slug": "URL-/Pfad-Slug",
        "path": "Dateipfad",
        "filename": "Dateiname",
        "mimetype": "MIME-Type",
        "entitytype": "Entitätstyp (Customer, Project, …)",
        "entityid": "ID der verknüpften Entität",
        "folderid": "Dokumentordner-ID",
        "actor": "Ausführender Akteur (Audit)",
        "role": "Rollen-Code",
        "roles": "Erforderliche Rollen",
    }
    if n in mapping:
        base = mapping[n]
    elif n.endswith("id"):
        base = f"ID ({name})"
    elif n.endswith("dto"):
        base = "Eingabe-DTO"
    elif "filter" in n:
        base = "Filterkriterien"
    else:
        base = f"Parameter `{name}`"
    if typ and typ != "unknown":
        short = typ.replace("\n", " ")
        if len(short) > 80:
            short = short[:77] + "…"
        return f"{base} ({short})"
    return base


def throws_for(method: str, body_preview: str) -> list[str]:
    throws = []
    if "NotFoundException" in body_preview:
        throws.append("@throws {NotFoundException} Wenn der Datensatz nicht gefunden wird")
    if "UnauthorizedException" in body_preview:
        throws.append("@throws {UnauthorizedException} Bei fehlender oder ungültiger Authentifizierung")
    if "ForbiddenException" in body_preview:
        throws.append("@throws {ForbiddenException} Wenn die Berechtigung fehlt")
    if "BadRequestException" in body_preview:
        throws.append("@throws {BadRequestException} Bei ungültigen Eingaben")
    if "ConflictException" in body_preview:
        throws.append("@throws {ConflictException} Bei Konflikten (z. B. Duplikate)")
    # method-name heuristics if body not scanned deeply
    if method in ("login", "pinLogin", "userPinLogin") and not throws:
        throws.append("@throws {UnauthorizedException} Bei ungültigen Anmeldedaten")
    return throws


def method_docs(name: str, params: list[tuple[str, str]], ret: str, existing_summary: str | None, body: str, is_private: bool) -> str:
    if name in GENERIC_METHOD:
        summary, ret_default = GENERIC_METHOD[name]
    else:
        # camelCase → words
        words = re.sub(r"([A-Z])", r" \1", name).strip()
        summary = f"Führt `{name}` aus ({words})."
        ret_default = "Ergebnis"

    if existing_summary:
        summary = existing_summary.strip().rstrip(".")
        if not summary.endswith("."):
            # keep as-is; add period later
            pass
        summary = summary.rstrip(".") + "."

    if is_private and not existing_summary:
        summary = f"Interner Helfer: {summary[0].lower() + summary[1:] if summary else name}"

    lines = ["/**", f" * {summary}", " *"]
    for pname, ptyp in params:
        lines.append(f" * @param {pname} - {param_desc(pname, ptyp)}")
    ret_clean = (ret or "").strip()
    if ret_clean and ret_clean != "void":
        # simplify Promise<X>
        m = re.match(r"Promise<(.+)>$", ret_clean)
        inner = m.group(1) if m else ret_clean
        if name in GENERIC_METHOD:
            lines.append(f" * @returns {GENERIC_METHOD[name][1]} ({inner})")
        else:
            lines.append(f" * @returns {ret_default if ret_default != 'Ergebnis' else inner}")
    elif ret_clean == "void":
        lines.append(" * @returns void")
    else:
        if name in GENERIC_METHOD:
            lines.append(f" * @returns {GENERIC_METHOD[name][1]}")

    for t in throws_for(name, body):
        lines.append(f" * {t}")

    # remove trailing lone " *" if no tags after summary - keep for readability
    if len(lines) == 3 and lines[-1] == " *":
        lines.pop()
    lines.append(" */")
    return "\n".join(lines)


def extract_existing_summary(block: str) -> str | None:
    # /** ... */ possibly multi-line; take first prose line without @
    inner = block.strip()
    if inner.startswith("/**"):
        inner = inner[3:]
    if inner.endswith("*/"):
        inner = inner[:-2]
    parts = []
    for line in inner.splitlines():
        s = line.strip()
        if s.startswith("*"):
            s = s[1:].strip()
        if not s or s.startswith("@"):
            if s.startswith("@"):
                break
            continue
        parts.append(s)
    if not parts:
        return None
    return " ".join(parts)


def has_rich_jsdoc(block: str) -> bool:
    return "@param" in block or "@returns" in block or "@throws" in block


def file_header_for(path: Path, text: str) -> str:
    rel = str(path).replace("\\", "/")
    for key, (a, b) in DOMAIN.items():
        if rel.endswith(key):
            return f"/**\n * {a}\n * {b}\n */\n\n"

    # class name
    m = re.search(r"export class (\w+)", text)
    cls = m.group(1) if m else path.stem
    kind = "Modul"
    if cls.endswith("Service"):
        kind = "Service"
        domain = cls[: -len("Service")]
    elif cls.endswith("Controller"):
        kind = "Controller"
        domain = cls[: -len("Controller")]
    elif cls.endswith("Guard"):
        kind = "Guard"
        domain = cls[: -len("Guard")]
    elif cls.endswith("Interceptor"):
        kind = "Interceptor"
        domain = cls[: -len("Interceptor")]
    elif cls.endswith("Filter"):
        kind = "Filter"
        domain = cls[: -len("Filter")]
    else:
        domain = cls

    # humanize CamelCase
    label = re.sub(r"([A-Z])", r" \1", domain).strip()
    if kind == "Service":
        return (
            f"/**\n"
            f" * {kind} für {label}.\n"
            f" * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.\n"
            f" */\n\n"
        )
    if kind == "Controller":
        return (
            f"/**\n"
            f" * HTTP-API für {label}.\n"
            f" * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.\n"
            f" */\n\n"
        )
    if kind == "Guard":
        return (
            f"/**\n"
            f" * Auth-Guard: {label}.\n"
            f" * Schützt Routen durch Prüfung von Authentifizierung bzw. Autorisierung.\n"
            f" */\n\n"
        )
    return (
        f"/**\n"
        f" * {kind}: {label}.\n"
        f" * Teil der Office-API unter apps/api.\n"
        f" */\n\n"
    )


def ensure_file_header(path: Path, text: str) -> str:
    stripped = text.lstrip()
    # already has module header before first import/export?
    before = re.split(r"\n(?=import |export )", text, maxsplit=1)
    head = before[0] if before else ""
    if head.strip().startswith("/**") and head.count("\n") >= 2:
        # check it's not just a class doc misplaced - if imports follow after comment ok
        return text
    # if file starts with import, prepend
    header = file_header_for(path, text)
    if stripped.startswith("import ") or stripped.startswith("export ") or stripped.startswith("@"):
        return header + text
    if stripped.startswith("/**"):
        # replace thin header or leave if rich? if first comment is class-level after imports later - rare
        return text
    return header + text


def process_ts(path: Path, text: str) -> str:
    text = ensure_file_header(path, text)
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # detect method start (class member at 2-space indent)
        m = re.match(
            r"^(\s*)((?:public|private|protected)\s+)?(async\s+)?([a-zA-Z_][\w]*)\s*\(",
            line,
        )
        if m and m.group(4) not in (
            "if", "for", "while", "switch", "catch", "constructor", "return", "function", "get", "set",
        ):
            # 'get'/'set' as accessors are tricky - allow getX but plain get is a method name we want
            pass
        if m and m.group(4) not in ("if", "for", "while", "switch", "catch", "constructor", "function"):
            indent, vis, async_, name = m.group(1), m.group(2) or "", m.group(3) or "", m.group(4)
            # only class-level (2 spaces) or nested? stick to indent of 2 spaces exactly for Nest classes
            if indent == "  " and re.match(r"^[a-z]", name):
                # collect full signature until '{' or ';'
                sig_lines = [line]
                j = i
                combined = line.rstrip("\n")
                while "{" not in combined and ";" not in combined and j + 1 < len(lines):
                    j += 1
                    sig_lines.append(lines[j])
                    combined += " " + lines[j].strip()
                # extract params
                pm = re.search(r"\((.*)\)\s*(?::\s*([^{;]+))?\s*[{;]", combined, re.S)
                params = parse_params(pm.group(1)) if pm else []
                ret = (pm.group(2) or "").strip() if pm else ""
                # body preview: next ~40 lines
                body = "".join(lines[j : min(len(lines), j + 50)])
                is_private = "private" in vis

                # look back over decorators to find existing JSDoc
                k = len(out) - 1
                while k >= 0 and (
                    out[k].strip().startswith("@")
                    or out[k].strip() == ""
                    or out[k].strip().startswith("//")
                ):
                    k -= 1
                existing_block = None
                existing_summary = None
                replace_from = None
                if k >= 0 and "*/" in out[k]:
                    end_k = k
                    while k >= 0 and "/**" not in out[k]:
                        k -= 1
                    if k >= 0:
                        existing_block = "".join(out[k : end_k + 1])
                        existing_summary = extract_existing_summary(existing_block)
                        if has_rich_jsdoc(existing_block):
                            # keep as-is
                            out.extend(sig_lines)
                            i = j + 1
                            continue
                        replace_from = k

                doc = method_docs(name, params, ret, existing_summary, body, is_private)
                doc_indented = "\n".join(indent + dl if idx else indent + dl for idx, dl in enumerate(doc.split("\n")))
                # fix: each line needs indent
                doc_indented = "\n".join(indent + dl for dl in doc.split("\n")) + "\n"

                if replace_from is not None:
                    # remove old comment but keep decorators after it
                    out = out[:replace_from]
                    # decorators were between comment and method - they were already skipped in lookback
                    # Actually lookback walked from end of out; decorators are still in out after comment.
                    # Wait: we walked k from len(out)-1 skipping decorators, so decorators ARE still in out after comment.
                    # When we slice out[:replace_from], we remove comment AND everything after including decorators!
                    # Need to keep decorators.
                    # Re-do: find comment range and only delete those lines.
                    # Recompute properly:
                    out = lines_rebuild_needed = True  # marker - handle below differently
                # Simpler approach: don't use out lookback with mutation; scan original
                
                # FALLBACK simpler path implemented in process_ts_v2
                out.extend(sig_lines)
                i = j + 1
                continue
        out.append(line)
        i += 1
    return "".join(out)


def process_ts_v2(path: Path, text: str) -> str:
    """Zuverlässigere Variante: Zeilenweise mit Index im Original."""
    text = ensure_file_header(path, text)
    lines = text.splitlines(keepends=True)
    # Precompute which line indices are method declarations
    insertions: list[tuple[int, str, int | None]] = []  # (method_line, doc, delete_comment_start)

    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(
            r"^(  )((?:public|private|protected)\s+)?(async\s+)?([a-zA-Z_][\w]*)\s*\(",
            line,
        )
        if not m:
            i += 1
            continue
        name = m.group(4)
        if name in ("if", "for", "while", "switch", "catch", "constructor", "function"):
            i += 1
            continue
        vis = m.group(2) or ""
        # full signature
        j = i
        combined = line.rstrip("\n")
        while "{" not in combined and not combined.rstrip().endswith(";") and j + 1 < len(lines):
            j += 1
            combined += " " + lines[j].strip()
        pm = re.search(r"\((.*)\)\s*(?::\s*([^{;]+))?\s*[{;]", combined, re.S)
        params = parse_params(pm.group(1)) if pm else []
        ret = (pm.group(2) or "").strip() if pm else ""
        body = "".join(lines[j : min(len(lines), j + 60)])
        is_private = "private" in vis

        # look back for decorators / comment
        k = i - 1
        while k >= 0 and (
            lines[k].strip().startswith("@")
            or lines[k].strip() == ""
            or (lines[k].strip().startswith("//") and "eslint" not in lines[k])
        ):
            k -= 1
        delete_start = None
        existing_summary = None
        if k >= 0 and "*/" in lines[k]:
            end_c = k
            while k >= 0 and "/**" not in lines[k]:
                k -= 1
            if k >= 0:
                block = "".join(lines[k : end_c + 1])
                if has_rich_jsdoc(block):
                    i = j + 1
                    continue
                existing_summary = extract_existing_summary(block)
                delete_start = k

        # skip trivial property-like? already methods
        doc = method_docs(name, params, ret, existing_summary, body, is_private)
        doc_txt = "\n".join("  " + dl for dl in doc.split("\n")) + "\n"
        insertions.append((i, doc_txt, delete_start))
        i = j + 1

    if not insertions and text == ensure_file_header(path, path.read_text() if False else text):
        return text

    # Apply from bottom to top
    for method_line, doc_txt, delete_start in reversed(insertions):
        if delete_start is not None:
            # delete from delete_start through first */ before method (inclusive), keep decorators
            end_c = method_line - 1
            while end_c >= delete_start and "*/" not in lines[end_c]:
                end_c -= 1
            # remove comment lines delete_start..end_c inclusive; also remove one trailing blank after comment if present before decorators
            del lines[delete_start : end_c + 1]
            shift = end_c + 1 - delete_start
            method_line -= shift
        lines.insert(method_line, doc_txt)

    return "".join(lines)


def process_util_exports(path: Path, text: str) -> str:
    """Für util/config/decorator Dateien: File-Header + exportierte Funktionen."""
    text = ensure_file_header(path, text)
    lines = text.splitlines(keepends=True)
    insertions = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(
            r"^(export\s+)?(async\s+)?function\s+([a-zA-Z_][\w]*)\s*\(",
            line,
        )
        m2 = re.match(
            r"^export\s+(async\s+)?function\s+([a-zA-Z_][\w]*)\s*\(",
            line,
        )
        m3 = re.match(
            r"^export\s+const\s+([a-zA-Z_][\w]*)\s*=\s*(async\s*)?\(",
            line,
        )
        name = None
        if m2:
            name = m2.group(2)
        elif m3:
            name = m3.group(1)
        elif m and m.group(1):
            name = m.group(3)
        if not name:
            i += 1
            continue
        # existing comment?
        k = i - 1
        while k >= 0 and lines[k].strip() == "":
            k -= 1
        if k >= 0 and "*/" in lines[k]:
            end_c = k
            while k >= 0 and "/**" not in lines[k]:
                k -= 1
            if k >= 0:
                block = "".join(lines[k : end_c + 1])
                if has_rich_jsdoc(block):
                    i += 1
                    continue
                summary = extract_existing_summary(block)
                # expand
                j = i
                combined = line.rstrip("\n")
                while "{" not in combined and "=>" not in combined and j + 1 < len(lines):
                    j += 1
                    combined += " " + lines[j].strip()
                    if len(combined) > 2000:
                        break
                pm = re.search(r"\((.*)\)\s*(?::\s*([^{=]+))?\s*(?:\{|=>)", combined, re.S)
                params = parse_params(pm.group(1)) if pm else []
                ret = (pm.group(2) or "").strip() if pm else ""
                doc = method_docs(name, params, ret, summary, "".join(lines[i:i+40]), False)
                doc_txt = "\n".join(doc.split("\n")) + "\n"
                insertions.append((i, doc_txt, k))
                i = j + 1
                continue
        # no comment
        j = i
        combined = line.rstrip("\n")
        while "{" not in combined and "=>" not in combined and j + 1 < len(lines):
            j += 1
            combined += " " + lines[j].strip()
            if len(combined) > 2000:
                break
        pm = re.search(r"\((.*)\)\s*(?::\s*([^{=]+))?\s*(?:\{|=>)", combined, re.S)
        params = parse_params(pm.group(1)) if pm else []
        ret = (pm.group(2) or "").strip() if pm else ""
        doc = method_docs(name, params, ret, None, "".join(lines[i:i+40]), False)
        doc_txt = "\n".join(doc.split("\n")) + "\n"
        insertions.append((i, doc_txt, None))
        i = j + 1

    for method_line, doc_txt, delete_start in reversed(insertions):
        if delete_start is not None:
            end_c = method_line - 1
            while end_c >= delete_start and "*/" not in lines[end_c]:
                end_c -= 1
            del lines[delete_start : end_c + 1]
            method_line -= end_c + 1 - delete_start
        lines.insert(method_line, doc_txt)
    return "".join(lines)


def should_process(path: Path) -> bool:
    s = str(path)
    if "/dist/" in s or ".next" in s:
        return False
    return path.suffix == ".ts" and not path.name.endswith(".spec.ts")


def main(argv: list[str]) -> int:
    roots = [Path(a) for a in argv[1:]] or [Path("apps/api/src")]
    changed = 0
    for root in roots:
        paths = []
        if root.is_file():
            paths = [root]
        else:
            for pat in (
                "**/*.service.ts",
                "**/*.controller.ts",
                "**/*.guard.ts",
                "**/*.decorator.ts",
                "**/*.filter.ts",
                "**/*.interceptor.ts",
                "**/*.util.ts",
                "**/*.config.ts",
            ):
                paths.extend(root.glob(pat))
        for path in sorted(set(paths)):
            if not should_process(path):
                continue
            original = path.read_text(encoding="utf-8")
            name = path.name
            if name.endswith((".util.ts", ".config.ts", ".decorator.ts")):
                updated = process_util_exports(path, original)
                # also class-based decorators? createParamDecorator etc. - header enough
                if "export class" in original:
                    updated = process_ts_v2(path, original)
            else:
                updated = process_ts_v2(path, original)
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                changed += 1
                print(f"updated {path}")
    print(f"done, {changed} files changed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
