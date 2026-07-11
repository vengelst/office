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
  @ApiOperation({ summary: 'Kommunikationseinträge auflisten' })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('contactId') contactId?: string,
    @Query('type') type?: string,
  ) {
    return this.communication.findAll({ entityType, entityId, contactId, type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag Detail' })
  findOne(@Param('id') id: string) {
    return this.communication.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kommunikationseintrag anlegen' })
  create(@Body() dto: CreateCommunicationDto) {
    return this.communication.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateCommunicationDto) {
    return this.communication.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag löschen' })
  remove(@Param('id') id: string) {
    return this.communication.remove(id);
  }
}
