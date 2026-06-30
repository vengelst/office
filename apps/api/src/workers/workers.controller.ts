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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WorkersService, MAX_PHOTO_SIZE } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@ApiTags('workers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  @Get('expiring-documents')
  @ApiOperation({
    summary: 'Monteure mit ablaufenden Reisedokumenten (< 30 Tage)',
  })
  expiringDocuments() {
    return this.workers.expiringDocuments();
  }

  // ── Monteur CRUD ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Monteure auflisten (Suche, Filter, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('availability') availability?: string,
    @Query('subcontractorId') subcontractorId?: string,
    @Query('teamId') teamId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.workers.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      type,
      availability,
      subcontractorId,
      teamId,
      sortBy,
      sortDir,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Monteur-Detail mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.workers.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Monteur anlegen (Nummer automatisch W-YYYY-NNNN)' })
  create(@Body() dto: CreateWorkerDto) {
    return this.workers.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Monteur bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.workers.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Monteur löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.workers.remove(id);
  }

  // ── Profilbild ───────────────────────────────────────────────

  @Post(':id/photo')
  @ApiOperation({ summary: 'Profilbild hochladen (JPEG/PNG, max. 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE } }),
  )
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.workers.uploadPhoto(id, file);
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Profilbild abrufen (Stream)' })
  async getPhoto(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.workers.getPhoto(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }

  // ── Sprachkenntnisse ─────────────────────────────────────────

  @Get(':id/languages')
  findLanguages(@Param('id') id: string) {
    return this.workers.findLanguages(id);
  }

  @Post(':id/languages')
  createLanguage(@Param('id') id: string, @Body() dto: CreateLanguageDto) {
    return this.workers.createLanguage(id, dto);
  }

  @Patch(':id/languages/:langId')
  updateLanguage(
    @Param('id') id: string,
    @Param('langId') langId: string,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.workers.updateLanguage(id, langId, dto);
  }

  @Delete(':id/languages/:langId')
  removeLanguage(@Param('id') id: string, @Param('langId') langId: string) {
    return this.workers.removeLanguage(id, langId);
  }

  // ── Zertifikate ──────────────────────────────────────────────

  @Get(':id/certifications')
  findCertifications(@Param('id') id: string) {
    return this.workers.findCertifications(id);
  }

  @Post(':id/certifications')
  createCertification(
    @Param('id') id: string,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.workers.createCertification(id, dto);
  }

  @Patch(':id/certifications/:certId')
  updateCertification(
    @Param('id') id: string,
    @Param('certId') certId: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    return this.workers.updateCertification(id, certId, dto);
  }

  @Delete(':id/certifications/:certId')
  removeCertification(
    @Param('id') id: string,
    @Param('certId') certId: string,
  ) {
    return this.workers.removeCertification(id, certId);
  }

  // ── PIN-Verwaltung ────────────────────────────────────────────

  @Post(':id/pin')
  @ApiOperation({ summary: 'PIN für Monteur setzen (6 Ziffern)' })
  setPin(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.workers.setPin(id, body.pin);
  }

  @Post(':id/send-pin-email')
  @ApiOperation({ summary: 'PIN setzen und per E-Mail an Monteur senden' })
  sendPinEmail(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.workers.sendPinEmail(id, body.pin);
  }
}
