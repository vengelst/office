import { Module } from '@nestjs/common';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { StoragePathService } from '../common/storage-path.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { KioskPlansController } from './kiosk-plans.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [GoogleDriveModule],
  controllers: [DocumentsController, KioskPlansController],
  providers: [DocumentsService, StorageService, StoragePathService],
  exports: [DocumentsService, StorageService, StoragePathService],
})
export class DocumentsModule {}
