import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
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
import { RoleCode } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';
import { ReturnEquipmentDto } from './dto/return-equipment.dto';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Controller für das Werkzeug- & Gerätemanagement.
 * CRUD, Bild-Upload, Ausgabe an Monteure und Rückgabe.
 */
@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  // ── Statische Routen ──────────────────────────────────────────

  @Get('meta/workers')
  @ApiOperation({ summary: 'Aktive Monteure (für Zuweisungs-Auswahl)' })
  listWorkers() {
    return this.equipment.listWorkers();
  }

  @Get('meta/categories')
  @ApiOperation({ summary: 'Vorhandene Kategorien' })
  listCategories() {
    return this.equipment.listCategories();
  }

  @Get('worker/:workerId')
  @ApiOperation({ summary: 'Aktuelle Geräte eines Monteurs' })
  getWorkerEquipment(@Param('workerId') workerId: string) {
    return this.equipment.getWorkerEquipment(workerId);
  }

  // ── CRUD ──────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Geräte auflisten (Filter, Suche, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.equipment.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      category,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Geräte-Detail mit Zuweisungen' })
  findOne(@Param('id') id: string) {
    return this.equipment.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Gerät anlegen' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipment.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Gerät bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipment.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Gerät löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.equipment.remove(id);
  }

  // ── Bild ──────────────────────────────────────────────────────

  @Post(':id/image')
  @ApiOperation({ summary: 'Gerätebild hochladen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.equipment.uploadImage(id, file);
  }

  @Get(':id/image')
  @ApiOperation({ summary: 'Gerätebild abrufen (Stream)' })
  async getImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.equipment.getImage(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }

  // ── Zuweisungen ───────────────────────────────────────────────

  @Post(':id/assign')
  @ApiOperation({ summary: 'Gerät an Monteur ausgeben' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignEquipmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.assign(id, dto, user?.id);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Rückgabe registrieren' })
  returnEquipment(
    @Param('id') id: string,
    @Body() dto: ReturnEquipmentDto,
  ) {
    return this.equipment.returnEquipment(id, dto);
  }

}
