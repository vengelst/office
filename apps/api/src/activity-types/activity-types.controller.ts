/**
 * CRUD für Master-Tätigkeitsbereiche (ActivityType).
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActivityTypesService } from './activity-types.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';

@ApiTags('activity-types')
@ApiBearerAuth()
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly activityTypes: ActivityTypesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    RoleCode.SUPERADMIN,
    RoleCode.OFFICE,
    RoleCode.PROJECT_MANAGER,
    RoleCode.WORKER,
  )
  @ApiOperation({ summary: 'Tätigkeitsbereiche auflisten' })
  findAll(@Query('active') active?: string) {
    return this.activityTypes.findAll(
      active === 'true' ? true : active === 'false' ? false : undefined,
    );
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Einzelner Tätigkeitsbereich' })
  findOne(@Param('id') id: string) {
    return this.activityTypes.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({ summary: 'Tätigkeitsbereich anlegen' })
  create(@Body() dto: CreateActivityTypeDto) {
    return this.activityTypes.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({ summary: 'Tätigkeitsbereich bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityTypeDto) {
    return this.activityTypes.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({ summary: 'Tätigkeitsbereich deaktivieren' })
  remove(@Param('id') id: string) {
    return this.activityTypes.remove(id);
  }
}
