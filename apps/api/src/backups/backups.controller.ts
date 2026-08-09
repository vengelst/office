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

  @Get('modules')
  @ApiOperation({ summary: 'Verfügbare Restore-Module' })
  modules() {
    return { modules: this.backups.listModules() };
  }

  @Get('config')
  @ApiOperation({ summary: 'Backup-Konfiguration (Schedule, Retention)' })
  getConfig() {
    return this.backups.getConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Backup-Konfiguration speichern' })
  updateConfig(@Body() dto: UpdateBackupConfigDto) {
    return this.backups.updateConfig(dto);
  }

  @Get('restores')
  @ApiOperation({ summary: 'Restore-Protokoll' })
  listRestores(@Query('limit') limit?: string) {
    return this.backups.listRestores(limit ? Number(limit) : undefined);
  }

  @Get()
  @ApiOperation({ summary: 'Backup-Jobs auflisten' })
  async list(@Query('limit') limit?: string) {
    const jobs = await this.backups.listJobs(limit ? Number(limit) : undefined);
    return jobs.map((j) => this.backups.serializeJob(j));
  }

  @Post()
  @ApiOperation({ summary: 'Manuelles Full-Backup starten' })
  start(@CurrentUser() user: AuthUser) {
    return this.backups.startManualBackup(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnes Backup' })
  async get(@Param('id') id: string) {
    return this.backups.serializeJob(await this.backups.getJob(id));
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Selektiver Restore aus Backup' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backups.restore(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Backup inkl. Dateien löschen' })
  remove(@Param('id') id: string) {
    return this.backups.deleteJob(id);
  }
}
