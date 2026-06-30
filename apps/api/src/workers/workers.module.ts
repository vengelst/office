import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [DocumentsModule, EmailModule],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
