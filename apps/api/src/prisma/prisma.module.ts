import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Globales Prisma-Modul – stellt den PrismaService app-weit als Singleton bereit.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
