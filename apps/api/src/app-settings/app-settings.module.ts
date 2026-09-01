import { Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { CompanyController } from './company.controller';
import { KioskSettingsController } from './kiosk-settings.controller';
import { PinLengthService } from './pin-length.service';
import { StorageService } from '../documents/storage.service';

@Module({
  controllers: [CompanyController, KioskSettingsController],
  providers: [AppSettingsService, StorageService, PinLengthService],
  exports: [AppSettingsService, PinLengthService],
})
export class AppSettingsModule {}
