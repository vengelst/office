import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { GoogleDriveService } from './google-drive.service';
import { GoogleContactsService } from './google-contacts.service';
import { StorageSettingsController } from './storage-settings.controller';
import { ContactsSettingsController } from './contacts-settings.controller';

@Module({
  imports: [AppSettingsModule],
  controllers: [StorageSettingsController, ContactsSettingsController],
  providers: [GoogleDriveService, GoogleContactsService],
  exports: [GoogleDriveService, GoogleContactsService],
})
export class GoogleDriveModule {}
