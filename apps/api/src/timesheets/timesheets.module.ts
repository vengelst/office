import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { WorkItemsModule } from '../work-items/work-items.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { TimesheetPdfService } from './pdf.service';

/**
 * `WorkItemsModule` liefert `WorkItemsService` – dort liegen die
 * Kunden-PL-Projektzuordnungen, die den Stundenzettel-Zugriff eines
 * `CUSTOMER_PL` einschränken (SPEZ-arbeitsitems.md 4.2).
 * `EmailModule` für PDF-Zustellung an den genehmigenden Kunden-PL.
 */
@Module({
  imports: [DocumentsModule, WorkItemsModule, EmailModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService, TimesheetPdfService],
  exports: [TimesheetsService, TimesheetPdfService],
})
export class TimesheetsModule {}
