import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  imports: [DocumentsModule, GoogleDriveModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
