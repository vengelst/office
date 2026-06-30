import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { TimesheetPdfService } from './pdf.service';

@Module({
  imports: [DocumentsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService, TimesheetPdfService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
