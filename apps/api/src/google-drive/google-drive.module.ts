import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { GoogleDriveService } from './google-drive.service';
import { GoogleContactsService } from './google-contacts.service';
import { GoogleCalendarService } from './google-calendar.service';
import { StorageSettingsController } from './storage-settings.controller';
import { ContactsSettingsController } from './contacts-settings.controller';
import { CalendarSettingsController } from './calendar-settings.controller';

@Module({
  imports: [AppSettingsModule],
  controllers: [
    StorageSettingsController,
    ContactsSettingsController,
    CalendarSettingsController,
  ],
  providers: [GoogleDriveService, GoogleContactsService, GoogleCalendarService],
  exports: [GoogleDriveService, GoogleContactsService, GoogleCalendarService],
})
export class GoogleDriveModule {}
