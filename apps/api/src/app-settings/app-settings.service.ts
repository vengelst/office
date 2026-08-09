/**
 * Service für App Settings.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liest einen Konfigurations- oder Datensatzwert.
   *
   * @param key - Einstellungs- oder Storage-Schlüssel (string)
   * @returns Gelesener Wert (string | null)
   */
  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  /**
   * Liest mehrere Einstellungsschlüssel.
   *
   * @param keys - Liste von Schlüsseln (string[])
   * @returns Key-Value-Map (Record<string, string>)
   */
  async getMany(keys: string[]): Promise<Record<string, string>> {
    const settings = await this.prisma.appSetting.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  /**
   * Setzt einen Einstellungswert.
   *
   * @param key - Einstellungs- oder Storage-Schlüssel (string)
   * @param value - Zu setzender Wert (string)
   * @returns Gespeicherter Wert (void)
   */
  async set(key: string, value: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  /**
   * Setzt mehrere Einstellungswerte.
   *
   * @param entries - Parameter `entries` (Record<string, string>)
   * @returns Gespeicherte Werte (void)
   */
  async setMany(entries: Record<string, string>): Promise<void> {
    const ops = Object.entries(entries).map(([key, value]) =>
      this.prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );
    await this.prisma.$transaction(ops);
  }

  /**
   * Löscht einen Einstellungsschlüssel.
   *
   * @param key - Einstellungs- oder Storage-Schlüssel (string)
   * @returns Ergebnis (void)
   */
  async delete(key: string): Promise<void> {
    await this.prisma.appSetting
      .delete({ where: { key } })
      .catch(() => undefined);
  }
}
