import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CompleteReportDto,
  MyWorkItemsQueryDto,
  ReworkReportDto,
  StartSessionDto,
  StopSessionDto,
} from './dto/workflow.dto';
import { WorkItemWorkflowService } from './work-item-workflow.service';
import { WorkItemsService } from './work-items.service';

/** Maximale Foto-Größe je Datei: 10 MB (analog time-entries). */
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/** Maximale Anzahl Fotos je Rückmeldung. */
const MAX_PHOTOS = 10;

/**
 * Monteur-Endpunkte der Arbeitsitems (Monteur-App).
 *
 *  - `GET   /workers/me/work-items`            eigene Items, offener Pool, laufende Session
 *  - `GET   /workers/me/work-items/:id`        Item-Detail für den Monteur
 *  - `POST  /work-items/:id/claim`             Item nehmen → IN_PROGRESS
 *  - `POST  /work-items/:id/sessions/start`    aktuelles Item (beendet offene Sessions)
 *  - `POST  /work-items/:id/sessions/stop`     Session beenden
 *  - `POST  /work-items/:id/reports/complete`  Fertigmeldung, min. 2 Fotos → REVIEW
 *  - `POST  /work-items/:id/reports/rework`    Nacharbeit → REWORK (Zuordnung bleibt)
 *
 * Authentifizierung über den globalen JwtAuthGuard: akzeptiert das Worker-Token
 * (PIN-Login) und – bei verknüpftem Monteur-Datensatz – auch ein Benutzer-Token.
 * Die Auflösung auf den Monteur erfolgt in `WorkItemWorkflowService.resolveWorkerId`.
 * Fotos werden als Multipart-Feld `photos` erwartet.
 */
@ApiTags('work-items')
@ApiBearerAuth()
@Controller()
export class WorkerWorkItemsController {
  constructor(
    private readonly workItems: WorkItemsService,
    private readonly workflow: WorkItemWorkflowService,
  ) {}

  // ── Eigene Items ─────────────────────────────────────────────

  @Get('workers/me/work-items')
  @ApiOperation({
    summary: 'Items des angemeldeten Monteurs (eigene + offener Pool)',
  })
  async findMine(
    @Query() query: MyWorkItemsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workerId = await this.workflow.resolveWorkerId(user);
    return this.workItems.findForWorker(workerId, query.projectId);
  }

  @Get('workers/me/work-items/:id')
  @ApiOperation({ summary: 'Item-Detail für den Monteur' })
  async findMineOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const workerId = await this.workflow.resolveWorkerId(user);
    return this.workItems.findOneForWorker(id, workerId);
  }

  // ── Nehmen ───────────────────────────────────────────────────

  @Post('work-items/:id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Item nehmen (OPEN → IN_PROGRESS)' })
  claim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.workflow.claim(id, user);
  }

  // ── Item-Zeit ────────────────────────────────────────────────

  @Post('work-items/:id/sessions/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aktuelles Item setzen: neue Zeitsession starten',
    description: 'Beendet zuvor alle offenen Sessions des Monteurs.',
  })
  startSession(
    @Param('id') id: string,
    @Body() dto: StartSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.startSession(id, dto, user);
  }

  @Post('work-items/:id/sessions/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Laufende Zeitsession an diesem Item beenden' })
  stopSession(
    @Param('id') id: string,
    @Body() dto: StopSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.stopSession(id, dto, user);
  }

  // ── Rückmeldungen ────────────────────────────────────────────

  @Post('work-items/:id/reports/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fertigmeldung (min. 2 Fotos) → Kontrolle',
    description:
      'Multipart-Feld `photos` mit Bilddateien und/oder `documentIds` bereits ' +
      'hochgeladener Fotos. Beendet alle aktiven Zuordnungen und offenen Sessions.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS, { limits: { fileSize: MAX_PHOTO_SIZE } }),
  )
  reportComplete(
    @Param('id') id: string,
    @UploadedFiles() photos: Express.Multer.File[] | undefined,
    @Body() dto: CompleteReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.reportComplete(id, photos, dto, user);
  }

  @Post('work-items/:id/reports/rework')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nacharbeit melden (Fotos optional) – Item bleibt beim Monteur',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS, { limits: { fileSize: MAX_PHOTO_SIZE } }),
  )
  reportRework(
    @Param('id') id: string,
    @UploadedFiles() photos: Express.Multer.File[] | undefined,
    @Body() dto: ReworkReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.reportRework(id, photos, dto, user);
  }
}
