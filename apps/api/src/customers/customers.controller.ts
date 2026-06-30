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

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // ── Customer ─────────────────────────────────────────────────

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

  @Get(':id')
  @ApiOperation({ summary: 'Einzelkunde mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kunde anlegen' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kunde bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kunde löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  // ── Branches ─────────────────────────────────────────────────

  @Get(':customerId/branches')
  @ApiOperation({ summary: 'Niederlassungen eines Kunden' })
  findBranches(@Param('customerId') customerId: string) {
    return this.customers.findBranches(customerId);
  }

  @Post(':customerId/branches')
  @ApiOperation({ summary: 'Niederlassung anlegen' })
  createBranch(
    @Param('customerId') customerId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.customers.createBranch(customerId, dto);
  }

  @Patch(':customerId/branches/:id')
  @ApiOperation({ summary: 'Niederlassung bearbeiten' })
  updateBranch(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.customers.updateBranch(customerId, id, dto);
  }

  @Delete(':customerId/branches/:id')
  @ApiOperation({ summary: 'Niederlassung löschen' })
  removeBranch(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeBranch(customerId, id);
  }

  // ── Contacts ─────────────────────────────────────────────────

  @Get(':customerId/contacts')
  @ApiOperation({ summary: 'Ansprechpartner eines Kunden' })
  findContacts(@Param('customerId') customerId: string) {
    return this.customers.findContacts(customerId);
  }

  @Post(':customerId/contacts')
  @ApiOperation({ summary: 'Ansprechpartner anlegen' })
  createContact(
    @Param('customerId') customerId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.customers.createContact(customerId, dto);
  }

  @Patch(':customerId/contacts/:id')
  @ApiOperation({ summary: 'Ansprechpartner bearbeiten' })
  updateContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.customers.updateContact(customerId, id, dto);
  }

  @Delete(':customerId/contacts/:id')
  @ApiOperation({ summary: 'Ansprechpartner löschen' })
  removeContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeContact(customerId, id);
  }

  // ── E-Mails ──────────────────────────────────────────────────

  @Get(':customerId/emails')
  @ApiOperation({ summary: 'E-Mail-Adressen eines Kunden' })
  findEmails(@Param('customerId') customerId: string) {
    return this.customers.findEmails(customerId);
  }

  @Post(':customerId/emails')
  @ApiOperation({ summary: 'E-Mail-Adresse hinzufügen' })
  createEmail(
    @Param('customerId') customerId: string,
    @Body() dto: CreateEmailDto,
  ) {
    return this.customers.createEmail(customerId, dto);
  }

  @Patch(':customerId/emails/:id')
  @ApiOperation({ summary: 'E-Mail-Adresse bearbeiten' })
  updateEmail(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailDto,
  ) {
    return this.customers.updateEmail(customerId, id, dto);
  }

  @Delete(':customerId/emails/:id')
  @ApiOperation({ summary: 'E-Mail-Adresse löschen' })
  removeEmail(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeEmail(customerId, id);
  }

  // ── Bankverbindungen ─────────────────────────────────────────

  @Get(':customerId/bank-accounts')
  @ApiOperation({ summary: 'Bankverbindungen eines Kunden' })
  findBankAccounts(@Param('customerId') customerId: string) {
    return this.customers.findBankAccounts(customerId);
  }

  @Post(':customerId/bank-accounts')
  @ApiOperation({ summary: 'Bankverbindung anlegen (max. 2)' })
  createBankAccount(
    @Param('customerId') customerId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.customers.createBankAccount(customerId, dto);
  }

  @Patch(':customerId/bank-accounts/:id')
  @ApiOperation({ summary: 'Bankverbindung bearbeiten' })
  updateBankAccount(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.customers.updateBankAccount(customerId, id, dto);
  }

  @Delete(':customerId/bank-accounts/:id')
  @ApiOperation({ summary: 'Bankverbindung löschen' })
  removeBankAccount(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.customers.removeBankAccount(customerId, id);
  }
}
