import { Module } from '@nestjs/common';
import { OcrModule } from '../ocr/ocr.module';
import { PdfPageRasterService } from './pdf-page-raster.service';
import { WorkCardCalibrateService } from './work-card-calibrate.service';
import { WorkCardTemplatesController } from './work-card-templates.controller';
import { WorkCardTemplatesService } from './work-card-templates.service';

/**
 * Kartentyp-Templates für PDF-OCR-Extraktion (SPEZ §10.2).
 * Exportiert PdfPageRasterService und WorkCardTemplatesService
 * für den PDF-Import in WorkItemsModule.
 */
@Module({
  imports: [OcrModule],
  controllers: [WorkCardTemplatesController],
  providers: [
    WorkCardTemplatesService,
    WorkCardCalibrateService,
    PdfPageRasterService,
  ],
  exports: [WorkCardTemplatesService, PdfPageRasterService],
})
export class WorkCardTemplatesModule {}
