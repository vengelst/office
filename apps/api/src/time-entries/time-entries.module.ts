import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { GeocodeModule } from '../geocode/geocode.module';
import { WorkItemsModule } from '../work-items/work-items.module';
import { EmailModule } from '../email/email.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { OvertimeAlertController } from './overtime-alert.controller';
import { OvertimeAlertService } from './overtime-alert.service';
import { AutoClockOutController } from './auto-clock-out.controller';
import { AutoClockOutService } from './auto-clock-out.service';
import { NoShowAlertController } from './no-show-alert.controller';
import { NoShowAlertService } from './no-show-alert.service';

@Module({
  // WorkItemsModule: Ausstempeln schließt offene Item-Sessions.
  // EmailModule + AppSettings: Cron-Alarm, Auto-Clock-Out, No-Show.
  // TimesheetsModule: Auto-Anlage/Sync Wochenstundenzettel bei Stempelung.
  // GeocodeModule: Reverse-Geocoding für Foto-Stempel-Ort.
  imports: [
    DocumentsModule,
    GoogleDriveModule,
    GeocodeModule,
    WorkItemsModule,
    EmailModule,
    AppSettingsModule,
    TimesheetsModule,
  ],
  controllers: [
    TimeEntriesController,
    OvertimeAlertController,
    AutoClockOutController,
    NoShowAlertController,
  ],
  providers: [
    TimeEntriesService,
    OvertimeAlertService,
    AutoClockOutService,
    NoShowAlertService,
  ],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
