/**
 * HTTP-API für Storage Settings.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GoogleDriveService, DriveConfig } from './google-drive.service';

class StorageConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  folderId!: string;

  @IsString()
  serviceAccountJson!: string;

  @IsString()
  impersonateEmail!: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/storage')
export class StorageSettingsController {
  constructor(private readonly drive: GoogleDriveService) {}

  /**
   * Liest die aktuelle Konfiguration.
   *
   * @returns Konfigurationsobjekt (DriveConfig)
   */

  @Get()
  @ApiOperation({ summary: 'Google Drive Konfiguration laden' })
  async getConfig(): Promise<DriveConfig> {
    return this.drive.getConfig();
  }

  /**
   * Speichert die Konfiguration.
   *
   * @param dto - Request-Body / Eingabedaten (StorageConfigDto)
   * @returns Gespeicherte Konfiguration
   */

  @Put()
  @ApiOperation({ summary: 'Google Drive Konfiguration speichern' })
  async saveConfig(@Body() dto: StorageConfigDto): Promise<{ saved: true }> {
    await this.drive.saveConfig(dto);
    return { saved: true };
  }

  /**
   * Prüft die Verbindung zum externen Dienst.
   *
   * @returns Testergebnis
   */

  @Post('test')
  @ApiOperation({ summary: 'Google Drive Verbindung testen' })
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.drive.testConnection();
  }

  /**
   * Initialisiert die Ordnerstruktur im Storage.
   *
   * @returns Ergebnis der Initialisierung
   */

  @Post('init-folders')
  @ApiOperation({ summary: 'Hauptordner-Struktur in Google Drive anlegen' })
  async initFolders(): Promise<{ created: string[]; existing: string[] }> {
    return this.drive.initMainFolders();
  }
}
