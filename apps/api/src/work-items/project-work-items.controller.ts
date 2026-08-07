import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBlockDto, UpdateBlockDto } from './dto/block.dto';
import { CreateWorkItemDto } from './dto/work-item.dto';
import {
  CreateCustomerPlDto,
  ImportWorkItemsDto,
  ListWorkItemsQueryDto,
} from './dto/workflow.dto';
import { ProjectCustomerPlsService } from './project-customer-pls.service';
import { WorkItemBlocksService } from './work-item-blocks.service';
import { WorkItemImportService } from './work-item-import.service';
import { WorkItemsService } from './work-items.service';

/** Maximale Größe je Import-Datei: 20 MB. */
const MAX_IMPORT_SIZE = 20 * 1024 * 1024;

/**
 * Büro-/Admin-Endpunkte der Arbeitsitems, projektbezogen.
 *
 *  - `GET|POST         /projects/:projectId/blocks`
 *  - `PATCH|DELETE     /projects/:projectId/blocks/:blockId`
 *  - `GET|POST         /projects/:projectId/work-items`
 *  - `POST             /projects/:projectId/work-items/import`  (Multipart, Feld `files`)
 *  - `POST             /projects/:projectId/work-items/import/preview`
 *  - `GET|POST         /projects/:projectId/customer-pls`
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
    private readonly customerPls: ProjectCustomerPlsService,
  ) {}

  // ── Blöcke ───────────────────────────────────────────────────

  @Get('blocks')
  @ApiOperation({ summary: 'Blöcke des Projekts (inkl. Item-Anzahl)' })
  findBlocks(@Param('projectId') projectId: string) {
    return this.blocks.findAll(projectId);
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Block anlegen' })
  createBlock(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBlockDto,
  ) {
    return this.blocks.create(projectId, dto);
  }

  @Patch('blocks/:blockId')
  @ApiOperation({ summary: 'Block bearbeiten (Name, Block-PDF verknüpfen)' })
  updateBlock(
    @Param('projectId') projectId: string,
    @Param('blockId') blockId: string,
    @Body() dto: UpdateBlockDto,
  ) {
    return this.blocks.update(projectId, blockId, dto);
  }

  @Delete('blocks/:blockId')
  @ApiOperation({ summary: 'Block löschen (Items bleiben, ohne Block-Bezug)' })
  removeBlock(
    @Param('projectId') projectId: string,
    @Param('blockId') blockId: string,
  ) {
    return this.blocks.remove(projectId, blockId);
  }

  // ── Import (statische Route vor den Item-Routen) ─────────────

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
  previewImport(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: ImportWorkItemsDto,
  ) {
    return this.importer.preview(projectId, files, dto);
  }

  // ── Items ────────────────────────────────────────────────────

  @Get('work-items')
  @ApiOperation({ summary: 'Items des Projekts (Filter: status, blockKey, q)' })
  findItems(
    @Param('projectId') projectId: string,
    @Query() query: ListWorkItemsQueryDto,
  ) {
    return this.workItems.findByProject(projectId, query);
  }

  @Post('work-items')
  @ApiOperation({ summary: 'Einzelnes Item anlegen (Regelfall ist der Import)' })
  createItem(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemDto,
  ) {
    return this.workItems.create(projectId, dto);
  }

  // ── Kunden-PL-Zuordnungen ────────────────────────────────────

  @Get('customer-pls/candidates')
  @ApiOperation({ summary: 'Auswählbare Benutzer mit Rolle CUSTOMER_PL' })
  listCustomerPlCandidates() {
    return this.customerPls.listCandidates();
  }

  @Get('customer-pls')
  @ApiOperation({ summary: 'Kunden-PLs des Projekts' })
  findCustomerPls(@Param('projectId') projectId: string) {
    return this.customerPls.findAll(projectId);
  }

  @Post('customer-pls')
  @ApiOperation({ summary: 'Kunden-PL zuordnen (nur Rolle CUSTOMER_PL)' })
  createCustomerPl(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCustomerPlDto,
  ) {
    return this.customerPls.create(projectId, dto);
  }

  @Delete('customer-pls/:userId')
  @ApiOperation({ summary: 'Kunden-PL-Zuordnung aufheben (setzt inaktiv)' })
  removeCustomerPl(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.customerPls.remove(projectId, userId);
  }
}
