import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TimesheetsService } from './timesheets.service';
import { TimesheetPdfService } from './pdf.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';

/**
 * Controller für die Stundenzettel-Verwaltung.
 * Stellt Endpunkte für Generierung, Workflow (Einreichen, Genehmigen, Zurückweisen),
 * Tageskorrektur, Unterschriften und PDF-Export bereit.
 *
 * Der Kunden-PL (`CUSTOMER_PL`) ist bewusst nur für die lesenden Endpunkte und
 * das Abzeichnen (`approve`) freigeschaltet – und dort zusätzlich auf seine
 * zugewiesenen Projekte beschränkt (SPEZ-arbeitsitems.md 4.2/8.1).
 * Generieren, Korrigieren, Einreichen, Zurückweisen, Archivieren und
 * Unterschreiben bleiben den internen Rollen vorbehalten.
 */
@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER')
@Controller('timesheets')
export class TimesheetsController {
  constructor(
    private readonly timesheets: TimesheetsService,
    private readonly pdf: TimesheetPdfService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({
    summary:
      'Stundenzettel auflisten (Filter, Pagination); Kunden-PL nur eigene Projekte',
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workerId') workerId?: string,
    @Query('projectId') projectId?: string,
    @Query('weekYear') weekYear?: string,
    @Query('weekNumber') weekNumber?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.timesheets.findAll(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        workerId,
        projectId,
        weekYear: weekYear ? Number(weekYear) : undefined,
        weekNumber: weekNumber ? Number(weekNumber) : undefined,
        status,
        sortBy,
        sortDir,
      },
      user,
    );
  }

  @Post('generate')
  @ApiOperation({ summary: 'Stundenzettel aus Stempel-Einträgen generieren' })
  generate(@Body() dto: GenerateTimesheetDto) {
    return this.timesheets.generate(dto);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({ summary: 'Stundenzettel-Detail (Tage + Unterschriften)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.findOneForUser(id, user);
  }

  @Patch(':id/days/:dayId')
  @ApiOperation({ summary: 'Tageseintrag korrigieren' })
  updateDay(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateDayDto,
  ) {
    return this.timesheets.updateDay(id, dayId, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel einreichen' })
  submit(@Param('id') id: string) {
    return this.timesheets.submit(id);
  }

  @Post(':id/approve')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stundenzettel genehmigen / abzeichnen (Kunden-PL: eigene Projekte)',
  })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.approveForUser(id, user);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel archivieren (nur bei APPROVED)' })
  archive(@Param('id') id: string) {
    return this.timesheets.archive(id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel zurückweisen (mit Grund)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTimesheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timesheets.reject(
      id,
      dto.reason,
      user.type === 'user' ? user.id : null,
    );
  }

  @Post(':id/sign')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Digitale Unterschrift (Base64-PNG); Kunden-PL nur Typ CUSTOMER auf eigenen Projekten',
  })
  sign(
    @Param('id') id: string,
    @Body() dto: SignTimesheetDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.timesheets.signForUser(id, dto, user, {
      ipAddress: ip,
      deviceInfo: userAgent,
    });
  }

  @Get(':id/pdf')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({ summary: 'Stundenzettel als PDF exportieren' })
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.timesheets.findOneForUser(id, user);
    const { buffer, filename } = await this.pdf.generate(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        filename,
      )}"`,
    });
    return new StreamableFile(buffer);
  }
}
