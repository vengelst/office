import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { WorkItemsModule } from '../work-items/work-items.module';
import { EmailModule } from '../email/email.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { OvertimeAlertService } from './overtime-alert.service';

@Module({
  // WorkItemsModule: Ausstempeln schließt offene Item-Sessions.
  // EmailModule + AppSettings: Cron-Alarm bei >10h durchgehend eingestempelt.
  imports: [
    DocumentsModule,
    GoogleDriveModule,
    WorkItemsModule,
    EmailModule,
    AppSettingsModule,
  ],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, OvertimeAlertService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
