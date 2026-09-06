import { Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { CompanyController } from './company.controller';
import { KioskSettingsController } from './kiosk-settings.controller';
import { BillingSettingsController } from './billing-settings.controller';
import { BillingSettingsService } from './billing-settings.service';
import { PinLengthService } from './pin-length.service';
import { StorageService } from '../documents/storage.service';

@Module({
  controllers: [
    CompanyController,
    KioskSettingsController,
    BillingSettingsController,
  ],
  providers: [
    AppSettingsService,
    StorageService,
    PinLengthService,
    BillingSettingsService,
  ],
  exports: [AppSettingsService, PinLengthService, BillingSettingsService],
})
export class AppSettingsModule {}
