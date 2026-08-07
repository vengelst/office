import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService } from '../documents/documents.service';
import { ListWorkItemsQueryDto, ReviewDto } from './dto/workflow.dto';
import { ProjectCustomerPlsService } from './project-customer-pls.service';
import { WorkItemWorkflowService } from './work-item-workflow.service';
import { WorkItemsService } from './work-items.service';

/**
 * Kunden-PL-Endpunkte (Rolle CUSTOMER_PL, SUPERADMIN darf ebenfalls).
 * Der Zugriff ist zusätzlich auf die zugeordneten Projekte beschränkt
 * (`ProjectCustomerPlAssignment`, geprüft in `assertCustomerPlAccess`).
 *
 *  - `GET  /pl/projects`                       eigene item-basierte Projekte
 *  - `GET  /pl/projects/:projectId/work-items` Board-Daten (Filter: status, blockKey, q)
 *  - `GET  /pl/work-items/:id`                 Item-Detail
 *  - `GET  /pl/work-items/:id/photos/:documentId`   Foto der Fertigmeldung (Stream)
 *  - `POST /work-items/:id/reviews/approve`         Kontrolle bestanden → APPROVED
 *  - `POST /work-items/:id/reviews/force-complete`  PL setzt selbst fertig → APPROVED
 */
@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.CUSTOMER_PL, RoleCode.SUPERADMIN)
@Controller()
export class CustomerPlWorkItemsController {
  constructor(
    private readonly workItems: WorkItemsService,
    private readonly workflow: WorkItemWorkflowService,
    private readonly customerPls: ProjectCustomerPlsService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Board ────────────────────────────────────────────────────

  @Get('pl/projects')
  @ApiOperation({ summary: 'Projekte, für die der Kunden-PL freigeschaltet ist' })
  findProjects(@CurrentUser() user: AuthUser) {
    return this.customerPls.findProjectsForUser(user);
  }

  @Get('pl/projects/:projectId/work-items')
  @ApiOperation({ summary: 'Board-Daten eines Projekts (inkl. Status-Zähler)' })
  findWorkItems(
    @Param('projectId') projectId: string,
    @Query() query: ListWorkItemsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workItems.findForCustomerPl(projectId, query, user);
  }

  @Get('pl/work-items/:id')
  @ApiOperation({ summary: 'Item-Detail inkl. Fotos der Fertigmeldung' })
  findWorkItem(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.workItems.findOneForCustomerPl(id, user);
  }

  /**
   * Streamt ein Foto der Fertig-/Nacharbeitsmeldung.
   * Bewusst eng geschnitten: nur Dokumente, die am Item oder an einer seiner
   * Rückmeldungen hängen – `/documents/:id/download` bleibt für Kunden-PLs zu.
   */
  @Get('pl/work-items/:id/photos/:documentId')
  @ApiOperation({ summary: 'Foto einer Rückmeldung dieses Items (Stream)' })
  async findPhoto(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.workItems.assertCustomerPlPhotoAccess(id, documentId, user);
    const { stream, filename, mimeType } =
      await this.documents.getDownload(documentId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  // ── Prüfung ──────────────────────────────────────────────────

  @Post('work-items/:id/reviews/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fertigmeldung bestätigen (nur aus Status REVIEW) → APPROVED',
  })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.approve(id, dto, user);
  }

  @Post('work-items/:id/reviews/force-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Item selbst fertig setzen (aus jedem Status außer APPROVED)',
  })
  forceComplete(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workflow.forceComplete(id, dto, user);
  }
}
