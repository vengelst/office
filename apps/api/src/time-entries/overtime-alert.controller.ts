/**
 * Manuelle Trigger für Arbeitszeit-Alarm: Test-Mail und Sofort-Prüfung.
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OvertimeAlertService } from './overtime-alert.service';

class OvertimeAlertTestDto {
  /** Optional: abweichender Empfänger; sonst konfigurierte Adresse. */
  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'Ungültige Test-E-Mail-Adresse' })
  to?: string;
}

@ApiTags('kiosk-settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('kiosk-settings/overtime-alert')
export class OvertimeAlertController {
  constructor(private readonly overtimeAlert: OvertimeAlertService) {}

  @Post('test')
  @ApiOperation({
    summary: 'Test-E-Mail für Arbeitszeit-Alarm senden (ohne Stempeldaten)',
  })
  async sendTest(@Body() dto: OvertimeAlertTestDto): Promise<{
    success: boolean;
    to: string;
    error?: string;
  }> {
    return this.overtimeAlert.sendTestMail(dto.to);
  }

  @Post('run')
  @ApiOperation({
    summary:
      'Arbeitszeit-Alarm jetzt prüfen (sendet erneut auch bei bereits gemeldeten offenen Stempelungen)',
  })
  async runNow(): Promise<{
    checked: number;
    sent: number;
    to: string;
    alertHours: number;
  }> {
    return this.overtimeAlert.checkAndNotify(true);
  }
}
