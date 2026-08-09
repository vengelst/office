/**
 * HTTP-API für Project Work Items.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBlockDto, UpdateBlockDto } from './dto/block.dto';
import { PdfImportCommitDto, PdfImportPreviewDto } from './dto/pdf-import.dto';
import { CreateWorkItemDto } from './dto/work-item.dto';
import {
  CreateCustomerPlDto,
  ImportWorkItemsDto,
  ListWorkItemsQueryDto,
  UpdateCustomerPlDto,
} from './dto/workflow.dto';
import { ProjectCustomerPlsService } from './project-customer-pls.service';
import { WorkItemBlocksService } from './work-item-blocks.service';
import { WorkItemImportService } from './work-item-import.service';
import { WorkItemPdfImportService } from './work-item-pdf-import.service';
import { WorkItemsService } from './work-items.service';

/** Maximale Größe je Import-Datei: 20 MB. */
const MAX_IMPORT_SIZE = 20 * 1024 * 1024;

/** Maximale Größe für PDF-Importe: 50 MB. */
const MAX_PDF_IMPORT_SIZE = 50 * 1024 * 1024;

/**
 * Büro-/Admin-Endpunkte der Arbeitsitems, projektbezogen.
 *
 *  - `GET|POST         /projects/:projectId/blocks`
 *  - `PATCH|DELETE     /projects/:projectId/blocks/:blockId`
 *  - `GET|POST         /projects/:projectId/work-items`
 *  - `POST             /projects/:projectId/work-items/import`  (Multipart, Feld `files`)
 *  - `POST             /projects/:projectId/work-items/import/preview`
 *  - `GET|POST         /projects/:projectId/customer-pls`
 *  - `PATCH            /projects/:projectId/customer-pls/:userId`
 *  - `GET              /projects/:projectId/customer-pls/candidates`
 *  - `DELETE           /projects/:projectId/customer-pls/:userId`
 *
 * `itemBased` wird über den bestehenden `PATCH /projects/:id` gesetzt.
 */
@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('projects/:projectId')
export class ProjectWorkItemsController {
  constructor(
    private readonly workItems: WorkItemsService,
    private readonly blocks: WorkItemBlocksService,
    private readonly importer: WorkItemImportService,
    private readonly pdfImporter: WorkItemPdfImportService,
    private readonly customerPls: ProjectCustomerPlsService,
  ) {}

  // ── Blöcke ───────────────────────────────────────────────────

  /**
   * Listet Work-Item-Blöcke eines Projekts.
   *
   * @param projectId - ID des Projekts (string)
   * @returns Block-Liste
   */

  @Get('blocks')
  @ApiOperation({ summary: 'Blöcke des Projekts (inkl. Item-Anzahl)' })
  findBlocks(@Param('projectId') projectId: string) {
    return this.blocks.findAll(projectId);
  }

  /**
   * Legt einen Work-Item-Block an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateBlockDto)
   * @returns Neuer Block
   */

  @Post('blocks')
  @ApiOperation({ summary: 'Block anlegen' })
  createBlock(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBlockDto,
  ) {
    return this.blocks.create(projectId, dto);
  }

  /**
   * Aktualisiert einen Work-Item-Block.
   *
   * @param projectId - ID des Projekts (string)
   * @param blockId - ID des Work-Item-Blocks (string)
   * @param dto - Request-Body / Eingabedaten (UpdateBlockDto)
   * @returns Aktualisierter Block
   */

  @Patch('blocks/:blockId')
  @ApiOperation({ summary: 'Block bearbeiten (Name, Block-PDF verknüpfen)' })
  updateBlock(
    @Param('projectId') projectId: string,
    @Param('blockId') blockId: string,
    @Body() dto: UpdateBlockDto,
  ) {
    return this.blocks.update(projectId, blockId, dto);
  }

  /**
   * Entfernt einen Work-Item-Block.
   *
   * @param projectId - ID des Projekts (string)
   * @param blockId - ID des Work-Item-Blocks (string)
   * @returns Ergebnis
   */

  @Delete('blocks/:blockId')
  @ApiOperation({ summary: 'Block löschen (Items bleiben, ohne Block-Bezug)' })
  removeBlock(
    @Param('projectId') projectId: string,
    @Param('blockId') blockId: string,
  ) {
    return this.blocks.remove(projectId, blockId);
  }

  // ── PDF-Import (primär) ──────────────────────────────────────

