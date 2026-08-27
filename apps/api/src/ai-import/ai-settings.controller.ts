/**
 * HTTP-API für KI-Assistent-Einstellungen.
 */

import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiAssistantService } from './ai-assistant.service';
import { AiSettingsUpdateDto } from './dto/ai-import.dto';
import type { AiAssistantConfigPublic } from './types';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/ai')
export class AiSettingsController {
  constructor(private readonly ai: AiAssistantService) {}

  @Get()
  @ApiOperation({ summary: 'KI-Assistent-Konfiguration laden' })
  async getConfig(): Promise<AiAssistantConfigPublic> {
    return this.ai.getPublicConfig();
  }

  @Put()
  @ApiOperation({ summary: 'KI-Assistent-Konfiguration speichern' })
  async saveConfig(
    @Body() dto: AiSettingsUpdateDto,
  ): Promise<{ saved: true }> {
    await this.ai.saveConfig(dto);
    return { saved: true };
  }

  @Post('test')
  @ApiOperation({ summary: 'KI-API-Verbindung testen' })
  async test(): Promise<{ success: boolean; error?: string }> {
    return this.ai.testConnection();
  }
}
