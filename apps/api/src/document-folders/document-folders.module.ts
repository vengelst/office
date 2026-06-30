import { Module } from '@nestjs/common';
import { DocumentFoldersController } from './document-folders.controller';
import { DocumentFoldersService } from './document-folders.service';

@Module({
  controllers: [DocumentFoldersController],
  providers: [DocumentFoldersService],
  exports: [DocumentFoldersService],
})
export class DocumentFoldersModule {}
