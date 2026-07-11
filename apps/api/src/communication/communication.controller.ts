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
import {
  CommunicationEntityType,
  CommunicationType,
  RoleCode,
} from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommunicationService } from './communication.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

@ApiTags('communication')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communication: CommunicationService) {}

  @Get()
  @ApiOperation({ summary: 'Kommunikationseinträge auflisten (Paginierung, Filter)' })
  findAll(
    @Query('entityType') entityType?: CommunicationEntityType,
    @Query('entityId') entityId?: string,
    @Query('contactId') contactId?: string,
    @Query('type') type?: CommunicationType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communication.list({
      entityType,
      entityId,
      contactId,
      type,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Kommunikationseintrag laden' })
  findOne(@Param('id') id: string) {
    return this.communication.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kommunikationseintrag erstellen' })
  create(@Body() dto: CreateCommunicationDto) {
    return this.communication.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateCommunicationDto) {
    return this.communication.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag löschen' })
  remove(@Param('id') id: string) {
    return this.communication.remove(id);
  }
}
