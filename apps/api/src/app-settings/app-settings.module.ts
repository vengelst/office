import { Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { CompanyController } from './company.controller';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DocumentsModule],
  controllers: [CompanyController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
