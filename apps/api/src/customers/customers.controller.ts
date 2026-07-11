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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

/**
 * Controller für die Kundenverwaltung.
 * Stellt CRUD-Endpunkte für Kunden, deren Niederlassungen,
 * Ansprechpartner, E-Mail-Adressen und Bankverbindungen bereit.
 */
@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // ── Customer ─────────────────────────────────────────────────

  /**
   * Gibt eine paginierte, durchsuchbare und sortierbare Liste aller Kunden zurück.
   * GET /api/customers
   *
   * @param page - Seitennummer (ab 1)
   * @param limit - Einträge pro Seite (max. 100)
   * @param search - Freitextsuche über Firmenname und Kundennummer
   * @param sortBy - Spalte zum Sortieren
   * @param sortDir - Sortierrichtung (asc/desc)
   * @returns Paginierte Kundenliste mit Metadaten
   */
  @Get()
  @ApiOperation({ summary: 'Kunden auflisten (Paginierung, Suche, Sortierung)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.customers.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      sortBy,
      sortDir,
    });
  }

  /**
   * Liefert einen einzelnen Kunden mit allen verknüpften Daten.
   * GET /api/customers/:id
   *
   * @param id - UUID des Kunden
   * @returns Kunde mit Niederlassungen, Ansprechpartnern, E-Mails und Bankverbindungen
   */
  @Get(':id')
  @ApiOperation({ summary: 'Einzelkunde mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  /**
   * Erstellt einen neuen Kunden in der Datenbank.
   * Generiert automatisch eine fortlaufende Kundennummer (K-YYYY-NNNN).
   * POST /api/customers
   *
   * @param dto - Kundendaten (Firmenname, Adresse, etc.)
   * @returns Der erstellte Kunde mit allen Relationen
   */
  @Post()
  @ApiOperation({ summary: 'Kunde anlegen' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Kunden (Partial Update).
   * PATCH /api/customers/:id
   *
   * @param id - UUID des Kunden
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Kunde
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Kunde bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  /**
   * Markiert einen Kunden als gelöscht (Soft-Delete via deletedAt).
   * DELETE /api/customers/:id
   *
   * @param id - UUID des Kunden
   * @returns Bestätigung der Löschung
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Kunde löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  // ── Branches ─────────────────────────────────────────────────

  /**
   * Listet alle Niederlassungen eines Kunden auf.
   * GET /api/customers/:customerId/branches
   *
   * @param customerId - UUID des Kunden
   * @returns Array der Niederlassungen
   */
  @Get(':customerId/branches')
  @ApiOperation({ summary: 'Niederlassungen eines Kunden' })
  findBranches(@Param('customerId') customerId: string) {
    return this.customers.findBranches(customerId);
  }

  /**
   * Erstellt eine neue Niederlassung für einen Kunden.
   * POST /api/customers/:customerId/branches
   *
   * @param customerId - UUID des Kunden
   * @param dto - Niederlassungsdaten (Name, Adresse)
   * @returns Die erstellte Niederlassung
   */
  @Post(':customerId/branches')
  @ApiOperation({ summary: 'Niederlassung anlegen' })
  createBranch(
    @Param('customerId') customerId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.customers.createBranch(customerId, dto);
  }

  /**
   * Aktualisiert eine bestehende Niederlassung.
   * PATCH /api/customers/:customerId/branches/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der Niederlassung
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Niederlassung
   */
  @Patch(':customerId/branches/:id')
  @ApiOperation({ summary: 'Niederlassung bearbeiten' })
  updateBranch(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.customers.updateBranch(customerId, id, dto);
  }

  /**
   * Löscht eine Niederlassung.
   * DELETE /api/customers/:customerId/branches/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der Niederlassung
   * @returns Bestätigung der Löschung
   */
  @Delete(':customerId/branches/:id')
  @ApiOperation({ summary: 'Niederlassung löschen' })
  removeBranch(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeBranch(customerId, id);
  }

  // ── Contacts ─────────────────────────────────────────────────

  /**
   * Listet alle Ansprechpartner eines Kunden auf.
   * GET /api/customers/:customerId/contacts
   *
   * @param customerId - UUID des Kunden
   * @returns Array der Ansprechpartner
   */
  @Get(':customerId/contacts')
  @ApiOperation({ summary: 'Ansprechpartner eines Kunden' })
  findContacts(@Param('customerId') customerId: string) {
    return this.customers.findContacts(customerId);
  }

  /**
   * Erstellt einen neuen Ansprechpartner für einen Kunden.
   * POST /api/customers/:customerId/contacts
   *
   * @param customerId - UUID des Kunden
   * @param dto - Kontaktdaten (Vor-/Nachname, Telefon, Position)
   * @returns Der erstellte Ansprechpartner
   */
  @Post(':customerId/contacts')
  @ApiOperation({ summary: 'Ansprechpartner anlegen' })
  createContact(
    @Param('customerId') customerId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.customers.createContact(customerId, dto);
  }

  /**
   * Aktualisiert einen bestehenden Ansprechpartner.
   * PATCH /api/customers/:customerId/contacts/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID des Ansprechpartners
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Ansprechpartner
   */
  @Patch(':customerId/contacts/:id')
  @ApiOperation({ summary: 'Ansprechpartner bearbeiten' })
  updateContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.customers.updateContact(customerId, id, dto);
  }

  /**
   * Löscht einen Ansprechpartner.
   * DELETE /api/customers/:customerId/contacts/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID des Ansprechpartners
   * @returns Bestätigung der Löschung
   */
  @Delete(':customerId/contacts/:id')
  @ApiOperation({ summary: 'Ansprechpartner löschen' })
  removeContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeContact(customerId, id);
  }

  // ── E-Mails ──────────────────────────────────────────────────

  /**
   * Listet alle E-Mail-Adressen eines Kunden auf.
   * GET /api/customers/:customerId/emails
   *
   * @param customerId - UUID des Kunden
   * @returns Array der E-Mail-Adressen
   */
  @Get(':customerId/emails')
  @ApiOperation({ summary: 'E-Mail-Adressen eines Kunden' })
  findEmails(@Param('customerId') customerId: string) {
    return this.customers.findEmails(customerId);
  }

  /**
   * Fügt eine E-Mail-Adresse zu einem Kunden hinzu.
   * POST /api/customers/:customerId/emails
   *
   * @param customerId - UUID des Kunden
   * @param dto - E-Mail-Daten (Adresse, Typ)
   * @returns Die erstellte E-Mail-Adresse
   */
  @Post(':customerId/emails')
  @ApiOperation({ summary: 'E-Mail-Adresse hinzufügen' })
  createEmail(
    @Param('customerId') customerId: string,
    @Body() dto: CreateEmailDto,
  ) {
    return this.customers.createEmail(customerId, dto);
  }

  /**
   * Aktualisiert eine E-Mail-Adresse.
   * PATCH /api/customers/:customerId/emails/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der E-Mail-Adresse
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte E-Mail-Adresse
   */
  @Patch(':customerId/emails/:id')
  @ApiOperation({ summary: 'E-Mail-Adresse bearbeiten' })
  updateEmail(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailDto,
  ) {
    return this.customers.updateEmail(customerId, id, dto);
  }

  /**
   * Löscht eine E-Mail-Adresse.
   * DELETE /api/customers/:customerId/emails/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der E-Mail-Adresse
   * @returns Bestätigung der Löschung
   */
  @Delete(':customerId/emails/:id')
  @ApiOperation({ summary: 'E-Mail-Adresse löschen' })
  removeEmail(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeEmail(customerId, id);
  }

  // ── Bankverbindungen ─────────────────────────────────────────

  /**
   * Listet alle Bankverbindungen eines Kunden auf.
   * GET /api/customers/:customerId/bank-accounts
   *
   * @param customerId - UUID des Kunden
   * @returns Array der Bankverbindungen
   */
  @Get(':customerId/bank-accounts')
  @ApiOperation({ summary: 'Bankverbindungen eines Kunden' })
  findBankAccounts(@Param('customerId') customerId: string) {
    return this.customers.findBankAccounts(customerId);
  }

  /**
   * Erstellt eine neue Bankverbindung für einen Kunden (max. 2 erlaubt).
   * POST /api/customers/:customerId/bank-accounts
   *
   * @param customerId - UUID des Kunden
   * @param dto - Bankdaten (IBAN, BIC, Bankname)
   * @returns Die erstellte Bankverbindung
   */
  @Post(':customerId/bank-accounts')
  @ApiOperation({ summary: 'Bankverbindung anlegen (max. 2)' })
  createBankAccount(
    @Param('customerId') customerId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.customers.createBankAccount(customerId, dto);
  }

  /**
   * Aktualisiert eine Bankverbindung.
   * PATCH /api/customers/:customerId/bank-accounts/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der Bankverbindung
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Bankverbindung
   */
  @Patch(':customerId/bank-accounts/:id')
  @ApiOperation({ summary: 'Bankverbindung bearbeiten' })
  updateBankAccount(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.customers.updateBankAccount(customerId, id, dto);
  }

  /**
   * Löscht eine Bankverbindung.
   * DELETE /api/customers/:customerId/bank-accounts/:id
   *
   * @param customerId - UUID des Kunden
   * @param id - UUID der Bankverbindung
   * @returns Bestätigung der Löschung
   */
  @Delete(':customerId/bank-accounts/:id')
  @ApiOperation({ summary: 'Bankverbindung löschen' })
  removeBankAccount(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeBankAccount(customerId, id);
  }
}
