/**
 * HTTP-API für Worker Work Items.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentsService } from '../documents/documents.service';
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
 *  - `GET   /workers/me/work-items/:id/pdf`    Block-PDF dieses Items (Stream)
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
  private readonly logger = new Logger(WorkerWorkItemsController.name);

  constructor(
    private readonly workItems: WorkItemsService,
    private readonly workflow: WorkItemWorkflowService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Eigene Items ─────────────────────────────────────────────

  @Get('workers/me/work-items')
  @ApiOperation({
    summary: 'Items des angemeldeten Monteurs (eigene + offener Pool)',
  })
  /**
   * Listet dem Monteur zugängliche/zugewiesene Items.
   *
   * @param query - Query-Parameter der Anfrage (MyWorkItemsQueryDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Item-Liste
   */
  async findMine(
    @Query() query: MyWorkItemsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workerId = await this.workflow.resolveWorkerId(user);
    return this.workItems.findForWorker(workerId, query.projectId);
  }

  /**
   * Lädt ein dem Monteur zugängliches Item.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Item
   */

  @Get('workers/me/work-items/:id')
  @ApiOperation({ summary: 'Item-Detail für den Monteur' })
  async findMineOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const workerId = await this.workflow.resolveWorkerId(user);
    return this.workItems.findOneForWorker(id, workerId);
  }

  // ── Unterlage (Block-PDF) ────────────────────────────────────

  /**
   * Streamt das Block-PDF dieses Items (SPEZ 6.5 „Unterlage öffnen“).
   *
   * Bewusst eng geschnitten, analog zum Foto-Endpunkt des Kunden-PLs: Der
   * Aufrufer nennt **nur** das Item, die Dokument-ID kommt aus
   * `item.block.pdfDocumentId`. `/documents/:id/download` bleibt damit für die
   * Rolle `WORKER` gesperrt – es gibt keinen generellen Dokument-Download.
   */
  @Get('workers/me/work-items/:id/pdf')
  @ApiOperation({
    summary: 'Block-PDF dieses Items (Stream)',
    description:
      'Zugriff nur mit aktiver Item- oder Projektzuordnung. 404 „Kein PDF ' +
      'verknüpft“, wenn am Block kein PDF hinterlegt ist.',
  })
  @ApiQuery({
    name: 'inline',
    required: false,
    description: '`1` liefert `Content-Disposition: inline` für den Mobile-Viewer.',
  })
  /**
   * Liefert die PDF-Unterlage für ein Monteur-Item.
   *
   * @returns PDF/Stream
   */
  async findMinePdf(
    @Param('id') id: string,
    @Query('inline') inline: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const workerId = await this.workflow.resolveWorkerId(user);
    const { documentId, itemKey, blockKey } = await this.workItems.findWorkerPdf(
      id,
      workerId,
    );
    const { stream, filename, mimeType } =
      await this.documents.getDownload(documentId);

    const disposition = inline === '1' || inline === 'true' ? 'inline' : 'attachment';
    this.logger.debug(
      `Block-PDF ${blockKey} (Item ${itemKey}) an Monteur ${workerId} – ${disposition}`,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  // ── Nehmen ───────────────────────────────────────────────────

  /**
   * Nimmt ein Item für den Monteur in Anspruch.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Aktualisiertes Item
   */

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
  /**
   * Startet die Arbeitssession an einem Item.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (StartSessionDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Session
   */
  startSession(
    @Param('id') id: string,
    @Body() dto: StartSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.startSession(id, dto, user);
  }

  /**
   * Beendet die Arbeitssession an einem Item.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (StopSessionDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Session
   */

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
  /**
   * Meldet ein Item als fertig (inkl. Fotos).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param photos - Parameter `photos` (Express.Multer.File[] | undefined)
   * @param dto - Request-Body / Eingabedaten (CompleteReportDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Aktualisiertes Item
   */
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
  /**
   * Meldet Nacharbeit an einem Item.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param photos - Parameter `photos` (Express.Multer.File[] | undefined)
   * @param dto - Request-Body / Eingabedaten (ReworkReportDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Aktualisiertes Item
   */
  reportRework(
    @Param('id') id: string,
    @UploadedFiles() photos: Express.Multer.File[] | undefined,
    @Body() dto: ReworkReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.reportRework(id, photos, dto, user);
  }
}
