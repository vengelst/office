#!/usr/bin/env python3
"""Erzeugt HANDBUCH.pdf aus Screenshots unter docs/handbuch-screens/."""

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
        im.save(JPG / f"{p.stem}.jpg", "JPEG", quality=70, optimize=True)


class Handbook(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(10)
        self.set_font("Body", "B", 9)
        self.set_text_color(20, 20, 20)
        self.cell(95, 5, "Viva Home GmbH")
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
        self.cell(95, 6, "Am Ringwall 16 | 51491 Overath")
        self.cell(79, 6, f"Seite {self.page_no()} von {{nb}}", align="R")


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
        pdf.set_font("Body", "B", 16)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(0, 8, text)
        reset_x()
        pdf.ln(2)

    def h2(text: str) -> None:
        pdf.ln(2)
        reset_x()
        pdf.set_font("Body", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(0, 7, text)
        reset_x()
        pdf.ln(1)

    def body(text: str, size: float = 10.5) -> None:
        reset_x()
        pdf.set_font("Body", "", size)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 5.2, text)
        reset_x()
        pdf.ln(1)

    def bullet(text: str) -> None:
        body(f"•  {text}")

    def step(n: int, text: str) -> None:
        body(f"{n}.  {text}")

    def img(name: str, caption: str, width: float = 155) -> None:
        path = JPG / name
        if pdf.get_y() > 160:
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

    # Cover
    pdf.add_page()
    pdf.ln(22)

    def cover_line(text: str, size: float = 11, bold: bool = False) -> None:
        reset_x()
        pdf.set_font("Body", "B" if bold else "", size)
        pdf.set_text_color(15, 23, 42) if bold else pdf.set_text_color(70, 70, 70)
        pdf.multi_cell(0, 6 if size < 16 else 10, text, align="C")
        reset_x()

    cover_line("Viva Home GmbH", size=22, bold=True)
    cover_line("Am Ringwall 16")
    cover_line("51491 Overath")
    pdf.ln(8)
    y = pdf.get_y()
    pdf.set_draw_color(180, 180, 180)
    pdf.line(60, y, 150, y)
    pdf.ln(10)
    cover_line("Office – Kurzanleitung", size=18, bold=True)
    cover_line("Stammdaten: Kunden, Projekte, Monteure, Subunternehmen")
    pdf.ln(3)
    cover_line("Version 1.0.0 (Production)  |  Stand 24.08.2026")
    cover_line("App: office.vivahome.de   |   Kiosk: work.vivahome.de")
    pdf.ln(12)
    body(
        "Diese Anleitung zeigt die wichtigsten Schritte im Büro mit Screenshots "
        "aus der App. Login: E-Mail + Passwort. Monteure stempeln mit PIN (App/Kiosk)."
    )
    h2("Inhalt")
    for line in [
        "1. Menü & Orientierung",
        "2. Kunde anlegen",
        "3. Projekt anlegen",
        "4. Monteur (Engineer) anlegen",
        "5. Subunternehmen anlegen",
        "6. Monteur einem Subunternehmen zuordnen",
        "7. Monteur einem Projekt zuweisen",
        "8. Kurz: Stempel & Stundenzettel",
    ]:
        bullet(line)

    pdf.add_page()
    h1("1. Menü & Orientierung")
    body(
        "Links in der Seitenleiste finden Sie die Module. Für diese Anleitung "
        "sind besonders relevant: Kunden, Projekte, Monteure, Subunternehmen."
    )
    img("01-dashboard-menu.jpg", "Abb. 1 – Dashboard mit Hauptmenü (Seitenleiste)")
    img("08-kunden-liste.jpg", "Abb. 2 – Kundenliste; „Neuer Kunde“ oben rechts")

    pdf.add_page()
    h1("2. Kunde anlegen")
    step(1, "Menü Kunden → Neuer Kunde (oder /customers/new).")
    step(2, "Firmenname und Adresse ausfüllen; optional Bewertung, Notizen.")
    step(3, "Speichern – Kundennummer (z. B. K-2026-…) wird vergeben.")
    step(4, "Im Detail ergänzen: Kontakte, Niederlassungen, E-Mails/Bank, Dokumente.")
    img("02-kunde-neu.jpg", "Abb. 3 – Maske „Neuen Kunden anlegen“")

    pdf.add_page()
    h1("3. Projekt anlegen")
    step(1, "Menü Projekte → Neues Projekt.")
    step(2, "Titel und Kunde wählen; Leistungsart/Priorität nach Bedarf.")
    step(3, "Speichern – Projektnummer (z. B. P-2026-…) wird vergeben.")
    step(4, "Im Detail: Standorte, Tab Monteure (Zuweisungen), Dokumente …")
    body(
        "Ohne gültige Projektzuweisung dürfen normale Monteure am Kiosk nicht "
        "einstempeln (Ausnahme: Master-Monteur)."
    )
    img("03-projekt-neu.jpg", "Abb. 4 – Maske „Neues Projekt anlegen“")

    pdf.add_page()
    h1("4. Monteur (Engineer) anlegen")
    step(1, "Menü Monteure → Neuer Monteur.")
    step(2, "Vorname, Nachname; Typ Angestellt oder Subunternehmen.")
    step(3, "Speichern – Monteurnummer (z. B. W-2026-…) wird vergeben.")
    step(
        4,
        "Im Detail: optional Master-Monteur; PIN setzen; ggf. „Kiosk nutzen“ "
        "und Gültigkeit.",
    )
    img("04-monteur-neu.jpg", "Abb. 5 – Maske „Neuen Monteur anlegen“")

    pdf.add_page()
    h1("5. Subunternehmen anlegen")
    step(1, "Menü Subunternehmen → Neues Subunternehmen.")
    step(2, "Firmenname und Kontaktdaten eintragen; optional Steuer/Bank.")
    step(3, "Speichern.")
    img("05-sub-neu.jpg", "Abb. 6 – Maske „Neues Subunternehmen anlegen“")

    pdf.add_page()
    h1("6. Monteur einem Subunternehmen zuordnen")
    step(1, "Monteure → gewünschten Monteur öffnen.")
    step(2, "Tab Stammdaten: Typ = Subunternehmen, Feld Subunternehmen wählen.")
    step(3, "Speichern.")
    bullet("Bei Typ Angestellt entfällt die Sub-Zuordnung.")
    img(
        "06-monteur-sub-zuordnung.jpg",
        "Abb. 7 – Typ „Subunternehmen“ und Zuordnung (Beispiel)",
    )

    pdf.add_page()
    h1("7. Monteur einem Projekt zuweisen")
    body("Empfohlen vom Projekt aus:")
    step(1, "Projekte → Projekt öffnen → Tab Monteure.")
    step(2, "Monteur zuordnen: Von/Bis, Monteur, optional Funktion/Teamleitung.")
    step(3, "Speichern (Zuweisung aktiv).")
    body("Alternativ: Monteur → Tab Projekte & Teams.")
    body(
        "Wichtig für den Kiosk: Zuweisung aktiv und heutiges Datum im Von–Bis-Fenster "
        "(oder ohne Ende). Sonst: keine gültige Zuweisung (außer Master-Monteur)."
    )
    img("07-projekt-monteur-zuordnen.jpg", "Abb. 8 – Dialog „Monteur zuordnen“")

    pdf.add_page()
    h1("8. Kurz: Stempel & Stundenzettel")
    bullet("Kiosk einrichten: work.vivahome.de → Setup (Admin-PIN) → Projekt wählen")
    bullet("Einstempeln: Kiosk oder Monteur-App mit PIN")
    bullet("Stundenzettel: Büro → Stundenzettel → Anlegen/öffnen (Monteur, Projekt, KW)")
    bullet("Manuell: Tag erfassen / Tageszeile bearbeiten")
    bullet("Neu aus Stempelungen: Im Entwurf „Aus Stempelungen neu laden“")
    pdf.ln(2)
    h2("Empfohlene Reihenfolge")
    for i, text in enumerate(
        [
            "Kunde anlegen (falls neu)",
            "Projekt anlegen und Kunde verknüpfen",
            "Subunternehmen anlegen (falls Fremdmonteure)",
            "Monteure anlegen / Subs zuordnen",
            "Monteure dem Projekt zuweisen (Datum!)",
            "PIN setzen + ggf. Kiosk-Freigabe",
            "Kiosk auf Baustelle auf das Projekt einrichten",
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
        "Viva Home GmbH | Am Ringwall 16 | 51491 Overath | Office Version 1.0.0",
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {pdf.page_no()} pages)")


if __name__ == "__main__":
    build()
