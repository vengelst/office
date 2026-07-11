import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleContactsService } from '../google-drive/google-contacts.service';
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

const MAX_BANK_ACCOUNTS = 2;

/** Sortierbare Spalten der Kundenliste. */
const SORTABLE_FIELDS = [
  'companyName',
  'customerNumber',
  'city',
  'rating',
  'createdAt',
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Schlanke Projektion für die Listenansicht. */
const listSelect = {
  id: true,
  customerNumber: true,
  companyName: true,
  city: true,
  industry: true,
  rating: true,
  status: true,
} satisfies Prisma.CustomerSelect;

/** Vollständige Projektion für die Detailansicht. */
const detailInclude = {
  branches: { orderBy: { name: 'asc' } },
  contacts: { orderBy: { lastName: 'asc' } },
  emails: { orderBy: { emailType: 'asc' } },
  bankAccounts: { orderBy: { isPrimary: 'desc' } },
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleContacts: GoogleContactsService,
  ) {}

  // ── Customer CRUD ────────────────────────────────────────────

  async findAll(params: ListCustomersParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(
      params.sortBy as SortField,
    )
      ? (params.sortBy as SortField)
      : 'companyName';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.CustomerWhereInput = { deletedAt: null };
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { customerNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: listSelect,
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    if (!customer) {
      throw new NotFoundException('Kunde nicht gefunden');
    }
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    const customerNumber = await this.generateCustomerNumber();
    return this.prisma.customer.create({
      data: { ...dto, customerNumber },
      include: detailInclude,
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureCustomer(id);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
      include: detailInclude,
    });
  }

  /** Soft-Delete: setzt deletedAt. */
  async remove(id: string) {
    await this.ensureCustomer(id);
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /** Erzeugt die nächste Kundennummer im Format K-YYYY-NNNN. */
  private async generateCustomerNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `K-${year}-`;
    const last = await this.prisma.customer.findFirst({
      where: { customerNumber: { startsWith: prefix } },
      orderBy: { customerNumber: 'desc' },
      select: { customerNumber: true },
    });
    const lastSeq = last
      ? Number.parseInt(last.customerNumber.slice(prefix.length), 10) || 0
      : 0;
    const next = (lastSeq + 1).toString().padStart(4, '0');
    return `${prefix}${next}`;
  }

  // ── Branches ─────────────────────────────────────────────────

  async findBranches(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBranch.findMany({
      where: { customerId },
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(customerId: string, dto: CreateBranchDto) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBranch.create({
      data: { ...dto, customerId },
    });
  }

  async updateBranch(customerId: string, id: string, dto: UpdateBranchDto) {
    await this.ensureBranch(customerId, id);
    return this.prisma.customerBranch.update({ where: { id }, data: dto });
  }

  async removeBranch(customerId: string, id: string) {
    await this.ensureBranch(customerId, id);
    await this.prisma.customerBranch.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Contacts ─────────────────────────────────────────────────

  async findContacts(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async createContact(customerId: string, dto: CreateContactDto) {
    await this.ensureCustomer(customerId);
    if (dto.branchId) {
      await this.ensureBranch(customerId, dto.branchId);
    }
    const contact = await this.prisma.customerContact.create({
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        customerId,
      },
      include: { customer: { select: { companyName: true } } },
    });

    this.syncContactToGoogle(contact.id, contact, contact.customer.companyName)
      .catch((err) => this.logger.warn(`Google Contacts Sync fehlgeschlagen: ${(err as Error).message}`));

    return contact;
  }

  async updateContact(customerId: string, id: string, dto: UpdateContactDto) {
    await this.ensureContact(customerId, id);
    if (dto.branchId) {
      await this.ensureBranch(customerId, dto.branchId);
    }
    const contact = await this.prisma.customerContact.update({
      where: { id },
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      },
      include: { customer: { select: { companyName: true } } },
    });

    this.syncContactToGoogle(contact.id, contact, contact.customer.companyName)
      .catch((err) => this.logger.warn(`Google Contacts Sync fehlgeschlagen: ${(err as Error).message}`));

    return contact;
  }

  async removeContact(customerId: string, id: string) {
    const contact = await this.prisma.customerContact.findUnique({
      where: { id },
      select: { googleContactId: true },
    });
    await this.ensureContact(customerId, id);
    await this.prisma.customerContact.delete({ where: { id } });

    if (contact?.googleContactId) {
      this.googleContacts.deleteContact(contact.googleContactId)
        .catch((err) => this.logger.warn(`Google Kontakt löschen fehlgeschlagen: ${(err as Error).message}`));
    }
    return { id, deleted: true };
  }

  // ── E-Mails ──────────────────────────────────────────────────

  async findEmails(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerEmail.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { emailType: 'asc' }],
    });
  }

  async createEmail(customerId: string, dto: CreateEmailDto) {
    await this.ensureCustomer(customerId);
    if (dto.isPrimary) {
      await this.prisma.customerEmail.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.customerEmail.create({ data: { ...dto, customerId } });
  }

  async updateEmail(customerId: string, id: string, dto: UpdateEmailDto) {
    await this.ensureEmail(customerId, id);
    if (dto.isPrimary) {
      await this.prisma.customerEmail.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.customerEmail.update({ where: { id }, data: dto });
  }

  async removeEmail(customerId: string, id: string) {
    await this.ensureEmail(customerId, id);
    await this.prisma.customerEmail.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Bankverbindungen ─────────────────────────────────────────

  async findBankAccounts(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBankAccount.findMany({
      where: { customerId },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async createBankAccount(customerId: string, dto: CreateBankAccountDto) {
    await this.ensureCustomer(customerId);
    const count = await this.prisma.customerBankAccount.count({
      where: { customerId },
    });
    if (count >= MAX_BANK_ACCOUNTS) {
      throw new BadRequestException(
        `Maximal ${MAX_BANK_ACCOUNTS} Bankverbindungen pro Kunde erlaubt`,
      );
    }
    if (dto.isPrimary) {
      await this.prisma.customerBankAccount.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.customerBankAccount.create({
      data: { ...dto, customerId },
    });
  }

  async updateBankAccount(
    customerId: string,
    id: string,
    dto: UpdateBankAccountDto,
  ) {
    await this.ensureBankAccount(customerId, id);
    if (dto.isPrimary) {
      await this.prisma.customerBankAccount.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.customerBankAccount.update({ where: { id }, data: dto });
  }

  async removeBankAccount(customerId: string, id: string) {
    await this.ensureBankAccount(customerId, id);
    await this.prisma.customerBankAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  private async ensureCustomer(id: string): Promise<void> {
    const count = await this.prisma.customer.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Kunde nicht gefunden');
    }
  }

  private async ensureBranch(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerBranch.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('Niederlassung nicht gefunden');
    }
  }

  private async ensureContact(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerContact.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('Ansprechpartner nicht gefunden');
    }
  }

  private async ensureEmail(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerEmail.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('E-Mail-Adresse nicht gefunden');
    }
  }

  private async ensureBankAccount(
    customerId: string,
    id: string,
  ): Promise<void> {
    const count = await this.prisma.customerBankAccount.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('Bankverbindung nicht gefunden');
    }
  }

  private async syncContactToGoogle(
    contactId: string,
    contact: {
      firstName: string;
      lastName: string;
      title?: string | null;
      email?: string | null;
      phoneMobile?: string | null;
      phoneLandline?: string | null;
      role?: string | null;
      department?: string | null;
      addressLine1?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
      notes?: string | null;
      googleContactId?: string | null;
    },
    companyName: string,
  ): Promise<void> {
    const data = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title ?? undefined,
      email: contact.email ?? undefined,
      phoneMobile: contact.phoneMobile ?? undefined,
      phoneLandline: contact.phoneLandline ?? undefined,
      role: contact.role ?? undefined,
      department: contact.department ?? undefined,
      company: companyName,
      addressLine1: contact.addressLine1 ?? undefined,
      postalCode: contact.postalCode ?? undefined,
      city: contact.city ?? undefined,
      country: contact.country ?? undefined,
      notes: contact.notes ?? undefined,
    };

    if (contact.googleContactId) {
      await this.googleContacts.updateContact(contact.googleContactId, data);
    } else {
      const resourceName = await this.googleContacts.createContact(data);
      if (resourceName) {
        await this.prisma.customerContact.update({
          where: { id: contactId },
          data: { googleContactId: resourceName },
        });
      }
    }
  }
}
