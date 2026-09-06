/**
 * HTTP-API für Invoices.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

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
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
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
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';

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
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('invoices')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  /**
   * Liefert aggregierte Statistiken.
   *
   * @returns Statistik
   */

  @Get('stats')
  @ApiOperation({ summary: 'Kennzahlen: offene/überfällige Beträge, Umsatz' })
  stats() {
    return this.invoices.stats();
  }

  @Get('skonto')
  @ApiOperation({ summary: 'Skonto-Auswertung: Zahlungen mit Skonto' })
  listSkonto(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.invoices.listSkontoPayments({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      periodFrom,
      periodTo,
      customerId,
    });
  }

  /**
   * Erzeugt Rechnungen aus Stundenzetteln.
   *
   * @param dto - Request-Body / Eingabedaten (GenerateFromTimesheetsDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Erzeugte Rechnungen
   */

  @Post('generate-from-timesheets')
  @ApiOperation({ summary: 'Rechnung aus genehmigten Stundenzetteln generieren' })
  generateFromTimesheets(
    @Body() dto: GenerateFromTimesheetsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.generateFromTimesheets(dto, userIdOf(user));
  }

  // ── Rechnung CRUD ────────────────────────────────────────────

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param type - Parameter `type` (string)
   * @param status - Zielstatus (string)
   * @param projectId - ID des Projekts (string)
   * @param customerId - ID des Kunden (string)
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param periodFrom - Parameter `periodFrom` (string)
   * @param periodTo - Eingabe-DTO (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */

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

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Rechnungsdetail (Positionen + Zahlungen)' })
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateInvoiceDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Neue Rechnung anlegen (manuell)' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoices.create(dto, userIdOf(user));
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateInvoiceDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Rechnung bearbeiten (nur DRAFT)' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Rechnung löschen (nur DRAFT)' })
  remove(@Param('id') id: string) {
    return this.invoices.remove(id);
  }

  /**
   * Finalisiert die Rechnung (Nummernvergabe, Status SENT).
   */
  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPERADMIN)
  @ApiOperation({
    summary: 'Rechnung finalisieren (SUPERADMIN, vergibt RE-Nummer)',
  })
  finalize(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.finalize(id, userIdOf(user));
  }

  /**
   * Alias: früher „Versenden“ – gleiches Verhalten wie Finalisieren.
   */
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPERADMIN)
  @ApiOperation({
    summary: 'Alias für Finalisieren (Legacy)',
    deprecated: true,
  })
  send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.finalize(id, userIdOf(user));
  }

  /**
   * Storno finalisierter RE über Gutschrift.
   */
  @Post(':id/credit-note')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPERADMIN)
  @ApiOperation({
    summary: 'Storno → Gutschrift (SUPERADMIN, vergibt GS-Nummer)',
  })
  creditNote(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.createCreditNote(id, userIdOf(user));
  }

  /**
   * Storniert einen Entwurf (ohne Gutschrift).
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Entwurf stornieren (finalisierte RE → credit-note nutzen)',
  })
  cancel(@Param('id') id: string) {
    return this.invoices.cancel(id);
  }

  /**
   * Dupliziert die Rechnung inkl. Positionen.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   */

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Rechnung als neuen Entwurf duplizieren' })
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.duplicate(id, userIdOf(user));
  }

  @Get(':id/email-attachments')
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({
    summary: 'E-Mail-Anhang-Vorschläge (Kundendokumente + Stundenzettel)',
  })
  emailAttachments(@Param('id') id: string) {
    return this.invoices.getEmailAttachmentOptions(id);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({
    summary: 'Finalisierte RE/GS per E-Mail an Billing-Adresse senden',
  })
  sendEmail(@Param('id') id: string, @Body() dto: SendInvoiceEmailDto) {
    return this.invoices.sendEmail(id, dto);
  }

  /**
   * Erzeugt bzw. liefert das PDF-Dokument.
   */

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

  /**
   * Listet Rechnungspositionen.
   *
   * @param id - Primärschlüssel der Entität (string)
   */

  @Get(':id/lines')
  @ApiOperation({ summary: 'Positionen einer Rechnung' })
  findLines(@Param('id') id: string) {
    return this.invoices.findLines(id);
  }

  /**
   * Fügt eine Rechnungsposition hinzu.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreateInvoiceLineDto)
   */

  @Post(':id/lines')
  @ApiOperation({ summary: 'Position hinzufügen (nur DRAFT)' })
  addLine(@Param('id') id: string, @Body() dto: CreateInvoiceLineDto) {
    return this.invoices.addLine(id, dto);
  }

  /**
   * Ändert die Reihenfolge der Positionen.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (ReorderLinesDto)
   */

  @Post(':id/lines/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Positionen neu sortieren (nur DRAFT)' })
  reorderLines(@Param('id') id: string, @Body() dto: ReorderLinesDto) {
    return this.invoices.reorderLines(id, dto.lineIds);
  }

  /**
   * Aktualisiert eine Rechnungsposition.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param lineId - ID (lineId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateInvoiceLineDto)
   */

  @Patch(':id/lines/:lineId')
  @ApiOperation({ summary: 'Position bearbeiten (nur DRAFT)' })
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
  ) {
    return this.invoices.updateLine(id, lineId, dto);
  }

  /**
   * Entfernt eine Rechnungsposition.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param lineId - ID (lineId) (string)
   */

  @Delete(':id/lines/:lineId')
  @ApiOperation({ summary: 'Position entfernen (nur DRAFT)' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.invoices.removeLine(id, lineId);
  }

  // ── Zahlungen ────────────────────────────────────────────────

  /**
   * Listet Zahlungseingänge der Rechnung.
   *
   * @param id - Primärschlüssel der Entität (string)
   */

  @Get(':id/payments')
  @ApiOperation({ summary: 'Zahlungseingänge einer Rechnung' })
  findPayments(@Param('id') id: string) {
    return this.invoices.findPayments(id);
  }

  /**
   * Erfasst einen Zahlungseingang.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreatePaymentDto)
   */

  @Post(':id/payments')
  @ApiOperation({ summary: 'Zahlung erfassen (Status-Auto-Update)' })
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.invoices.addPayment(id, dto);
  }

  /**
   * Entfernt einen Zahlungseingang.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param paymentId - ID (paymentId) (string)
   */

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Zahlung löschen (Status-Auto-Update)' })
  removePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.invoices.removePayment(id, paymentId);
  }
}
