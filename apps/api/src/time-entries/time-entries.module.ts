import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { WorkItemsModule } from '../work-items/work-items.module';
import { EmailModule } from '../email/email.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { OvertimeAlertController } from './overtime-alert.controller';
import { OvertimeAlertService } from './overtime-alert.service';

@Module({
  // WorkItemsModule: Ausstempeln schließt offene Item-Sessions.
  // EmailModule + AppSettings: Cron-Alarm bei durchgehend überschrittener Stempelzeit.
  // TimesheetsModule: Auto-Anlage/Sync Wochenstundenzettel bei Stempelung.
  imports: [
    DocumentsModule,
    GoogleDriveModule,
    WorkItemsModule,
    EmailModule,
    AppSettingsModule,
    TimesheetsModule,
  ],
  controllers: [TimeEntriesController, OvertimeAlertController],
  providers: [TimeEntriesService, OvertimeAlertService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
