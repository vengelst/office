import { Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { CompanyController } from './company.controller';
import { StorageService } from '../documents/storage.service';

@Module({
  controllers: [CompanyController],
  providers: [AppSettingsService, StorageService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
