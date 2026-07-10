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
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/storage')
export class StorageSettingsController {
  constructor(private readonly drive: GoogleDriveService) {}

  @Get()
  @ApiOperation({ summary: 'Google Drive Konfiguration laden' })
  async getConfig(): Promise<DriveConfig> {
    return this.drive.getConfig();
  }

  @Put()
  @ApiOperation({ summary: 'Google Drive Konfiguration speichern' })
  async saveConfig(@Body() dto: StorageConfigDto): Promise<{ saved: true }> {
    await this.drive.saveConfig(dto);
    return { saved: true };
  }

  @Post('test')
  @ApiOperation({ summary: 'Google Drive Verbindung testen' })
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.drive.testConnection();
  }
}
