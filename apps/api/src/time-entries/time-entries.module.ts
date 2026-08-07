import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { WorkItemsModule } from '../work-items/work-items.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  // WorkItemsModule: Ausstempeln schließt offene Item-Sessions des Monteurs.
  imports: [DocumentsModule, GoogleDriveModule, WorkItemsModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
