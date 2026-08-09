import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubcontractorsService } from './subcontractors.service';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { CreateSubcontractorContactDto } from './dto/create-subcontractor-contact.dto';
import { UpdateSubcontractorContactDto } from './dto/update-subcontractor-contact.dto';

@ApiTags('subcontractors')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('subcontractors')
export class SubcontractorsController {
  constructor(private readonly subcontractors: SubcontractorsService) {}

  @Get()
  @ApiOperation({ summary: 'Subunternehmen auflisten (Suche, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.subcontractors.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      active:
        active === undefined ? undefined : active === 'true' || active === '1',
      sortBy,
      sortDir,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Subunternehmen-Detail mit Monteuren und Kontakten' })
  findOne(@Param('id') id: string) {
    return this.subcontractors.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Subunternehmen anlegen' })
  create(@Body() dto: CreateSubcontractorDto) {
    return this.subcontractors.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Subunternehmen bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateSubcontractorDto) {
    return this.subcontractors.update(id, dto);
  }


  @Post('bulk-delete')
  @ApiOperation({ summary: 'Mehrfach löschen' })
  bulkRemove(@Body() dto: BulkDeleteDto) {
    return this.subcontractors.bulkRemove(dto.ids);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Subunternehmen löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.subcontractors.remove(id);
  }

  // ── Kontakte ─────────────────────────────────────────────────

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Kontakte eines Subunternehmens auflisten' })
  listContacts(@Param('id') id: string) {
    return this.subcontractors.listContacts(id);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Kontakt anlegen' })
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateSubcontractorContactDto,
  ) {
    return this.subcontractors.createContact(id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Kontakt bearbeiten' })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSubcontractorContactDto,
  ) {
    return this.subcontractors.updateContact(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Kontakt löschen' })
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.subcontractors.removeContact(id, contactId);
  }
}
