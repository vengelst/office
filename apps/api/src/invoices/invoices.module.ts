import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceExportService } from './invoice-export.service';
import { InvoiceGenerationService } from './invoice-generation.service';

@Module({
  imports: [DocumentsModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicePdfService,
    InvoiceExportService,
    InvoiceGenerationService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
