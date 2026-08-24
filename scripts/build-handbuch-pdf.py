#!/usr/bin/env python3
"""Erzeugt HANDBUCH.pdf (helles Design, druckgeeignet) aus docs/handbuch-screens/."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "handbuch-screens"
JPG = SRC / "pdf"
OUT = ROOT / "HANDBUCH.pdf"
FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

SHOTS = [
    "01-dashboard-menu.png",
    "08-kunden-liste.png",
    "02-kunde-neu.png",
    "03-projekt-neu.png",
    "04-monteur-neu.png",
    "05-sub-neu.png",
    "06-monteur-sub-zuordnung.png",
    "07-projekt-monteur-zuordnen.png",
]


def prepare_jpgs() -> None:
    JPG.mkdir(parents=True, exist_ok=True)
    for name in SHOTS:
        p = SRC / name
        if not p.exists():
            raise SystemExit(f"Screenshot fehlt: {p}")
        im = Image.open(p).convert("RGB")
        max_w = 980
        if im.width > max_w:
            h = int(im.height * max_w / im.width)
            im = im.resize((max_w, h), Image.Resampling.LANCZOS)
        im.save(JPG / f"{p.stem}.jpg", "JPEG", quality=72, optimize=True)


class Handbook(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(10)
        self.set_font("Body", "B", 9)
        self.set_text_color(20, 20, 20)
        self.cell(95, 5, "Viva Home")
        self.set_font("Body", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(79, 5, "Office Kurzanleitung 1.0.0", align="R")
        self.ln(6)
        self.set_draw_color(200, 200, 200)
        self.line(16, self.get_y(), 194, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-16)
        self.set_draw_color(200, 200, 200)
        self.line(16, self.get_y(), 194, self.get_y())
        self.ln(2)
        self.set_font("Body", "", 8)
        self.set_text_color(90, 90, 90)
        self.cell(110, 6, "Viva Home  |  © Viva Home GmbH")
        self.cell(64, 6, f"Seite {self.page_no()} von {{nb}}", align="R")


def build() -> None:
    prepare_jpgs()
    pdf = Handbook(format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_font("Body", "", FONT)
    pdf.add_font("Body", "B", FONT)
    pdf.add_font("Body", "I", FONT)
    pdf.set_margins(16, 20, 16)

    def reset_x() -> None:
        pdf.set_x(pdf.l_margin)

    def h1(text: str) -> None:
        reset_x()
        pdf.set_font("Body", "B", 15)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(0, 7.5, text)
        reset_x()
        pdf.ln(2)

    def h2(text: str) -> None:
        pdf.ln(2)
        reset_x()
        pdf.set_font("Body", "B", 11.5)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(0, 6.5, text)
        reset_x()
        pdf.ln(1)

    def body(text: str, size: float = 10.2) -> None:
        reset_x()
        pdf.set_font("Body", "", size)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 5.1, text)
        reset_x()
        pdf.ln(1)

    def bullet(text: str) -> None:
        body(f"•  {text}")

    def step(n: int, text: str) -> None:
        body(f"{n}.  {text}")

    def img(name: str, caption: str, width: float = 155) -> None:
        path = JPG / name
        if pdf.get_y() > 155:
            pdf.add_page()
        pdf.ln(1)
        x = (210 - width) / 2
        pdf.image(str(path), x=x, w=width)
        pdf.ln(1)
        reset_x()
        pdf.set_font("Body", "I", 8)
        pdf.set_text_color(100, 100, 100)
        pdf.multi_cell(0, 4, caption, align="C")
        reset_x()
        pdf.ln(2)

    def cover_line(text: str, size: float = 11, bold: bool = False) -> None:
        reset_x()
        pdf.set_font("Body", "B" if bold else "", size)
        pdf.set_text_color(15, 23, 42) if bold else pdf.set_text_color(70, 70, 70)
        pdf.multi_cell(0, 6 if size < 16 else 10, text, align="C")
        reset_x()

    # Cover
    pdf.add_page()
    pdf.ln(20)
    cover_line("Viva Home", size=24, bold=True)
    cover_line("Viva Home GmbH", size=12, bold=True)
    cover_line("Am Ringwall 16")
    cover_line("51491 Overath")
    pdf.ln(8)
    y = pdf.get_y()
    pdf.set_draw_color(180, 180, 180)
    pdf.line(60, y, 150, y)
    pdf.ln(10)
    cover_line("Office – Kurzanleitung", size=18, bold=True)
    cover_line("Stammdaten anlegen und zuordnen")
    pdf.ln(3)
    cover_line("Version 1.0.0 (Production)  |  Stand 24.08.2026")
    cover_line("Büro: office.vivahome.de  |  Kiosk: work.vivahome.de")
    pdf.ln(10)
    body(
        "Diese Kurzanleitung beschreibt die festen Büro-Schritte für die "
        "Stammdaten: Kunde, Projekt, Monteur, Subunternehmen sowie die "
        "Zuordnungen Monteur↔Sub und Monteur↔Projekt. Die Screenshots stammen "
        "aus dem hellen App-Design und sind für den Ausdruck geeignet."
    )
    body(
        "Anmeldung Büro: E-Mail und Passwort. Monteure stempeln mit 6-stelliger "
        "PIN (Monteur-App oder Kiosk)."
    )
    h2("Inhalt")
    for line in [
        "1. Orientierung im Menü",
        "2. Kunde anlegen",
        "3. Projekt anlegen",
        "4. Monteur anlegen",
        "5. Subunternehmen anlegen",
        "6. Monteur einem Subunternehmen zuordnen",
        "7. Monteur einem Projekt zuweisen",
        "8. Stempel und Stundenzettel (Kurz)",
    ]:
        bullet(line)

    # 1
    pdf.add_page()
    h1("1. Orientierung im Menü")
    body(
        "Nach dem Login öffnet sich das Dashboard. Links steht die "
        "Hauptnavigation. Fuer die Stammdaten nutzen Sie vor allem:"
    )
    bullet("Kunden – Firmenkunden anlegen und pflegen")
    bullet("Projekte – Aufträge anlegen und Monteure zuweisen")
    bullet("Monteure – Personenstammdaten, PIN, Typ Angestellt/Sub")
    bullet("Subunternehmen – Firmen der Fremdmonteure")
    body(
        "Oben rechts können Sie das Design wechseln. Fuer Ausdrucke und diese "
        "Anleitung ist das helle Design vorgesehen."
    )
    img("01-dashboard-menu.jpg", "Abb. 1 – Dashboard mit Hauptmenue (helles Design)")
    img(
        "08-kunden-liste.jpg",
        "Abb. 2 – Kundenliste; Aktion „Neuer Kunde“ oben rechts",
    )

    # 2
    pdf.add_page()
    h1("2. Kunde anlegen")
    step(1, "Menü „Kunden“ öffnen.")
    step(2, "Oben rechts „Neuer Kunde“ wählen (Pfad: /customers/new).")
    step(
        3,
        "Mindestens den Firmennamen ausfüllen. Empfohlen: Adresse (Straße, "
        "PLZ, Ort), Status „Aktiv“.",
    )
    step(4, "„Speichern“ klicken. Die Kundennummer (z. B. K-2026-…) wird vergeben.")
    step(
        5,
        "Im Kundendetail bei Bedarf ergänzen: Kontakte, Niederlassungen, "
        "E-Mails, Bankverbindungen, Dokumente.",
    )
    body(
        "Hinweis: Der Google-Contacts-Sync gilt nur für Kontakte, bei denen "
        "die Sync-Option gesetzt ist (Einstellungen → Google Contacts)."
    )
    img("02-kunde-neu.jpg", "Abb. 3 – Eingabemaske „Neuen Kunden anlegen“")

    # 3
    pdf.add_page()
    h1("3. Projekt anlegen")
    step(1, "Menü „Projekte“ → „Neues Projekt“ (/projects/new).")
    step(2, "Pflicht: Titel und bestehender Kunde.")
    step(3, "Optional: Leistungsart und Priorität setzen.")
    step(4, "„Speichern“. Die Projektnummer (z. B. P-2026-…) wird vergeben.")
    step(
        5,
        "Im Projektdetail: Standorte pflegen und im Tab „Monteure“ die "
        "Zuweisungen setzen (siehe Abschnitt 7).",
    )
    body(
        "Wichtig für den Kiosk: Normale Monteure dürfen nur mit gültiger, "
        "aktiver Projektzuweisung einstempeln. Ausnahme ist der Master-Monteur."
    )
    img("03-projekt-neu.jpg", "Abb. 4 – Eingabemaske „Neues Projekt anlegen“")

    # 4
    pdf.add_page()
    h1("4. Monteur anlegen")
    step(1, "Menü „Monteure“ → „Neuer Monteur“ (/workers/new).")
    step(2, "Pflicht: Vorname und Nachname.")
    step(
        3,
        "Typ wählen: „Angestellt“ oder „Subunternehmen“. Verfügbarkeit "
        "z. B. „Verfügbar“.",
    )
    step(4, "„Speichern“. Die Monteurnummer (z. B. W-2026-…) wird vergeben.")
    step(
        5,
        "Im Detail: optional „Master-Monteur“ aktivieren; unter PIN eine "
        "6-stellige PIN setzen; bei Bedarf „Kiosk nutzen“ und Gültig ab/bis.",
    )
    body(
        "Die PIN gilt für Monteur-App und Kiosk (work.vivahome.de). Ohne "
        "Kiosk-Freigabe ist der PIN-Login am Kiosk gesperrt."
    )
    img("04-monteur-neu.jpg", "Abb. 5 – Eingabemaske „Neuen Monteur anlegen“")

    # 5
    pdf.add_page()
    h1("5. Subunternehmen anlegen")
    step(1, "Menü „Subunternehmen“ → „Neues Subunternehmen“.")
    step(2, "Pflicht: Firmenname. Empfohlen: Kontaktperson, E-Mail, Telefon, Adresse.")
    step(3, "Optional: Steuer- und Bankdaten.")
    step(4, "„Speichern“.")
    body(
        "Erst danach können Monteure vom Typ „Subunternehmen“ diesem Sub "
        "zugeordnet werden (Abschnitt 6)."
    )
    img("05-sub-neu.jpg", "Abb. 6 – Eingabemaske „Neues Subunternehmen anlegen“")

    # 6
    pdf.add_page()
    h1("6. Monteur einem Subunternehmen zuordnen")
    step(1, "Menü „Monteure“ → gewünschten Monteur öffnen.")
    step(2, "Tab „Stammdaten“ bearbeiten.")
    step(3, "Typ auf „Subunternehmen“ stellen.")
    step(4, "Im Pflichtfeld „Subunternehmen“ den Eintrag aus Abschnitt 5 wählen.")
    step(5, "„Speichern“.")
    bullet("Bei Typ „Angestellt“ wird die Sub-Zuordnung entfernt.")
    bullet(
        "Der Monteur bleibt in der Monteurliste sichtbar; der Sub erscheint "
        "in den Stammdaten."
    )
    img(
        "06-monteur-sub-zuordnung.jpg",
        "Abb. 7 – Beispiel: Typ „Subunternehmen“ mit gewähltem Sub",
    )

    # 7
    pdf.add_page()
    h1("7. Monteur einem Projekt zuweisen")
    h2("Weg A – vom Projekt (empfohlen)")
    step(1, "Menü „Projekte“ → Projekt öffnen.")
    step(2, "Tab „Monteure“ wählen.")
    step(3, "„Monteur zuordnen“ klicken.")
    step(
        4,
        "Zeitraum „Von“/„Bis“ setzen, Monteur auswählen, optional Funktion "
        "und Teamleitung.",
    )
    step(5, "„Speichern“. Die Zuweisung muss aktiv sein.")
    h2("Weg B – vom Monteur")
    step(1, "Monteur öffnen → Tab „Projekte & Teams“.")
    step(2, "Projekt und Datumsfenster setzen → speichern.")
    h2("Kiosk-Regel")
    body(
        "Zum Einstempeln muss die Zuweisung aktiv sein und das heutige Datum "
        "im Fenster Von–Bis liegen (oder Bis leer). Sonst meldet der Kiosk "
        "keine gueltige Zuweisung – ausser beim Master-Monteur."
    )
    img(
        "07-projekt-monteur-zuordnen.jpg",
        "Abb. 8 – Dialog „Monteur zuordnen“ am Projekt",
    )

    # 8
    pdf.add_page()
    h1("8. Stempel und Stundenzettel (Kurz)")
    bullet(
        "Kiosk einrichten: work.vivahome.de → Setup mit Admin-PIN → "
        "aktives Projekt zuweisen → Kiosk starten."
    )
    bullet("Einstempeln: Kiosk oder Monteur-App mit PIN.")
    bullet(
        "Stundenzettel im Büro: Menü „Stundenzettel“ → Anlegen/öffnen "
        "(Monteur, Projekt, Kalenderwoche; optional bis KW)."
    )
    bullet(
        "Ohne Handy: Stundenzettel im Entwurf öffnen → „Tag erfassen“ "
        "oder Tageszeile bearbeiten."
    )
    bullet(
        "Neu aus Stempelungen: Im Entwurf „Aus Stempelungen neu laden“ "
        "(überschreibt die Woche aus den Stempeln)."
    )
    body("Backup-Zeitplan: Einstellungen → Backup (Uhrzeit Europe/Berlin).")

    h2("Empfohlene Reihenfolge für einen neuen Auftrag")
    for i, text in enumerate(
        [
            "Kunde anlegen oder bestehenden Kunden wählen",
            "Projekt anlegen und Kunden verknuepfen",
            "Subunternehmen anlegen (nur bei Fremdmonteuren)",
            "Monteure anlegen und ggf. dem Sub zuordnen",
            "Monteure dem Projekt zuweisen (Datum beachten)",
            "PIN setzen und ggf. Kiosk-Freigabe aktivieren",
            "Kiosk auf der Baustelle auf dieses Projekt einrichten",
        ],
        1,
    ):
        step(i, text)

    pdf.ln(8)
    reset_x()
    pdf.set_font("Body", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        5,
        "Viva Home  |  © Viva Home GmbH  |  Am Ringwall 16, 51491 Overath  |  "
        "Office Version 1.0.0",
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {pdf.page_no()} pages)")


if __name__ == "__main__":
    build()
