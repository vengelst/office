/**
 * Service für Invoice Pdf.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceTaxKind, InvoiceType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { CompanyInfo, loadCompanyInfoFromDb, resolveCompanyVatId } from './company.config';
import { BillingSettingsService } from '../app-settings/billing-settings.service';
import {
  applySkontoTemplate,
  DEFAULT_REVERSE_CHARGE_PDF_TEXT,
} from '../app-settings/billing-settings.types';
import {
  documentTitleForType,
  round2,
  type TaxBreakdownLine,
} from './invoice-shared';

const COMPANY_LOGO_SETTING = 'company_logo_key';

/**
 * Service zur PDF-Generierung von Rechnungen.
 * Erstellt A4-PDFs im Standard-Layout mit Kopf-/Fußzeile,
 * Empfängeradresse, Positionstabelle und Zahlungshinweisen.
 */
@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly billingSettings: BillingSettingsService,
  ) {}

  /**
   * Erzeugt die Rechnung als PDF-Buffer (Standard-Layout).
   */
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
            vatId: true,
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
        creditedInvoice: {
          select: { invoiceNumber: true, issueDate: true },
        },
        lines: { orderBy: { position: 'asc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }

    const companyBase = await loadCompanyInfoFromDb(this.prisma);
    const companyVatId = resolveCompanyVatId(
      companyBase,
      invoice.performanceCountryCode,
    );
    const company: CompanyInfo = { ...companyBase, vatId: companyVatId };
    const logo = await this.loadCompanyLogo();
    const billing = await this.billingSettings.getSettingsOnly();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.drawHeader(doc, company, invoice, logo);
    this.drawRecipient(doc, invoice);
    this.drawMeta(doc, invoice);
    this.drawLineTable(doc, invoice.lines);
    this.drawTotals(doc, invoice);
    this.drawPaymentNote(doc, company, invoice, billing.skonto, {
      reverseChargePdfText:
        billing.reverseChargePdfText || DEFAULT_REVERSE_CHARGE_PDF_TEXT,
      customerVatId: invoice.customer?.vatId ?? null,
    });
    this.drawFooter(doc, company);

    doc.end();
    const buffer = await done;
    const filename = `${invoice.invoiceNumber ?? `Entwurf-${invoice.id.slice(-6)}`}.pdf`;
    return { buffer, filename };
  }

  /**
   * Lädt das Firmenlogo aus dem Storage (falls hinterlegt).
   *
   * @returns Buffer | null
   */
  private async loadCompanyLogo(): Promise<Buffer | null> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_SETTING },
    });
    if (!setting?.value) return null;
    try {
      const stream = await this.storage.getStream(setting.value);
      return await streamToBuffer(stream);
    } catch {
      return null;
    }
  }

  // ── Layout-Bausteine ─────────────────────────────────────────

  /**
   * Zeichnet den Rechnungskopf mit Firmenlogo, Titel und Metadaten.
   *
   * @returns void
   */
  private drawHeader(
    doc: PDFKit.PDFDocument,
    company: CompanyInfo,
    invoice: {
      invoiceType: InvoiceType;
      invoiceNumber: string | null;
      issueDate: Date;
      performanceCountryCode?: string | null;
      creditedInvoice: {
        invoiceNumber: string | null;
        issueDate: Date;
      } | null;
    },
    logo: Buffer | null,
  ): void {
    const title = documentTitleForType(invoice.invoiceType);

    // Firmenzeile oben rechts
    doc.fontSize(9).fillColor('#444');
    doc.text(company.name, 300, 50, { width: 245, align: 'right' });
    doc.text(company.address, { width: 245, align: 'right' });
    doc.text(`Tel: ${company.phone}`, { width: 245, align: 'right' });
    doc.text(company.email, { width: 245, align: 'right' });
    if (company.taxNumber) {
      doc.text(`Steuernr.: ${company.taxNumber}`, { width: 245, align: 'right' });
    }
    if (company.vatId) {
      const country = (invoice.performanceCountryCode || 'DE').toUpperCase();
      const vatLabel =
        country && country !== 'DE'
          ? `USt-IdNr. (${country}): ${company.vatId}`
          : `USt-IdNr.: ${company.vatId}`;
      doc.text(vatLabel, { width: 245, align: 'right' });
    }

    let titleY = 50;
    if (logo) {
      try {
        doc.image(logo, 50, 40, { fit: [120, 48] });
        titleY = 100;
      } catch {
        /* ungültiges Logo ignorieren */
      }
    }

    doc.fillColor('#000').fontSize(20);
    doc.text(title, 50, titleY);
    doc.fontSize(10).fillColor('#444');
    const numberLabel = invoice.invoiceNumber ?? 'Entwurf (ohne Nummer)';
    const numberPrefix =
      invoice.invoiceType === InvoiceType.STORNO
        ? 'Storno-Nr.'
        : invoice.invoiceType === InvoiceType.CORRECTION
          ? 'Korrektur-Nr.'
          : 'Rechnungs-Nr.';
    doc.text(`${numberPrefix}: ${numberLabel}`, 50, titleY + 30);
    doc.text(`Datum: ${formatDate(invoice.issueDate)}`, 50, titleY + 45);
    if (
      (invoice.invoiceType === InvoiceType.STORNO ||
        invoice.invoiceType === InvoiceType.CORRECTION) &&
      invoice.creditedInvoice?.invoiceNumber
    ) {
      const refDate = formatDate(invoice.creditedInvoice.issueDate);
      const refText =
        invoice.invoiceType === InvoiceType.STORNO
          ? `Storno zu Rechnung ${invoice.creditedInvoice.invoiceNumber} vom ${refDate}`
          : `Korrektur zu Rechnung ${invoice.creditedInvoice.invoiceNumber} vom ${refDate}`;
      doc.text(refText, 50, titleY + 60);
    }
    doc.fillColor('#000');
  }

  /**
   * Zeichnet den Empfänger-Adressblock (Kunde bei Ausgang, Sub bei Eingang).
   *
   * @returns void
   */
  private drawRecipient(
    doc: PDFKit.PDFDocument,
    invoice: {
      invoiceType: InvoiceType;
      taxKind?: InvoiceTaxKind;
      customer: {
        companyName: string;
        addressLine1: string | null;
        addressLine2: string | null;
        postalCode: string | null;
        city: string | null;
        country: string | null;
        vatId?: string | null;
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
      invoice.invoiceType === InvoiceType.INCOMING
        ? invoice.subcontractor
        : invoice.customer
          ? {
              name: invoice.customer.companyName,
              ...invoice.customer,
            }
          : null;

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

    const vatId =
      invoice.invoiceType !== InvoiceType.INCOMING
        ? invoice.customer?.vatId
        : null;
    if (vatId?.trim()) {
      doc.fontSize(10).text(`USt-IdNr.: ${vatId.trim()}`, 50, ly);
    }
  }

  /**
   * Zeichnet Projekt-Referenz, Leistungszeitraum und Abschlagsinformationen.
   *
   * @returns void
   */
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

  /**
   * Zeichnet die Positionstabelle mit automatischem Seitenumbruch.
   *
   * @returns void
   */
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

  /**
   * Zeichnet die Summenzeilen (Netto, MwSt, Brutto).
   *
   * @returns void
   */
  private drawTotals(
    doc: PDFKit.PDFDocument,
    invoice: {
      subtotal: number;
      taxRate: number;
      taxAmount: number;
      total: number;
      taxKind?: InvoiceTaxKind;
      taxBreakdown?: unknown;
    },
  ): void {
    const labelX = 350;
    const valueX = 440;
    const valueWidth = 105;
    let y = doc.y + 4;
    const isRc =
      invoice.taxKind === InvoiceTaxKind.REVERSE_CHARGE ||
      invoice.taxKind === InvoiceTaxKind.TAX_EXEMPT;

    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      doc.text(label, labelX, y, { width: 85, align: 'right' });
      doc.text(value, valueX, y, { width: valueWidth, align: 'right' });
      y += 16;
    };

    row('Netto', formatCurrency(invoice.subtotal));
    if (isRc) {
      row('MwSt (0 % / Reverse Charge)', formatCurrency(0));
    } else {
      const breakdown = parseTaxBreakdown(invoice.taxBreakdown);
      if (breakdown && breakdown.length > 1) {
        for (const b of breakdown) {
          row(
            `zzgl. MwSt ${formatNumber(b.rate)} %`,
            formatCurrency(b.tax),
          );
        }
      } else if (breakdown && breakdown.length === 1) {
        row(
          `zzgl. MwSt ${formatNumber(breakdown[0].rate)} %`,
          formatCurrency(breakdown[0].tax),
        );
      } else {
        row(
          `zzgl. MwSt ${formatNumber(invoice.taxRate)} %`,
          formatCurrency(invoice.taxAmount),
        );
      }
    }
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

  /**
   * Zeichnet Zahlungshinweis, Bankverbindung und optionale Notizen.
   *
   * @returns void
   */
  private drawPaymentNote(
    doc: PDFKit.PDFDocument,
    company: CompanyInfo,
    invoice: {
      invoiceType: InvoiceType;
      invoiceNumber: string | null;
      paymentTermDays: number | null;
      dueDate: Date | null;
      notes: string | null;
      total: number;
      taxRate: number;
      taxKind?: InvoiceTaxKind;
    },
    skonto: {
      percent: number | null;
      days: number | null;
      pdfHintTemplate: string | null;
    },
    extras?: {
      reverseChargePdfText: string;
      customerVatId: string | null;
    },
  ): void {
    let y = doc.y + 6;
    doc.fontSize(10).fillColor('#000');

    const isOutgoingLike =
      invoice.invoiceType === InvoiceType.OUTGOING ||
      invoice.invoiceType === InvoiceType.STORNO ||
      invoice.invoiceType === InvoiceType.CORRECTION;

    if (
      invoice.taxKind === InvoiceTaxKind.REVERSE_CHARGE &&
      extras?.reverseChargePdfText
    ) {
      doc.fontSize(9).fillColor('#333');
      doc.text(extras.reverseChargePdfText, 50, y, { width: 495 });
      y = doc.y + 6;
      if (extras.customerVatId?.trim()) {
        doc.text(
          `USt-IdNr. des Leistungsempfängers: ${extras.customerVatId.trim()}`,
          50,
          y,
          { width: 495 },
        );
        y = doc.y + 8;
      }
      doc.fontSize(10).fillColor('#000');
    }

    if (isOutgoingLike && invoice.invoiceType === InvoiceType.OUTGOING) {
      const term = invoice.paymentTermDays;
      const due = invoice.dueDate ? ` bis zum ${formatDate(invoice.dueDate)}` : '';
      const termText =
        term != null
          ? `Zahlbar innerhalb von ${term} Tagen${due} ohne Abzug.`
          : `Zahlbar${due} ohne Abzug.`;
      doc.text(termText, 50, y);
      y += 16;

      // Skonto-Hinweis aus Vorlage (nicht bei RC)
      if (
        invoice.taxKind !== InvoiceTaxKind.REVERSE_CHARGE &&
        skonto.pdfHintTemplate?.trim() &&
        skonto.percent != null &&
        skonto.percent > 0
      ) {
        const skontoAmount = formatCurrency(
          round2((invoice.total * skonto.percent) / 100),
        );
        const hint = applySkontoTemplate(skonto.pdfHintTemplate, {
          skontoPercent: String(skonto.percent),
          skontoDays: String(skonto.days ?? ''),
          skontoAmount,
          dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : '',
          invoiceNumber: invoice.invoiceNumber ?? '',
          companyName: company.name,
        });
        doc.fontSize(9).fillColor('#333').text(hint, 50, y, { width: 495 });
        y = doc.y + 8;
        doc.fontSize(10).fillColor('#000');
      }

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

  private drawFooter(doc: PDFKit.PDFDocument, company: CompanyInfo): void {
    const y = 790;
    doc.fontSize(8).fillColor('#888');
    const taxParts = [
      company.taxNumber ? `Steuernr. ${company.taxNumber}` : null,
      company.vatId ? `USt-IdNr. ${company.vatId}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    doc.text(
      `${company.name} · ${company.address}${taxParts ? ` · ${taxParts}` : ''}`,
      50,
      y,
      { width: 495, align: 'center' },
    );
    doc.fillColor('#000');
  }

  /**
   * Zeichnet eine einzelne Tabellenzeile mit konfigurierbaren Spaltenbreiten.
   */
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

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

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

function parseTaxBreakdown(raw: unknown): TaxBreakdownLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines: TaxBreakdownLine[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as TaxBreakdownLine).rate === 'number' &&
      typeof (item as TaxBreakdownLine).net === 'number' &&
      typeof (item as TaxBreakdownLine).tax === 'number' &&
      typeof (item as TaxBreakdownLine).gross === 'number'
    ) {
      lines.push(item as TaxBreakdownLine);
    }
  }
  return lines.length ? lines : null;
}
