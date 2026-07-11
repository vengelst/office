import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyInfo, loadCompanyInfo } from './company.config';

/**
 * Service zur PDF-Generierung von Rechnungen.
 * Erstellt A4-PDFs im Standard-Layout mit Kopf-/Fußzeile,
 * Empfängeradresse, Positionstabelle und Zahlungshinweisen.
 */
@Injectable()
export class InvoicePdfService {
  constructor(private readonly prisma: PrismaService) {}

  /** Erzeugt die Rechnung als PDF-Buffer (Standard-Layout). */
  async generate(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        project: { select: { projectNumber: true, title: true } },
        customer: {
          select: {
            companyName: true,
            addressLine1: true,
            addressLine2: true,
            postalCode: true,
            city: true,
            country: true,
          },
        },
        subcontractor: {
          select: {
            name: true,
            addressLine1: true,
            addressLine2: true,
            postalCode: true,
            city: true,
            country: true,
          },
        },
        lines: { orderBy: { position: 'asc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }

    const company = loadCompanyInfo();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.drawHeader(doc, company, invoice);
    this.drawRecipient(doc, invoice);
    this.drawMeta(doc, invoice);
    this.drawLineTable(doc, invoice.lines);
    this.drawTotals(doc, invoice);
    this.drawPaymentNote(doc, company, invoice);
    this.drawFooter(doc, company);

    doc.end();
    const buffer = await done;
    const filename = `${invoice.invoiceNumber}.pdf`;
    return { buffer, filename };
  }

  // ── Layout-Bausteine ─────────────────────────────────────────

  /** Zeichnet den Rechnungskopf mit Firmenlogo, Titel und Metadaten. */
  private drawHeader(
    doc: PDFKit.PDFDocument,
    company: CompanyInfo,
    invoice: { invoiceType: InvoiceType; invoiceNumber: string; issueDate: Date },
  ): void {
    const title =
      invoice.invoiceType === InvoiceType.OUTGOING
        ? 'Rechnung'
        : 'Eingangsrechnung';

    // Firmenzeile oben rechts
    doc.fontSize(9).fillColor('#444');
    doc.text(company.name, 300, 50, { width: 245, align: 'right' });
    doc.text(company.address, { width: 245, align: 'right' });
    doc.text(`Tel: ${company.phone}`, { width: 245, align: 'right' });
    doc.text(company.email, { width: 245, align: 'right' });

    doc.fillColor('#000').fontSize(20);
    doc.text(title, 50, 50);
    doc.fontSize(10).fillColor('#444');
    doc.text(`Rechnungs-Nr.: ${invoice.invoiceNumber}`, 50, 80);
    doc.text(`Datum: ${formatDate(invoice.issueDate)}`, 50, 95);
    doc.fillColor('#000');
  }

  /** Zeichnet den Empfänger-Adressblock (Kunde bei Ausgang, Sub bei Eingang). */
  private drawRecipient(
    doc: PDFKit.PDFDocument,
    invoice: {
      invoiceType: InvoiceType;
      customer: {
        companyName: string;
        addressLine1: string | null;
        addressLine2: string | null;
        postalCode: string | null;
        city: string | null;
        country: string | null;
      } | null;
      subcontractor: {
        name: string;
        addressLine1: string | null;
        addressLine2: string | null;
        postalCode: string | null;
        city: string | null;
        country: string | null;
      } | null;
    },
  ): void {
    const y = 150;
    doc.fontSize(9).fillColor('#888').text('Rechnungsempfänger', 50, y);
    doc.fontSize(11).fillColor('#000');

    const recipient =
      invoice.invoiceType === InvoiceType.OUTGOING
        ? invoice.customer
          ? {
              name: invoice.customer.companyName,
              ...invoice.customer,
            }
          : null
        : invoice.subcontractor;

    if (!recipient) {
      doc.text('—', 50, y + 14);
      return;
    }

    const lines = [
      recipient.name,
      recipient.addressLine1,
      recipient.addressLine2,
      [recipient.postalCode, recipient.city].filter(Boolean).join(' '),
      recipient.country,
    ].filter((l): l is string => Boolean(l && l.trim()));

    let ly = y + 14;
    for (const line of lines) {
      doc.text(line, 50, ly);
      ly += 14;
    }
  }

  /** Zeichnet Projekt-Referenz, Leistungszeitraum und Abschlagsinformationen. */
  private drawMeta(
    doc: PDFKit.PDFDocument,
    invoice: {
      project: { projectNumber: string; title: string } | null;
      periodFrom: Date | null;
      periodTo: Date | null;
      isPartialInvoice: boolean;
      partialNumber: number | null;
      partialPercentage: number | null;
    },
  ): void {
    let y = 235;
    doc.fontSize(10).fillColor('#000');
    if (invoice.project) {
      doc.text(
        `Projekt: ${invoice.project.title} (${invoice.project.projectNumber})`,
        50,
        y,
      );
      y += 14;
    }
    if (invoice.periodFrom && invoice.periodTo) {
      doc.text(
        `Leistungszeitraum: ${formatDate(invoice.periodFrom)} – ${formatDate(invoice.periodTo)}`,
        50,
        y,
      );
      y += 14;
    }
    if (invoice.isPartialInvoice) {
      const pct =
        invoice.partialPercentage != null
          ? ` (${invoice.partialPercentage} % des Gesamtauftrags)`
          : '';
      doc.text(
        `Abschlagsrechnung Nr. ${invoice.partialNumber ?? ''}${pct}`,
        50,
        y,
      );
      y += 14;
    }
    doc.y = y + 6;
  }

  /** Zeichnet die Positionstabelle mit automatischem Seitenumbruch. */
  private drawLineTable(
    doc: PDFKit.PDFDocument,
    lines: Array<{
      position: number;
      description: string;
      quantity: number;
      unit: string | null;
      unitPrice: number;
      total: number;
    }>,
  ): void {
    const cols = [
      { label: 'Pos', width: 30, align: 'left' as const },
      { label: 'Beschreibung', width: 215, align: 'left' as const },
      { label: 'Menge', width: 50, align: 'right' as const },
      { label: 'Einheit', width: 55, align: 'left' as const },
      { label: 'Einzelpreis', width: 90, align: 'right' as const },
      { label: 'Gesamt', width: 105, align: 'right' as const },
    ];
    const startX = 50;
    let y = doc.y + 6;

    this.drawTableRow(
      doc,
      startX,
      y,
      cols,
      cols.map((c) => c.label),
      true,
    );
    y += 20;

    const ordered = [...lines].sort((a, b) => a.position - b.position);
    ordered.forEach((line, idx) => {
      // Seitenumbruch bei Bedarf
      if (y > 720) {
        doc.addPage();
        y = 50;
        this.drawTableRow(
          doc,
          startX,
          y,
          cols,
          cols.map((c) => c.label),
          true,
        );
        y += 20;
      }
      this.drawTableRow(
        doc,
        startX,
        y,
        cols,
        [
          `${idx + 1}`,
          line.description,
          formatNumber(line.quantity),
          line.unit ?? '',
          formatCurrency(line.unitPrice),
          formatCurrency(line.total),
        ],
        false,
      );
      y += 18;
    });

    doc.y = y + 6;
  }

  /** Zeichnet die Summenzeilen (Netto, MwSt, Brutto). */
  private drawTotals(
    doc: PDFKit.PDFDocument,
    invoice: { subtotal: number; taxRate: number; taxAmount: number; total: number },
  ): void {
    const labelX = 350;
    const valueX = 440;
    const valueWidth = 105;
    let y = doc.y + 4;

    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      doc.text(label, labelX, y, { width: 85, align: 'right' });
      doc.text(value, valueX, y, { width: valueWidth, align: 'right' });
      y += 16;
    };

    row('Netto', formatCurrency(invoice.subtotal));
    row(`zzgl. MwSt ${formatNumber(invoice.taxRate)} %`, formatCurrency(invoice.taxAmount));
    doc
      .moveTo(labelX, y)
      .lineTo(valueX + valueWidth, y)
      .strokeColor('#999')
      .stroke();
    y += 4;
    row('Brutto', formatCurrency(invoice.total), true);
    doc.font('Helvetica');
    doc.y = y + 10;
  }

  /** Zeichnet Zahlungshinweis, Bankverbindung und optionale Notizen. */
  private drawPaymentNote(
    doc: PDFKit.PDFDocument,
    company: CompanyInfo,
    invoice: {
      invoiceType: InvoiceType;
      paymentTermDays: number | null;
      dueDate: Date | null;
      notes: string | null;
    },
  ): void {
    let y = doc.y + 6;
    doc.fontSize(10).fillColor('#000');

    if (invoice.invoiceType === InvoiceType.OUTGOING) {
      const term = invoice.paymentTermDays;
      const due = invoice.dueDate ? ` bis zum ${formatDate(invoice.dueDate)}` : '';
      const termText =
        term != null
          ? `Zahlbar innerhalb von ${term} Tagen${due} ohne Abzug.`
          : `Zahlbar${due} ohne Abzug.`;
      doc.text(termText, 50, y);
      y += 16;
      doc.fontSize(9).fillColor('#444');
      doc.text(
        `Bankverbindung: ${company.bankName} · IBAN ${company.bankIban} · BIC ${company.bankBic}`,
        50,
        y,
      );
      y += 14;
      doc.fillColor('#000');
    }

    if (invoice.notes?.trim()) {
      y += 6;
      doc.fontSize(10).text(invoice.notes.trim(), 50, y, { width: 495 });
      y = doc.y;
    }
    doc.y = y + 10;
  }

  /** Zeichnet die Fußzeile mit Firmenname, Adresse und Steuernummer. */
  private drawFooter(doc: PDFKit.PDFDocument, company: CompanyInfo): void {
    const y = 790;
    doc.fontSize(8).fillColor('#888');
    doc.text(
      `${company.name} · ${company.address} · Steuernummer: ${company.taxNumber}`,
      50,
      y,
      { width: 495, align: 'center' },
    );
    doc.fillColor('#000');
  }

  /** Zeichnet eine einzelne Tabellenzeile mit konfigurierbaren Spaltenbreiten. */
  private drawTableRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    cols: Array<{ width: number; align: 'left' | 'right' }>,
    values: string[],
    bold: boolean,
  ): void {
    doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    let cx = x;
    for (let i = 0; i < cols.length; i++) {
      doc.text(values[i] ?? '', cx + 2, y + 4, {
        width: cols[i].width - 4,
        align: cols[i].align,
        ellipsis: true,
      });
      cx += cols[i].width;
    }
    const totalWidth = cols.reduce((s, c) => s + c.width, 0);
    doc
      .moveTo(x, y + 17)
      .lineTo(x + totalWidth, y + 17)
      .strokeColor('#ddd')
      .stroke();
    doc.font('Helvetica').fillColor('#000');
  }
}

// ── Formatierung ───────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
