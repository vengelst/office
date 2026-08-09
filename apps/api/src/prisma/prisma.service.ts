/**
 * NestJS-Wrapper um den Prisma-Client.
 * Stellt die DB-Verbindung bereit und steuert Connect/Disconnect am Lifecycle.
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  INestApplication,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma-Client als Singleton-Service.
 * Verbindet sich beim Modul-Start und trennt beim Shutdown.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Lifecycle-Hook: Initialisierung nach Modulstart.
   *
   * @returns void (void)
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Lifecycle-Hook: Aufräumen vor Modulende.
   *
   * @returns void (void)
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Aktiviert sauberes Herunterfahren der Nest-App bei Prisma-Beendigung.
   *
   * @param app - Parameter `app` (INestApplication)
   * @returns void
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
