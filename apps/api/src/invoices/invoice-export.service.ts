/**
 * PDF-Export von Rechnungen nach MinIO inkl. Document-Verknüpfungen.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DocumentType, InvoiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { StoragePathService } from '../common/storage-path.service';
import { InvoicePdfService } from './invoice-pdf.service';

export type InvoiceExportPayload = {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  projectId: string | null;
  customerId: string | null;
  subcontractorId: string | null;
  customer: { companyName: string } | null;
  subcontractor: { name: string } | null;
  createdBy: { id: string } | null;
};

/**
 * Speichert generierte Rechnungs-PDFs und verknüpft sie mit Projekt/Kunde/Sub.
 */
@Injectable()
export class InvoiceExportService {
  private readonly logger = new Logger(InvoiceExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly storagePathService: StoragePathService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  /**
   * Generiert PDF, speichert in MinIO und erstellt Document-Einträge.
   * Ausgangsrechnung → Projekt-Ordner + Kunden-Ordner.
   * Eingangsrechnung → Subunternehmen-Ordner.
   */
  async exportInvoicePdf(invoice: InvoiceExportPayload): Promise<void> {
    const { buffer, filename: pdfFilename } = await this.pdfService.generate(
      invoice.id,
    );
    void pdfFilename;

    if (invoice.invoiceType === InvoiceType.OUTGOING) {
      const partnerName = invoice.customer?.companyName ?? 'Unbekannt';
      const readableFilename = this.storagePathService.buildInvoiceFilename(
        invoice.invoiceNumber,
        partnerName,
      );

      if (invoice.projectId) {
        const projectPath = await this.storagePathService.generatePath(
          'PROJECT',
          invoice.projectId,
          'INVOICE',
          readableFilename,
        );
        const additionalLinks: Array<{ entityType: string; entityId: string }> =
          [];
        if (invoice.customerId) {
          additionalLinks.push({
            entityType: 'CUSTOMER',
            entityId: invoice.customerId,
          });
        }

        await this.documentsService.createFromBuffer({
          buffer,
          filename: readableFilename,
          mimeType: 'application/pdf',
          documentType: DocumentType.INVOICE,
          entityType: 'PROJECT',
          entityId: invoice.projectId,
          storagePath: projectPath,
          title: `${invoice.invoiceNumber} ${partnerName}`,
          userId: invoice.createdBy?.id ?? null,
          additionalLinks,
        });
      }

      if (invoice.customerId) {
        const customerPath = await this.storagePathService.generatePath(
          'CUSTOMER',
          invoice.customerId,
          'INVOICE',
          readableFilename,
        );
        await this.documentsService.createFromBuffer({
          buffer,
          filename: readableFilename,
          mimeType: 'application/pdf',
          documentType: DocumentType.INVOICE,
          entityType: 'CUSTOMER',
          entityId: invoice.customerId,
          storagePath: customerPath,
          title: `${invoice.invoiceNumber} ${partnerName}`,
          userId: invoice.createdBy?.id ?? null,
        });
      }
    } else if (invoice.subcontractorId) {
      const subName = invoice.subcontractor?.name ?? 'Unbekannt';
      const readableFilename = this.storagePathService.buildInvoiceFilename(
        invoice.invoiceNumber,
        subName,
      );
      const subPath = await this.storagePathService.generatePath(
        'SUBCONTRACTOR',
        invoice.subcontractorId,
        'INVOICE',
        readableFilename,
      );
      await this.documentsService.createFromBuffer({
        buffer,
        filename: readableFilename,
        mimeType: 'application/pdf',
        documentType: DocumentType.INVOICE,
        entityType: 'SUBCONTRACTOR',
        entityId: invoice.subcontractorId,
        storagePath: subPath,
        title: `${invoice.invoiceNumber} ${subName}`,
        userId: invoice.createdBy?.id ?? null,
      });
    }

    const pdfStorageKey = `invoices/${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfPath: pdfStorageKey },
    });
  }

  /** Fire-and-forget Wrapper mit Logging. */
  exportInvoicePdfAsync(invoice: InvoiceExportPayload): void {
    this.exportInvoicePdf(invoice).catch((err) =>
      this.logger.warn(
        `Rechnungs-PDF-Export fehlgeschlagen: ${(err as Error).message}`,
      ),
    );
  }
}