  @Post('work-items/import-pdf/preview')
  @ApiOperation({
    summary: 'PDF-Import Vorschau (1 Seite = 1 Item, schreibt nicht)',
    description:
      'Multipart-Feld `file` mit PDF. Liefert je Seite einen Item-Entwurf mit ' +
      'Platzhalter-Kennung. Bestehende Kennungen werden als Warnung gemeldet.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_IMPORT_SIZE } }),
  )
  /**
   * Vorschau eines PDF-Imports ohne Commit.
   *
   * @param projectId - ID des Projekts (string)
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File | undefined)
   * @param dto - Request-Body / Eingabedaten (PdfImportPreviewDto)
   * @returns Import-Vorschau
   */
  previewPdfImport(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PdfImportPreviewDto,
  ) {
    return this.pdfImporter.preview(projectId, file, dto);
  }

  @Post('work-items/import-pdf')
  @ApiOperation({
    summary: 'PDF-Import ausführen (Items anlegen/aktualisieren)',
    description:
      'Multipart-Feld `file` (PDF) ODER `pdfDocumentId` + JSON-Feld `items` ' +
      'mit der editierten Item-Liste. Neue Items: Status OPEN.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_IMPORT_SIZE } }),
  )
  /**
   * Übernimmt die PDF-Import-Vorschau in die DB.
   *
   * @param projectId - ID des Projekts (string)
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File | undefined)
   * @param dto - Request-Body / Eingabedaten (PdfImportCommitDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Import-Ergebnis
   */
  commitPdfImport(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PdfImportCommitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pdfImporter.commit(projectId, file, dto, user.id);
  }

  // ── Excel-/CSV-Import (Fallback) ───────────────────────────────

  @Post('work-items/import')
  @ApiOperation({
    summary: 'Items + Material aus Excel/CSV importieren',
    description:
      'Multipart-Feld `files` mit .xlsx (Blätter "Items" und "Material") und/oder CSV-Dateien. ' +
      'Upsert je (Projekt, itemKey); Materialzeilen eines enthaltenen Items werden ersetzt.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: MAX_IMPORT_SIZE } }),
  )
  /**
   * Importiert Work-Items aus Quelldaten.
   *
   * @param projectId - ID des Projekts (string)
   * @param files - Hochgeladene Dateien (Multer) (Express.Multer.File[] | undefined)
   * @param dto - Request-Body / Eingabedaten (ImportWorkItemsDto)
   * @returns Import-Ergebnis
   */
  import(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: ImportWorkItemsDto,
  ) {
    return this.importer.import(projectId, files, dto);
  }

  @Post('work-items/import/preview')
  @ApiOperation({ summary: 'Import nur prüfen (schreibt nicht)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: MAX_IMPORT_SIZE } }),
  )
  /**
   * Vorschau eines Imports ohne Persistenz.
   *
   * @param projectId - ID des Projekts (string)
   * @param files - Hochgeladene Dateien (Multer) (Express.Multer.File[] | undefined)
   * @param dto - Request-Body / Eingabedaten (ImportWorkItemsDto)
   * @returns Import-Vorschau
   */
  previewImport(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: ImportWorkItemsDto,
  ) {
    return this.importer.preview(projectId, files, dto);
  }

  // ── Items ────────────────────────────────────────────────────

  /**
   * Listet Work-Items des Projekts.
   *
   * @param projectId - ID des Projekts (string)
   * @param query - Query-Parameter der Anfrage (ListWorkItemsQueryDto)
   */

  @Get('work-items')
  @ApiOperation({ summary: 'Items des Projekts (Filter: status, blockKey, q)' })
  findItems(
    @Param('projectId') projectId: string,
    @Query() query: ListWorkItemsQueryDto,
  ) {
    return this.workItems.findByProject(projectId, query);
  }

  /**
   * Legt ein Work-Item an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateWorkItemDto)
   */

  @Post('work-items')
  @ApiOperation({ summary: 'Einzelnes Item anlegen (Regelfall ist der Import)' })
  createItem(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemDto,
  ) {
    return this.workItems.create(projectId, dto);
  }

  // ── Kunden-PL-Zuordnungen ────────────────────────────────────

  /**
   * Listet Kandidaten für die Kunden-PL-Rolle.
   */

  @Get('customer-pls/candidates')
  @ApiOperation({ summary: 'Auswählbare Benutzer mit Rolle CUSTOMER_PL' })
  listCustomerPlCandidates() {
    return this.customerPls.listCandidates();
  }

  /**
   * Listet dem Projekt zugeordnete Kunden-PLs.
   *
   * @param projectId - ID des Projekts (string)
   */

  @Get('customer-pls')
  @ApiOperation({ summary: 'Kunden-PLs des Projekts' })
  findCustomerPls(@Param('projectId') projectId: string) {
    return this.customerPls.findAll(projectId);
  }

  /**
   * Ordnet einen Kunden-PL dem Projekt zu.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateCustomerPlDto)
   */

  @Post('customer-pls')
  @ApiOperation({ summary: 'Kunden-PL zuordnen (nur Rolle CUSTOMER_PL)' })
  createCustomerPl(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCustomerPlDto,
  ) {
    return this.customerPls.create(projectId, dto);
  }

  /**
   * Aktualisiert die Kunden-PL-Zuordnung.
   *
   * @param projectId - ID des Projekts (string)
   * @param userId - ID (userId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateCustomerPlDto)
   */

  @Patch('customer-pls/:userId')
  @ApiOperation({ summary: 'Kunden-PL-Zuordnung aktualisieren (Zustell-E-Mail)' })
  updateCustomerPl(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCustomerPlDto,
  ) {
    return this.customerPls.update(projectId, userId, dto);
  }

  /**
   * Entfernt die Kunden-PL-Zuordnung.
   *
   * @param projectId - ID des Projekts (string)
   * @param userId - ID (userId) (string)
   */

  @Delete('customer-pls/:userId')
  @ApiOperation({ summary: 'Kunden-PL-Zuordnung aufheben (setzt inaktiv)' })
  removeCustomerPl(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.customerPls.remove(projectId, userId);
  }
}
