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
import { AutoClockOutController } from './auto-clock-out.controller';
import { AutoClockOutService } from './auto-clock-out.service';

@Module({
  // WorkItemsModule: Ausstempeln schließt offene Item-Sessions.
  // EmailModule + AppSettings: Cron-Alarm und Auto-Clock-Out.
  // TimesheetsModule: Auto-Anlage/Sync Wochenstundenzettel bei Stempelung.
  imports: [
    DocumentsModule,
    GoogleDriveModule,
    WorkItemsModule,
    EmailModule,
    AppSettingsModule,
    TimesheetsModule,
  ],
  controllers: [
    TimeEntriesController,
    OvertimeAlertController,
    AutoClockOutController,
  ],
  providers: [TimeEntriesService, OvertimeAlertService, AutoClockOutService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
