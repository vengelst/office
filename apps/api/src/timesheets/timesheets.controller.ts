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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimesheetsService } from './timesheets.service';
import { TimesheetPdfService } from './pdf.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(
    private readonly timesheets: TimesheetsService,
    private readonly pdf: TimesheetPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Stundenzettel auflisten (Filter, Pagination)' })
  findAll(
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
    return this.timesheets.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      workerId,
      projectId,
      weekYear: weekYear ? Number(weekYear) : undefined,
      weekNumber: weekNumber ? Number(weekNumber) : undefined,
      status,
      sortBy,
      sortDir,
    });
  }

  @Post('generate')
  @ApiOperation({ summary: 'Stundenzettel aus Stempel-Einträgen generieren' })
  generate(@Body() dto: GenerateTimesheetDto) {
    return this.timesheets.generate(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Stundenzettel-Detail (Tage + Unterschriften)' })
  findOne(@Param('id') id: string) {
    return this.timesheets.findOne(id);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel genehmigen' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.approve(id, user.type === 'user' ? user.id : null);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unterschrift hinzufügen (Base64-PNG)' })
  sign(
    @Param('id') id: string,
    @Body() dto: SignTimesheetDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.timesheets.sign(id, dto, {
      ipAddress: ip,
      deviceInfo: userAgent,
    });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Stundenzettel als PDF exportieren' })
  async exportPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
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
