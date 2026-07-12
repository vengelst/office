import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemInfoController } from './system-info.controller';
import { SystemInfoService } from './system-info.service';

@Module({
  imports: [PrismaModule],
  controllers: [SystemInfoController],
  providers: [SystemInfoService],
})
export class SystemInfoModule {}
