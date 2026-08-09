/**
 * HTTP-API für Time Entries.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TimeEntriesService } from './time-entries.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';

/** Maximale Foto-Größe: 10 MB. */
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/**
 * Stempel-Endpoints. Erreichbar sowohl mit Office-Token (Admin/PM) als auch
 * mit Worker-Token (Monteur selbst) – der globale JwtAuthGuard akzeptiert
 * beide Token-Typen; die Eigentümer-Prüfung erfolgt im Service.
 */
@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  /**
   * Liefert live gestempelte Einträge.
   *
   * @returns Live-Liste
   */

  @Get('live')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER')
  @ApiOperation({ summary: 'Alle aktuell eingestempelten Monteure' })
  live() {
    return this.timeEntries.live();
  }

  /**
   * Stempelt den Monteur ein (Arbeitsbeginn).
   *
   * @param dto - Request-Body / Eingabedaten (ClockInDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Time-Entry
   */

  @Post('clock-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Einstempeln' })
  clockIn(@Body() dto: ClockInDto, @CurrentUser() user: AuthUser) {
    return this.timeEntries.clockIn(dto, user);
  }

  /**
   * Stempelt den Monteur aus (Arbeitsende).
   *
   * @param dto - Request-Body / Eingabedaten (ClockOutDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Time-Entry
   */

  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ausstempeln' })
  clockOut(@Body() dto: ClockOutDto, @CurrentUser() user: AuthUser) {
    return this.timeEntries.clockOut(dto, user);
  }

  @Post('upload-photo')
  @ApiOperation({ summary: 'Arbeitsfoto hochladen (Multipart)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE } }),
  )
  /**
   * Lädt ein Stempel-/Nachweisfoto hoch.
   *
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File | undefined)
   * @param dto - Request-Body / Eingabedaten (UploadPhotoDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Upload-Ergebnis
   */
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timeEntries.uploadPhoto(file, dto, user);
  }

  /**
   * Liefert den Stempelstatus für ein Projekt.
   *
   * @param projectId - ID des Projekts (string)
   * @returns Status
   */

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('project-status/:projectId')
  @ApiOperation({ summary: 'Stempel-Status aller Monteure eines Projekts (Kiosk)' })
  projectStatus(@Param('projectId') projectId: string) {
    return this.timeEntries.projectStatus(projectId);
  }

  /**
   * Liefert den aktuellen Stempelstatus.
   *
   * @param workerId - ID des Monteurs (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Status
   */

  @Get('status/:workerId')
  @ApiOperation({ summary: 'Aktueller Stempel-Status eines Monteurs' })
  status(
    @Param('workerId') workerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timeEntries.status(workerId, user);
  }

  /**
   * Liefert die heutigen Zeiteinträge.
   *
   * @param workerId - ID des Monteurs (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Liste der heutigen Einträge
   */

  @Get('today/:workerId')
  @ApiOperation({ summary: 'Heutige Stempel-Einträge eines Monteurs' })
  today(@Param('workerId') workerId: string, @CurrentUser() user: AuthUser) {
    return this.timeEntries.today(workerId, user);
  }
}
