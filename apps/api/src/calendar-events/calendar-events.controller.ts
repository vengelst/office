/**
 * HTTP-API für Office-Termine (Calendar Events).
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
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@ApiTags('calendar-events')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('calendar')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEvents: CalendarEventsService) {}

  @Get()
  @ApiOperation({ summary: 'Termine auflisten (Filter: from/to/projectId)' })
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.calendarEvents.list({
      from,
      to,
      projectId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Termin laden' })
  findOne(@Param('id') id: string) {
    return this.calendarEvents.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Termin erstellen (+ optional Google Sync)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarEvents.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Termin aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.calendarEvents.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Termin löschen' })
  remove(@Param('id') id: string) {
    return this.calendarEvents.remove(id);
  }
}
