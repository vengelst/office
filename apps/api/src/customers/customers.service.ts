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

/**
 * Service für die Kundenverwaltung (CRUD).
 * Verwaltet Kunden, Niederlassungen, Ansprechpartner, E-Mails und Bankverbindungen.
 * Synchronisiert Ansprechpartner automatisch mit Google Contacts.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleContacts: GoogleContactsService,
  ) {}

  // ── Customer CRUD ────────────────────────────────────────────

  /**
   * Liefert eine paginierte, sortierbare und durchsuchbare Kundenliste.
   * Soft-gelöschte Kunden werden ausgeblendet.
   *
   * @param params - Pagination, Suchbegriff und Sortierung
   * @returns Paginiertes Ergebnis mit Kundendaten und Meta-Informationen
   */
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

  /**
   * Lädt einen einzelnen Kunden mit allen Relationen (Niederlassungen, Kontakte, E-Mails, Bankverbindungen).
   *
   * @param id - Kunden-UUID
   * @returns Vollständiger Kunde oder NotFoundException
   */
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

  /**
   * Erstellt einen neuen Kunden in der Datenbank.
   * Generiert automatisch eine fortlaufende Kundennummer (K-YYYY-NNNN).
   *
   * @param dto - Kundendaten (Firmenname, Adresse, Branche, etc.)
   * @returns Der erstellte Kunde mit allen Relationen
   */
  async create(dto: CreateCustomerDto) {
    const customerNumber = await this.generateCustomerNumber();
    return this.prisma.customer.create({
      data: { ...dto, customerNumber },
      include: detailInclude,
    });
  }

  /**
   * Aktualisiert einen bestehenden Kunden.
   *
   * @param id - Kunden-UUID
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Kunde mit allen Relationen
   */
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

  /**
   * Liefert alle Niederlassungen eines Kunden, alphabetisch sortiert.
   *
   * @param customerId - Kunden-UUID
   * @returns Liste der Niederlassungen
   */
  async findBranches(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBranch.findMany({
      where: { customerId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Legt eine neue Niederlassung für einen Kunden an.
   *
   * @param customerId - Kunden-UUID
   * @param dto - Niederlassungsdaten (Name, Adresse, etc.)
   * @returns Die erstellte Niederlassung
   */
  async createBranch(customerId: string, dto: CreateBranchDto) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBranch.create({
      data: { ...dto, customerId },
    });
  }

  /**
   * Aktualisiert eine bestehende Niederlassung.
   *
   * @param customerId - Kunden-UUID (zur Zugehörigkeitsprüfung)
   * @param id - Niederlassungs-UUID
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Niederlassung
   */
  async updateBranch(customerId: string, id: string, dto: UpdateBranchDto) {
    await this.ensureBranch(customerId, id);
    return this.prisma.customerBranch.update({ where: { id }, data: dto });
  }

  /**
   * Löscht eine Niederlassung unwiderruflich (Hard-Delete).
   *
   * @param customerId - Kunden-UUID
   * @param id - Niederlassungs-UUID
   * @returns Bestätigung mit gelöschter ID
   */
  async removeBranch(customerId: string, id: string) {
    await this.ensureBranch(customerId, id);
    await this.prisma.customerBranch.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Contacts ─────────────────────────────────────────────────

  /**
   * Liefert alle Ansprechpartner eines Kunden, alphabetisch nach Nachname sortiert.
   *
   * @param customerId - Kunden-UUID
   * @returns Liste der Ansprechpartner
   */
  async findContacts(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * Erstellt einen neuen Ansprechpartner und synchronisiert ihn asynchron nach Google Contacts.
   * Optional kann der Kontakt einer Niederlassung zugeordnet werden.
   *
   * @param customerId - Kunden-UUID
   * @param dto - Kontaktdaten (Name, Telefon, E-Mail, Niederlassung, etc.)
   * @returns Der erstellte Ansprechpartner
   */
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

    if (dto.syncToGoogle !== false) {
      this.syncContactToGoogle(contact.id, contact, contact.customer.companyName)
        .catch((err) => this.logger.warn(`Google Contacts Sync fehlgeschlagen: ${(err as Error).message}`));
    }

    return contact;
  }

  /**
   * Aktualisiert einen Ansprechpartner und synchronisiert Änderungen nach Google Contacts.
   *
   * @param customerId - Kunden-UUID
   * @param id - Kontakt-UUID
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Ansprechpartner
   */
  async updateContact(customerId: string, id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.customerContact.findUnique({
      where: { id },
      select: { syncToGoogle: true, googleContactId: true },
    });
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

    if (existing) {
      const wasSyncing = existing.syncToGoogle;
      const nowSyncing = dto.syncToGoogle ?? wasSyncing;

      if (!wasSyncing && nowSyncing && !existing.googleContactId) {
        this.syncContactToGoogle(contact.id, contact, contact.customer.companyName)
          .catch((err) => this.logger.warn(`Google Contacts Sync fehlgeschlagen: ${(err as Error).message}`));
      } else if (wasSyncing && !nowSyncing && existing.googleContactId) {
        this.googleContacts.deleteContact(existing.googleContactId)
          .then(() => this.prisma.customerContact.update({ where: { id }, data: { googleContactId: null } }))
          .catch((err) => this.logger.warn(`Google Kontakt löschen fehlgeschlagen: ${(err as Error).message}`));
      } else if (nowSyncing) {
        this.syncContactToGoogle(contact.id, contact, contact.customer.companyName)
          .catch((err) => this.logger.warn(`Google Contacts Sync fehlgeschlagen: ${(err as Error).message}`));
      }
    }

    return contact;
  }

  /**
   * Löscht einen Ansprechpartner und entfernt den zugehörigen Google-Kontakt (falls vorhanden).
   *
   * @param customerId - Kunden-UUID
   * @param id - Kontakt-UUID
   * @returns Bestätigung mit gelöschter ID
   */
  async removeContact(customerId: string, id: string) {
    const contact = await this.prisma.customerContact.findUnique({
      where: { id },
      select: { googleContactId: true, syncToGoogle: true },
    });
    await this.ensureContact(customerId, id);
    await this.prisma.customerContact.delete({ where: { id } });

    if (contact?.syncToGoogle && contact?.googleContactId) {
      this.googleContacts.deleteContact(contact.googleContactId)
        .catch((err) => this.logger.warn(`Google Kontakt löschen fehlgeschlagen: ${(err as Error).message}`));
    }
    return { id, deleted: true };
  }

  // ── E-Mails ──────────────────────────────────────────────────

  /**
   * Liefert alle E-Mail-Adressen eines Kunden, primäre zuerst.
   *
   * @param customerId - Kunden-UUID
   * @returns Liste der E-Mail-Adressen
   */
  async findEmails(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerEmail.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { emailType: 'asc' }],
    });
  }

  /**
   * Fügt eine E-Mail-Adresse zum Kunden hinzu.
   * Wird isPrimary gesetzt, werden alle bestehenden Einträge auf nicht-primär zurückgesetzt.
   *
   * @param customerId - Kunden-UUID
   * @param dto - E-Mail-Daten (Adresse, Typ, isPrimary)
   * @returns Die erstellte E-Mail-Adresse
   */
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

  /**
   * Aktualisiert eine E-Mail-Adresse. Bei isPrimary-Wechsel wird exklusive Primär-Logik angewandt.
   *
   * @param customerId - Kunden-UUID
   * @param id - E-Mail-UUID
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte E-Mail-Adresse
   */
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

  /**
   * Löscht eine E-Mail-Adresse unwiderruflich.
   *
   * @param customerId - Kunden-UUID
   * @param id - E-Mail-UUID
   * @returns Bestätigung mit gelöschter ID
   */
  async removeEmail(customerId: string, id: string) {
    await this.ensureEmail(customerId, id);
    await this.prisma.customerEmail.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Bankverbindungen ─────────────────────────────────────────

  /**
   * Liefert alle Bankverbindungen eines Kunden, primäre zuerst.
   *
   * @param customerId - Kunden-UUID
   * @returns Liste der Bankverbindungen
   */
  async findBankAccounts(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerBankAccount.findMany({
      where: { customerId },
      orderBy: { isPrimary: 'desc' },
    });
  }

  /**
   * Legt eine neue Bankverbindung an. Maximal 2 pro Kunde erlaubt.
   * Wird isPrimary gesetzt, werden bestehende auf nicht-primär zurückgesetzt.
   *
   * @param customerId - Kunden-UUID
   * @param dto - Bankdaten (IBAN, BIC, Bankname, isPrimary)
   * @returns Die erstellte Bankverbindung
   * @throws BadRequestException wenn bereits 2 Bankverbindungen existieren
   */
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

  /**
   * Aktualisiert eine Bankverbindung. Bei isPrimary-Wechsel wird exklusive Primär-Logik angewandt.
   *
   * @param customerId - Kunden-UUID
   * @param id - Bankverbindungs-UUID
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Bankverbindung
   */
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

  /**
   * Löscht eine Bankverbindung unwiderruflich.
   *
   * @param customerId - Kunden-UUID
   * @param id - Bankverbindungs-UUID
   * @returns Bestätigung mit gelöschter ID
   */
  async removeBankAccount(customerId: string, id: string) {
    await this.ensureBankAccount(customerId, id);
    await this.prisma.customerBankAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  /**
   * Prüft ob ein aktiver Kunde existiert, wirft NotFoundException falls nicht.
   *
   * @param id - Kunden-UUID
   * @throws NotFoundException
   */
  private async ensureCustomer(id: string): Promise<void> {
    const count = await this.prisma.customer.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Kunde nicht gefunden');
    }
  }

  /**
   * Prüft ob eine Niederlassung zum Kunden gehört, wirft NotFoundException falls nicht.
   *
   * @param customerId - Kunden-UUID
   * @param id - Niederlassungs-UUID
   * @throws NotFoundException
   */
  private async ensureBranch(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerBranch.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('Niederlassung nicht gefunden');
    }
  }

  /**
   * Prüft ob ein Ansprechpartner zum Kunden gehört, wirft NotFoundException falls nicht.
   *
   * @param customerId - Kunden-UUID
   * @param id - Kontakt-UUID
   * @throws NotFoundException
   */
  private async ensureContact(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerContact.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('Ansprechpartner nicht gefunden');
    }
  }

  /**
   * Prüft ob eine E-Mail-Adresse zum Kunden gehört, wirft NotFoundException falls nicht.
   *
   * @param customerId - Kunden-UUID
   * @param id - E-Mail-UUID
   * @throws NotFoundException
   */
  private async ensureEmail(customerId: string, id: string): Promise<void> {
    const count = await this.prisma.customerEmail.count({
      where: { id, customerId },
    });
    if (count === 0) {
      throw new NotFoundException('E-Mail-Adresse nicht gefunden');
    }
  }

  /**
   * Prüft ob eine Bankverbindung zum Kunden gehört, wirft NotFoundException falls nicht.
   *
   * @param customerId - Kunden-UUID
   * @param id - Bankverbindungs-UUID
   * @throws NotFoundException
   */
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

  /**
   * Synchronisiert einen Ansprechpartner bidirektional mit Google Contacts.
   * Erstellt einen neuen Google-Kontakt oder aktualisiert einen bestehenden (via googleContactId).
   * Speichert die Google-ResourceName-Referenz in der DB.
   *
   * @param contactId - DB-UUID des Ansprechpartners
   * @param contact - Kontaktdaten zur Synchronisation
   * @param companyName - Firmenname des zugehörigen Kunden
   */
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
