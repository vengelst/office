/**
 * HTTP-API für Google-Contacts-Einstellungen.
 */

import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ContactsConfig,
  GoogleContactsService,
} from './google-contacts.service';

class ContactsConfigDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/contacts')
export class ContactsSettingsController {
  constructor(private readonly contacts: GoogleContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Google Contacts Konfiguration laden' })
  getConfig(): Promise<ContactsConfig> {
    return this.contacts.getConfig();
  }

  @Put()
  @ApiOperation({ summary: 'Google Contacts Konfiguration speichern' })
  async saveConfig(
    @Body() dto: ContactsConfigDto,
  ): Promise<{ saved: true }> {
    await this.contacts.saveConfig(dto);
    return { saved: true };
  }

  @Post('test')
  @ApiOperation({ summary: 'Google Contacts Verbindung testen' })
  testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.contacts.testConnection();
  }
}
