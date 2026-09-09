/**
 * E-Rechnung Service: XRechnung (UBL) und ZUGFeRD (PDF + CII).
 *
 * ZUGFeRD-Hinweis: Das PDF wird mit pdf-lib um ein eingebettetes CII-XML
 * und AF-Relationship ergänzt. Vollständige PDF/A-3-Konformität (XMP,
 * OutputIntent) ist Best-Effort und nicht zertifiziert.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PDFDocument, AFRelationship } from 'pdf-lib';
import { PrismaService } from '../../prisma/prisma.service';
import {
  loadCompanyInfoFromDb,
  type CompanyInfo,
} from '../company.config';
import { InvoicePdfService } from '../invoice-pdf.service';
import { mapInvoiceToEn16931 } from './en16931.mapper';
import { generateXRechnungXml } from './xrechnung.generator';
import { generateCiiXml } from './zugferd.generator';

@Injectable()
export class EInvoiceService {
  private readonly logger = new Logger(EInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  async generateXRechnung(
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string; warnings: string[] }> {
    const { model, warnings } = await this.buildModel(invoiceId);
    const xml = generateXRechnungXml(model);
    const filename = `${model.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_xrechnung.xml`;
    return { buffer: Buffer.from(xml, 'utf8'), filename, warnings };
  }

  async generateZugferd(
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string; warnings: string[] }> {
    const { model, warnings } = await this.buildModel(invoiceId);
    const cii = generateCiiXml(model);
    const { buffer: pdfBuffer } = await this.pdfService.generate(invoiceId);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    await pdfDoc.attach(Buffer.from(cii, 'utf8'), 'factur-x.xml', {
      mimeType: 'text/xml',
      description: 'Factur-X/ZUGFeRD Rechnung',
      creationDate: new Date(),
      modificationDate: new Date(),
      afRelationship: AFRelationship.Alternative,
    });

    // Best-Effort Metadaten
    pdfDoc.setTitle(`ZUGFeRD ${model.invoiceNumber}`);
    pdfDoc.setSubject('ZUGFeRD 2.2 Comfort / Factur-X EN16931');
    pdfDoc.setProducer('Office E-Invoice');
    pdfDoc.setCreator('Office');

    const out = await pdfDoc.save();
    const filename = `${model.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_zugferd.pdf`;
    this.logger.debug(
      `ZUGFeRD erzeugt für ${model.invoiceNumber} (kein zertifiziertes PDF/A-3)`,
    );
    return { buffer: Buffer.from(out), filename, warnings };
  }

  /**
   * Validiert Pflichtfelder vor E-Rechnungs-Erzeugung / Versand.
   */
  async assertSendable(invoiceId: string): Promise<void> {
    await this.buildModel(invoiceId);
  }

  private async buildModel(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { position: 'asc' } },
        creditedInvoice: { select: { invoiceNumber: true } },
        customer: {
          include: {
            emails: true,
            contacts: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    if (!invoice.invoiceNumber || !invoice.finalizedAt) {
      throw new BadRequestException(
        'E-Rechnung nur für finalisierte Rechnungen verfügbar',
      );
    }
    if (!invoice.customer) {
      throw new BadRequestException('Rechnung hat keinen Kunden');
    }

    const companyRaw = await this.loadCompanyExtended();
    const warnings: string[] = [];

    if (!companyRaw.vatId?.trim()) {
      throw new BadRequestException(
        'Firmen-USt-IdNr. fehlt – bitte unter Einstellungen → Firmeninformationen hinterlegen.',
      );
    }
    if (!invoice.customer.addressLine1?.trim() || !invoice.customer.city?.trim()) {
      throw new BadRequestException(
        'Kundenadresse unvollständig (Straße und Ort erforderlich für E-Rechnung).',
      );
    }
    if (!invoice.customer.leitwegId?.trim()) {
      warnings.push(
        'Keine Leitweg-ID hinterlegt – für öffentliche Auftraggeber oft erforderlich.',
      );
    }

    const model = mapInvoiceToEn16931(invoice, companyRaw);
    return { model, warnings };
  }

  private async loadCompanyExtended(): Promise<
    CompanyInfo & {
      country?: string;
      addressLine1?: string;
      postalCode?: string;
      city?: string;
      electronicAddress?: string;
    }
  > {
    const base = await loadCompanyInfoFromDb(this.prisma);
    try {
      const setting = await this.prisma.appSetting.findUnique({
        where: { key: 'company_info' },
      });
      if (setting) {
        const db = JSON.parse(setting.value) as Record<string, string>;
        return {
          ...base,
          country: db.country || 'DE',
          addressLine1: db.addressLine1,
          postalCode: db.postalCode,
          city: db.city,
          electronicAddress: db.electronicAddress || db.email,
        };
      }
    } catch {
      // ignore
    }
    return { ...base, country: 'DE', electronicAddress: base.email };
  }
}
