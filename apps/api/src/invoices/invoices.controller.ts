import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { GenerateFromTimesheetsDto } from './dto/generate-from-timesheets.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { ReorderLinesDto } from './dto/reorder-lines.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Hilfsfunktion: AuthUser → userId (nur echte Benutzer, keine Worker). */
function userIdOf(user: AuthUser): string | null {
  return user.type === 'user' ? user.id : null;
}

/**
 * Controller für die Rechnungsverwaltung.
 * Stellt Endpunkte für CRUD, Status-Workflow, Positionsverwaltung,
 * Zahlungserfassung und PDF-Export bereit.
 */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Kennzahlen: offene/überfällige Beträge, Umsatz' })
  stats() {
    return this.invoices.stats();
  }

  @Post('generate-from-timesheets')
  @ApiOperation({ summary: 'Rechnung aus genehmigten Stundenzetteln generieren' })
  generateFromTimesheets(
    @Body() dto: GenerateFromTimesheetsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.generateFromTimesheets(dto, userIdOf(user));
  }

  // ── Rechnung CRUD ────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Rechnungen auflisten (Filter, Pagination, Sort)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('customerId') customerId?: string,
    @Query('subcontractorId') subcontractorId?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.invoices.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      type,
      status,
      projectId,
      customerId,
      subcontractorId,
      periodFrom,
      periodTo,
      sortBy,
      sortDir,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Rechnungsdetail (Positionen + Zahlungen)' })
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Rechnung anlegen (manuell)' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoices.create(dto, userIdOf(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rechnung bearbeiten (nur DRAFT)' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Rechnung löschen (nur DRAFT)' })
  remove(@Param('id') id: string) {
    return this.invoices.remove(id);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechnung versenden (Status SENT, Fälligkeit setzen)' })
  send(@Param('id') id: string) {
    return this.invoices.send(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechnung stornieren (Status CANCELLED, Beträge 0)' })
  cancel(@Param('id') id: string) {
    return this.invoices.cancel(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Rechnung als neuen Entwurf duplizieren' })
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.duplicate(id, userIdOf(user));
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Rechnung als PDF erzeugen/herunterladen' })
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

  // ── Positionen ───────────────────────────────────────────────

  @Get(':id/lines')
  @ApiOperation({ summary: 'Positionen einer Rechnung' })
  findLines(@Param('id') id: string) {
    return this.invoices.findLines(id);
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Position hinzufügen (nur DRAFT)' })
  addLine(@Param('id') id: string, @Body() dto: CreateInvoiceLineDto) {
    return this.invoices.addLine(id, dto);
  }

  @Post(':id/lines/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Positionen neu sortieren (nur DRAFT)' })
  reorderLines(@Param('id') id: string, @Body() dto: ReorderLinesDto) {
    return this.invoices.reorderLines(id, dto.lineIds);
  }

  @Patch(':id/lines/:lineId')
  @ApiOperation({ summary: 'Position bearbeiten (nur DRAFT)' })
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
  ) {
    return this.invoices.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @ApiOperation({ summary: 'Position entfernen (nur DRAFT)' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.invoices.removeLine(id, lineId);
  }

  // ── Zahlungen ────────────────────────────────────────────────

  @Get(':id/payments')
  @ApiOperation({ summary: 'Zahlungseingänge einer Rechnung' })
  findPayments(@Param('id') id: string) {
    return this.invoices.findPayments(id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Zahlung erfassen (Status-Auto-Update)' })
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.invoices.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Zahlung löschen (Status-Auto-Update)' })
  removePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.invoices.removePayment(id, paymentId);
  }
}
