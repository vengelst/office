import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { EmailModule } from '../email/email.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceExportService } from './invoice-export.service';
import { InvoiceGenerationService } from './invoice-generation.service';

@Module({
  imports: [DocumentsModule, AppSettingsModule, EmailModule, TimesheetsModule],
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
