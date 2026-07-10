import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { DocumentsModule } from '../documents/documents.module';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';

@Module({
  imports: [AppSettingsModule, DocumentsModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
