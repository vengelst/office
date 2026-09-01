/**
 * Kiosk-API für aktuelle Projektpläne (nur isLatest + DRAWING).
 * Auth: Worker-Token (PIN-Session), analog anderer Kiosk-/Worker-Routen.
 */

import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WorkerAuthGuard } from '../auth/guards/worker-auth.guard';
import { DocumentsService } from './documents.service';

@ApiTags('kiosk-plans')
@ApiBearerAuth()
@Public()
@UseGuards(WorkerAuthGuard)
@Controller('kiosk/projects/:projectId/plans')
export class KioskPlansController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Liste der aktuellen Pläne (DRAWING, isLatest) für das Kiosk-Projekt.
   * GET /api/kiosk/projects/:projectId/plans
   */
  @Get()
  @ApiOperation({
    summary: 'Aktuelle Projektpläne für Kiosk (nur isLatest)',
  })
  list(@Param('projectId') projectId: string) {
    return this.documents.listKioskPlans(projectId);
  }

  /**
   * Dateistream eines aktuellen Plans. Alte Revisionen / fremde Projekte → 404.
   * GET /api/kiosk/projects/:projectId/plans/:documentId/file
   */
  @Get(':documentId/file')
  @ApiOperation({
    summary: 'Plan-Datei streamen (nur DRAWING + isLatest + Projekt)',
  })
  async file(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename, mimeType } =
      await this.documents.getKioskPlanDownload(projectId, documentId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }
}
