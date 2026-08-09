import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupDataService } from './backup-data.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [BackupsController],
  providers: [BackupsService, BackupDataService],
  exports: [BackupsService],
})
export class BackupsModule {}
