/**
 * HTTP-API für Backups.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '@office/types';
import { BackupsService } from './backups.service';
import { RestoreBackupDto, UpdateBackupConfigDto } from './dto/backup.dto';

/**
 * Backup- und Restore-API (Settings/Admin: SUPERADMIN + OFFICE).
 * Full-Backup auf Server-Volume, Schedule, selektiver Modul-Restore.
 */
@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  /**
   * Listet verfügbare Backup-Module.
   *
   * @returns Modulliste
   */

  @Get('modules')
  @ApiOperation({ summary: 'Verfügbare Restore-Module' })
  modules() {
    return { modules: this.backups.listModules() };
  }

  /**
   * Liest die aktuelle Konfiguration.
   *
   * @returns Konfigurationsobjekt
   */

  @Get('config')
  @ApiOperation({ summary: 'Backup-Konfiguration (Schedule, Retention)' })
  getConfig() {
    return this.backups.getConfig();
  }

  /**
   * Aktualisiert die Konfiguration.
   *
   * @param dto - Request-Body / Eingabedaten (UpdateBackupConfigDto)
   * @returns Aktualisierte Konfiguration
   */

  @Patch('config')
  @ApiOperation({ summary: 'Backup-Konfiguration speichern' })
  updateConfig(@Body() dto: UpdateBackupConfigDto) {
    return this.backups.updateConfig(dto);
  }

  /**
   * Listet Restore-Vorgänge.
   *
   * @param limit - Seitengröße (string)
   * @returns Restore-Liste
   */

  @Get('restores')
  @ApiOperation({ summary: 'Restore-Protokoll' })
  listRestores(@Query('limit') limit?: string) {
    return this.backups.listRestores(limit ? Number(limit) : undefined);
  }

  /**
   * Listet Einträge der Domäne.
   *
   * @param limit - Seitengröße (string)
   * @returns Liste
   */

  @Get()
  @ApiOperation({ summary: 'Backup-Jobs auflisten' })
  async list(@Query('limit') limit?: string) {
    const jobs = await this.backups.listJobs(limit ? Number(limit) : undefined);
    return jobs.map((j) => this.backups.serializeJob(j));
  }

  /**
   * Startet den Vorgang.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Gestartetes Ergebnis
   */

  @Post()
  @ApiOperation({ summary: 'Manuelles Full-Backup starten' })
  start(@CurrentUser() user: AuthUser) {
    return this.backups.startManualBackup(user.id);
  }

  /**
   * Liest einen Konfigurations- oder Datensatzwert.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Gelesener Wert
   */

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnes Backup' })
  async get(@Param('id') id: string) {
    return this.backups.serializeJob(await this.backups.getJob(id));
  }

  /**
   * Stellt Daten aus einem Backup wieder her.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (RestoreBackupDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Restore-Ergebnis
   */

  @Post(':id/restore')
  @ApiOperation({ summary: 'Selektiver Restore aus Backup' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backups.restore(id, dto, user.id);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Backup inkl. Dateien löschen' })
  remove(@Param('id') id: string) {
    return this.backups.deleteJob(id);
  }
}
