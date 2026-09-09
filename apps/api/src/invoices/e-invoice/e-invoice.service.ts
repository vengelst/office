/**
 * Orchestriert XRechnung- und ZUGFeRD-Erzeugung aus Rechnungsdaten.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { loadCompanyInfoFromDb } from '../company.config';
import { InvoicePdfService } from '../invoice-pdf.service';
import { mapInvoiceToEn16931 } from './en16931.mapper';
import {
  generateCiiXml,
  generateXRechnungUbl,
} from './xrechnung.generator';
import { embedZugferdXml } from './zugferd.embedder';

@Injectable()
export class EInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: InvoicePdfService,
  ) {}

  private async loadForEInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { position: 'asc' } },
        customer: { include: { emails: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Rechnung nicht gefunden');
    return invoice;
  }

  async buildCanonical(id: string) {
    const invoice = await this.loadForEInvoice(id);
    const company = await loadCompanyInfoFromDb(this.prisma);
    const canonical = mapInvoiceToEn16931(
      {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        taxRate: Number(invoice.taxRate),
        lines: invoice.lines.map((l) => ({
          ...l,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          total: Number(l.total),
          taxRate: l.taxRate != null ? Number(l.taxRate) : null,
        })),
      },
      company,
    );
    canonical.seller.street = company.address;
    return { invoice, company, canonical };
  }

  async generateXRechnung(
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { canonical } = await this.buildCanonical(id);
    const xml = generateXRechnungUbl(canonical);
    const filename = `${canonical.invoiceNumber.replace(/[^\w.-]+/g, '_')}_xrechnung.xml`;
    return { buffer: Buffer.from(xml, 'utf8'), filename };
  }

  async generateZugferd(
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { canonical } = await this.buildCanonical(id);
    const { buffer: pdfBuffer } = await this.pdf.generate(id);
    const cii = generateCiiXml(canonical);
    const zugferd = await embedZugferdXml(pdfBuffer, cii);
    const filename = `${canonical.invoiceNumber.replace(/[^\w.-]+/g, '_')}_zugferd.pdf`;
    return { buffer: zugferd, filename };
  }

  async validateForSend(id: string): Promise<void> {
    await this.buildCanonical(id);
  }
}
