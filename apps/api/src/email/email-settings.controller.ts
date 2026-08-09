/**
 * HTTP-API für Email Settings.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmailService, SmtpConfig } from './email.service';

class SmtpConfigDto {
  host!: string;
  port!: number;
  user!: string;
  pass!: string;
  fromName!: string;
  fromEmail!: string;
  secure!: boolean;
}

class TestEmailDto {
  to!: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/email')
export class EmailSettingsController {
  constructor(private readonly email: EmailService) {}

  /**
   * Liest die aktuelle Konfiguration.
   *
   * @returns Konfigurationsobjekt
   */

  @Get()
  @ApiOperation({ summary: 'SMTP-Konfiguration laden' })
  async getConfig(): Promise<SmtpConfig & { configured: boolean }> {
    const config = await this.email.getConfig();
    if (!config) {
      return {
        host: '',
        port: 587,
        user: '',
        pass: '',
        fromName: '',
        fromEmail: '',
        secure: false,
        configured: false,
      };
    }
    return { ...config, configured: true };
  }

  /**
   * Speichert die Konfiguration.
   *
   * @param dto - Request-Body / Eingabedaten (SmtpConfigDto)
   * @returns Gespeicherte Konfiguration
   */

  @Put()
  @ApiOperation({ summary: 'SMTP-Konfiguration speichern' })
  async saveConfig(@Body() dto: SmtpConfigDto): Promise<{ saved: true }> {
    await this.email.saveConfig(dto);
    return { saved: true };
  }

  /**
   * Sendet eine Test-E-Mail zur SMTP-Prüfung.
   *
   * @param dto - Request-Body / Eingabedaten (TestEmailDto)
   * @returns Sendestatus
   */

  @Post('test')
  @ApiOperation({ summary: 'Test-E-Mail senden' })
  async sendTest(
    @Body() dto: TestEmailDto,
  ): Promise<{ success: boolean; error?: string }> {
    return this.email.sendTest(dto.to);
  }
}
