/**
 * Orchestriert Preview (Extraktion → LLM → NL-Anreicherung) und Commit.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiAssistantService } from './ai-assistant.service';
import { BranchEnrichmentService } from './branch-enrichment.service';
import {
  isCompanyEmailContact,
  splitAndDedupCompanyEmails,
} from './company-email.util';
import { FileExtractService } from './file-extract.service';
import { PreviewCache } from './preview-cache';
import {
  buildContactImportUserPrompt,
  CONTACT_IMPORT_SYSTEM_PROMPT,
} from './prompt';
import type {
  AiImportBranchDraft,
  AiImportCommitRequest,
  AiImportCommitResponse,
  AiImportCompanyEmailDraft,
  AiImportContactDraft,
  AiImportPreviewPayload,
  AiImportPreviewResponse,
  ImportMode,
} from './types';

type Tx = Prisma.TransactionClient;

const COMMIT_TX_TIMEOUT_MS = 60_000;

@Injectable()
export class AiImportService {
  private readonly logger = new Logger(AiImportService.name);
  private readonly cache = new PreviewCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiAssistantService,
    private readonly extract: FileExtractService,
    private readonly enrichment: BranchEnrichmentService,
  ) {}

  /**
   * Datei → Text → LLM → optional Branch-Enrichment → Preview (kein DB-Write).
   */
  async preview(opts: {
    file: Express.Multer.File;
    hint?: string;
    mode?: ImportMode;
    enrichBranches: boolean;
  }): Promise<AiImportPreviewResponse> {
    await this.ai.assertReady();

    const { text, truncated } = await this.extract.extract(opts.file);
    const filename = opts.file.originalname || 'upload';
    const importDate = new Date().toISOString().slice(0, 10);

    const raw = await this.ai.chatJson<AiImportPreviewPayload>({
      system: CONTACT_IMPORT_SYSTEM_PROMPT,
      user: buildContactImportUserPrompt({
        filename,
        hint: opts.hint,
        text,
        importDate,
      }),
      maxTokens: 12000,
    });

    let payload = this.normalizePayload(raw, filename, importDate);
    if (opts.mode) {
      payload.suggestedMode = opts.mode;
    }

    const warnings = [...payload.warnings];
    if (truncated) {
      warnings.push(
        'Quelltext war sehr lang und wurde für die KI gekürzt – bitte Preview prüfen.',
      );
    }

    // Ensure branches from contact departments if LLM missed some
    payload = this.ensureBranchesFromContacts(payload);

    if (opts.enrichBranches && payload.branches.length > 0) {
      const companyName =
        payload.customerDraft?.companyName ||
        this.guessCompanyFromBranches(payload.branches) ||
        'Firma';
      const { branches, warnings: enrichWarnings } =
        await this.enrichment.enrichBranches({
          companyName,
          website: payload.customerDraft?.website,
          branches: payload.branches,
        });
      payload.branches = branches;
      warnings.push(...enrichWarnings);
    } else {
      payload.branches = payload.branches.map((b) => ({
        ...b,
        enrichmentStatus: 'SKIPPED' as const,
      }));
    }

    payload.warnings = warnings;

    const existingCustomerMatches = payload.customerDraft?.companyName
      ? await this.findCustomerMatches(payload.customerDraft.companyName)
      : [];

    if (existingCustomerMatches.length > 0) {
      payload.warnings.push(
        `Kunde „${payload.customerDraft!.companyName}“ existiert bereits (${existingCustomerMatches
          .map((c) => c.customerNumber)
          .join(', ')}). Beim Übernehmen bestehenden Kunden wählen oder neu anlegen.`,
      );
    }

    const previewId = randomUUID();
    this.cache.set(previewId, payload, filename);

    return {
      ...payload,
      previewId,
      sourceFilename: filename,
      existingCustomerMatches,
    };
  }

  /**
   * Schreibt freigegebene Preview-Daten in die DB (Transaction).
   * Client-Payload ist Source of Truth; Cache-Miss bricht nicht ab.
   */
  async commit(
    dto: AiImportCommitRequest,
    userId: string,
  ): Promise<AiImportCommitResponse> {
    await this.ai.assertReady();

    const mode =
      dto.mode ||
      dto.suggestedMode ||
      'ONE_CUSTOMER_MANY_CONTACTS';

    if (mode === 'ONE_ROW_ONE_CUSTOMER') {
      return this.commitOneRowOneCustomer(dto, userId);
    }
    return this.commitOneCustomerManyContacts(dto, userId);
  }

  private async commitOneCustomerManyContacts(
    dto: AiImportCommitRequest,
    userId: string,
  ): Promise<AiImportCommitResponse> {
    const companyName = dto.customerDraft?.companyName?.trim();
    if (!companyName && !dto.attachToCustomerId) {
      throw new BadRequestException(
        'customerDraft.companyName oder attachToCustomerId erforderlich',
      );
    }

    const includedBranches = (dto.branches || []).filter((b) => b.include);
    const { personContacts, companyEmails, skippedContacts } =
      this.prepareContactsAndEmails(dto);

    const sourceFilename =
      dto.sourceFilename ||
      (dto.previewId ? this.cache.get(dto.previewId)?.sourceFilename : null) ||
      'import';
    const sourceMarker = `Quelle: KI-Import ${sourceFilename} (${new Date().toISOString().slice(0, 10)}) · User ${userId}`;

    const result = await this.prisma.$transaction(
      async (tx) => {
        let customerId: string;
        let customerNumber: string;
        let createdBranches = 0;
        let reusedBranches = 0;
        let createdContacts = 0;
        let createdEmails = 0;

        if (dto.attachToCustomerId) {
          const existing = await tx.customer.findFirst({
            where: { id: dto.attachToCustomerId, deletedAt: null },
          });
          if (!existing) {
            throw new NotFoundException('Zielkunde nicht gefunden');
          }
          customerId = existing.id;
          customerNumber = existing.customerNumber;
          await tx.customer.update({
            where: { id: customerId },
            data: {
              notes: [existing.notes, sourceMarker]
                .filter(Boolean)
                .join('\n\n'),
            },
          });
        } else {
          const notes = [dto.customerDraft?.notes, sourceMarker]
            .filter(Boolean)
            .join('\n\n');
          const created = await this.createCustomerWithNumber(tx, {
            companyName: companyName!,
            country: dto.customerDraft?.country || undefined,
            website: dto.customerDraft?.website || undefined,
            industry: dto.customerDraft?.industry || undefined,
            rating: dto.customerDraft?.rating || undefined,
            notes: notes || undefined,
          });
          customerId = created.id;
          customerNumber = created.customerNumber;
        }

        const existingBranches = await tx.customerBranch.findMany({
          where: { customerId },
        });

        const branchIdByKey = new Map<string, string>();

        for (const b of includedBranches) {
          const match = existingBranches.find(
            (eb) =>
              this.norm(eb.name) === this.norm(b.name) ||
              (b.city &&
                eb.city &&
                this.norm(eb.city) === this.norm(b.city) &&
                this.norm(eb.name).includes(this.norm(b.city))),
          );
          if (match) {
            branchIdByKey.set(b.key, match.id);
            reusedBranches += 1;
            continue;
          }
          const created = await tx.customerBranch.create({
            data: {
              customerId,
              name: b.name,
              branchType: b.branchType || 'OFFICE',
              addressLine1: b.addressLine1 || undefined,
              addressLine2: b.addressLine2 || undefined,
              postalCode: b.postalCode || undefined,
              city: b.city || undefined,
              country: b.country || undefined,
              phone: b.phone || undefined,
              email: b.email || undefined,
              mapsUrl: b.mapsUrl || undefined,
              notes:
                [b.notes, sourceMarker].filter(Boolean).join('\n') || undefined,
              active: true,
            },
          });
          branchIdByKey.set(b.key, created.id);
          createdBranches += 1;
        }

        const companyEmailKeys = new Set(
          companyEmails.map((e) => e.email.trim().toLowerCase()),
        );

        for (const c of personContacts) {
          const branchId = c.branchKey
            ? branchIdByKey.get(c.branchKey)
            : undefined;
          const notes = [
            c.notes,
            c.priority ? `Priorität: ${c.priority}` : null,
            c.department ? `Einheit: ${c.department}` : null,
            sourceMarker,
          ]
            .filter(Boolean)
            .join('\n');

          const emailKey = c.email?.trim().toLowerCase();
          const contactEmail =
            emailKey && companyEmailKeys.has(emailKey)
              ? undefined
              : c.email || undefined;

          await tx.customerContact.create({
            data: {
              customerId,
              branchId: branchId || undefined,
              firstName: c.firstName?.trim() || '-',
              lastName: c.lastName?.trim() || '-',
              role: c.role || undefined,
              department: c.department || undefined,
              email: contactEmail,
              phoneLandline: c.phoneLandline || undefined,
              phoneMobile: c.phoneMobile || undefined,
              linkedInUrl: c.linkedInUrl || undefined,
              country: c.country || undefined,
              notes: notes || undefined,
              syncToGoogle: false,
            },
          });
          createdContacts += 1;
        }

        for (const e of companyEmails) {
          await tx.customerEmail.create({
            data: {
              customerId,
              email: e.email,
              emailType: e.emailType || 'GENERAL',
              label: e.label || undefined,
            },
          });
          createdEmails += 1;
        }

        return {
          customerId,
          customerNumber,
          createdBranches,
          createdContacts,
          createdEmails,
          reusedBranches,
        };
      },
      { timeout: COMMIT_TX_TIMEOUT_MS },
    );

    // Cache erst nach erfolgreicher Transaction löschen
    if (dto.previewId) this.cache.delete(dto.previewId);

    return {
      ...result,
      skipped: {
        contacts: skippedContacts,
        branches: (dto.branches || []).length - includedBranches.length,
        emails:
          (dto.companyEmails || []).filter((e) => !e.include).length +
          (dto.contacts || []).filter(
            (c) => c.include && isCompanyEmailContact(c) && !c.email?.trim(),
          ).length,
      },
    };
  }

  /**
   * Modus B: jeder inkludierte Personen-Kontakt → eigener Kunde.
   * COMPANY_EMAIL-Zeilen → Kunde + CustomerEmail ohne Fake-Person.
   */
  private async commitOneRowOneCustomer(
    dto: AiImportCommitRequest,
    userId: string,
  ): Promise<AiImportCommitResponse> {
    const included = (dto.contacts || []).filter((c) => c.include);
    const includedEmails = (dto.companyEmails || []).filter((e) => e.include);

    if (included.length === 0 && includedEmails.length === 0) {
      throw new BadRequestException('Keine Kontakte zum Import ausgewählt');
    }

    const sourceFilename = dto.sourceFilename || 'import';
    const sourceMarker = `Quelle: KI-Import ${sourceFilename} (${new Date().toISOString().slice(0, 10)}) · User ${userId}`;

    const result = await this.prisma.$transaction(
      async (tx) => {
        let lastCustomerId = '';
        let lastCustomerNumber = '';
        let createdContacts = 0;
        let createdBranches = 0;
        let createdEmails = 0;

        for (const c of included) {
          if (isCompanyEmailContact(c)) {
            const email = c.email?.trim();
            if (!email) continue;
            const companyName =
              c.department?.trim() ||
              dto.customerDraft?.companyName ||
              email ||
              'Interessent';
            const customer = await this.createCustomerWithNumber(tx, {
              companyName,
              country: c.country || dto.customerDraft?.country || undefined,
              industry: dto.customerDraft?.industry || undefined,
              rating: c.priority || dto.customerDraft?.rating || undefined,
              notes: [dto.customerDraft?.notes, sourceMarker]
                .filter(Boolean)
                .join('\n\n'),
            });
            lastCustomerId = customer.id;
            lastCustomerNumber = customer.customerNumber;

            let branchId: string | undefined;
            if (c.branchKey) {
              branchId = await this.createBranchIfDraft(
                tx,
                customer.id,
                c.branchKey,
                dto,
                sourceMarker,
              );
              if (branchId) createdBranches += 1;
            }

            await tx.customerEmail.create({
              data: {
                customerId: customer.id,
                email,
                emailType: 'GENERAL',
                label:
                  c.role ||
                  c.department ||
                  [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                  undefined,
              },
            });
            createdEmails += 1;
            continue;
          }

          const companyName =
            c.department?.trim() ||
            dto.customerDraft?.companyName ||
            `${c.firstName} ${c.lastName}`.trim() ||
            'Interessent';
          const customer = await this.createCustomerWithNumber(tx, {
            companyName,
            country: c.country || dto.customerDraft?.country || undefined,
            industry: dto.customerDraft?.industry || undefined,
            rating: c.priority || dto.customerDraft?.rating || undefined,
            notes: [dto.customerDraft?.notes, sourceMarker]
              .filter(Boolean)
              .join('\n\n'),
          });
          lastCustomerId = customer.id;
          lastCustomerNumber = customer.customerNumber;

          let branchId: string | undefined;
          if (c.branchKey) {
            branchId = await this.createBranchIfDraft(
              tx,
              customer.id,
              c.branchKey,
              dto,
              sourceMarker,
            );
            if (branchId) createdBranches += 1;
          }

          await tx.customerContact.create({
            data: {
              customerId: customer.id,
              branchId,
              firstName: c.firstName?.trim() || '-',
              lastName: c.lastName?.trim() || '-',
              role: c.role || undefined,
              department: c.department || undefined,
              email: c.email || undefined,
              phoneLandline: c.phoneLandline || undefined,
              phoneMobile: c.phoneMobile || undefined,
              linkedInUrl: c.linkedInUrl || undefined,
              country: c.country || undefined,
              notes:
                [c.notes, sourceMarker].filter(Boolean).join('\n') || undefined,
              syncToGoogle: false,
            },
          });
          createdContacts += 1;
        }

        // Standalone companyEmails without contact rows
        for (const e of includedEmails) {
          const alreadyFromContact = included.some(
            (c) =>
              c.include &&
              c.email?.trim().toLowerCase() === e.email.trim().toLowerCase(),
          );
          if (alreadyFromContact) continue;

          const companyName =
            e.label?.trim() ||
            dto.customerDraft?.companyName ||
            e.email ||
            'Interessent';
          const customer = await this.createCustomerWithNumber(tx, {
            companyName,
            country: dto.customerDraft?.country || undefined,
            industry: dto.customerDraft?.industry || undefined,
            rating: dto.customerDraft?.rating || undefined,
            notes: [dto.customerDraft?.notes, sourceMarker]
              .filter(Boolean)
              .join('\n\n'),
          });
          lastCustomerId = customer.id;
          lastCustomerNumber = customer.customerNumber;
          await tx.customerEmail.create({
            data: {
              customerId: customer.id,
              email: e.email,
              emailType: e.emailType || 'GENERAL',
              label: e.label || undefined,
            },
          });
          createdEmails += 1;
        }

        if (!lastCustomerId) {
          throw new BadRequestException('Keine Kontakte zum Import ausgewählt');
        }

        return {
          customerId: lastCustomerId,
          customerNumber: lastCustomerNumber,
          createdBranches,
          createdContacts,
          createdEmails,
          reusedBranches: 0,
        };
      },
      { timeout: COMMIT_TX_TIMEOUT_MS },
    );

    if (dto.previewId) this.cache.delete(dto.previewId);

    return {
      ...result,
      skipped: {
        contacts: (dto.contacts || []).length - included.length,
        branches: 0,
        emails: (dto.companyEmails || []).length - includedEmails.length,
      },
    };
  }

  /**
   * Teilt included Contacts in Personen vs. Firmen-E-Mails und dedupliziert.
   */
  private prepareContactsAndEmails(dto: AiImportCommitRequest): {
    personContacts: AiImportContactDraft[];
    companyEmails: AiImportCompanyEmailDraft[];
    skippedContacts: number;
  } {
    const includedContacts = (dto.contacts || []).filter((c) => c.include);
    const includedEmails = (dto.companyEmails || []).filter((e) => e.include);
    const split = splitAndDedupCompanyEmails(includedContacts, includedEmails);
    const skippedContacts =
      (dto.contacts || []).length -
      includedContacts.length +
      split.movedCount;
    return {
      personContacts: split.contacts,
      companyEmails: split.companyEmails.filter((e) => e.include),
      skippedContacts,
    };
  }

  private async createBranchIfDraft(
    tx: Tx,
    customerId: string,
    branchKey: string,
    dto: AiImportCommitRequest,
    sourceMarker: string,
  ): Promise<string | undefined> {
    const branchDraft = (dto.branches || []).find(
      (b) => b.key === branchKey && b.include,
    );
    if (!branchDraft) return undefined;
    const br = await tx.customerBranch.create({
      data: {
        customerId,
        name: branchDraft.name,
        branchType: branchDraft.branchType || 'OFFICE',
        addressLine1: branchDraft.addressLine1 || undefined,
        addressLine2: branchDraft.addressLine2 || undefined,
        postalCode: branchDraft.postalCode || undefined,
        city: branchDraft.city || undefined,
        country: branchDraft.country || undefined,
        phone: branchDraft.phone || undefined,
        email: branchDraft.email || undefined,
        mapsUrl: branchDraft.mapsUrl || undefined,
        notes:
          [branchDraft.notes, sourceMarker].filter(Boolean).join('\n') ||
          undefined,
      },
    });
    return br.id;
  }

  private async createCustomerWithNumber(
    tx: Tx,
    data: {
      companyName: string;
      country?: string;
      industry?: string;
      rating?: string;
      notes?: string;
      website?: string;
    },
  ) {
    // Unique-Konflikt: kurze Retries innerhalb der Transaction
    for (let attempt = 0; attempt < 3; attempt++) {
      const customerNumber = await this.generateCustomerNumber(tx);
      try {
        return await tx.customer.create({
          data: {
            customerNumber,
            companyName: data.companyName,
            country: data.country,
            industry: data.industry,
            rating: data.rating?.slice(0, 1),
            notes: data.notes,
            website: data.website,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException('Kundennummer konnte nicht vergeben werden');
  }

  private normalizePayload(
    raw: AiImportPreviewPayload,
    filename: string,
    importDate: string,
  ): AiImportPreviewPayload {
    const sourceLine = `Quelle: ${filename} (${importDate})`;
    const branches: AiImportBranchDraft[] = Array.isArray(raw.branches)
      ? raw.branches.map((b, i) => ({
          include: b.include !== false,
          key: (b.key || `branch-${i + 1}`)
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-'),
          name: b.name || `Niederlassung ${i + 1}`,
          branchType: b.branchType,
          addressLine1: b.addressLine1,
          addressLine2: b.addressLine2,
          postalCode: b.postalCode,
          city: b.city,
          country: b.country,
          phone: b.phone,
          email: b.email,
          mapsUrl: b.mapsUrl,
          notes: b.notes,
          enrichmentStatus: b.enrichmentStatus || 'SKIPPED',
          sourceUrls: b.sourceUrls,
        }))
      : [];

    const contactsRaw: AiImportContactDraft[] = Array.isArray(raw.contacts)
      ? raw.contacts.map((c) => ({
          include: c.include !== false,
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          role: c.role,
          email: c.email,
          phoneLandline: c.phoneLandline,
          phoneMobile: c.phoneMobile,
          linkedInUrl: c.linkedInUrl,
          country: c.country,
          department: c.department,
          branchKey: c.branchKey,
          notes: c.notes
            ? c.notes.includes('Quelle:')
              ? c.notes
              : `${c.notes}\n${sourceLine}`
            : sourceLine,
          priority: c.priority,
          kind: c.kind || 'PERSON',
        }))
      : [];

    const companyEmailsRaw: AiImportCompanyEmailDraft[] = Array.isArray(
      raw.companyEmails,
    )
      ? raw.companyEmails.map((e) => ({
          include: e.include !== false,
          email: e.email,
          label: e.label,
          emailType: e.emailType || 'GENERAL',
        }))
      : [];

    // COMPANY_EMAIL / Heuristik → companyEmails verschieben
    const split = splitAndDedupCompanyEmails(contactsRaw, companyEmailsRaw);

    // Dedup remaining person contacts by name+email
    const seen = new Set<string>();
    const dedupedContacts: AiImportContactDraft[] = [];
    for (const c of split.contacts) {
      const key = `${this.norm(c.firstName)}|${this.norm(c.lastName)}|${this.norm(c.email || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedContacts.push(c);
    }

    let customerDraft = raw.customerDraft;
    if (customerDraft?.companyName) {
      customerDraft = {
        ...customerDraft,
        notes: customerDraft.notes
          ? customerDraft.notes.includes('Quelle:')
            ? customerDraft.notes
            : `${customerDraft.notes}\n${sourceLine}`
          : sourceLine,
      };
    }

    return {
      suggestedMode:
        raw.suggestedMode === 'ONE_ROW_ONE_CUSTOMER'
          ? 'ONE_ROW_ONE_CUSTOMER'
          : 'ONE_CUSTOMER_MANY_CONTACTS',
      customerDraft,
      branches,
      contacts: dedupedContacts,
      companyEmails: split.companyEmails,
      warnings: [
        ...(Array.isArray(raw.warnings) ? raw.warnings : []),
        ...split.warnings,
      ],
    };
  }

  private ensureBranchesFromContacts(
    payload: AiImportPreviewPayload,
  ): AiImportPreviewPayload {
    const byKey = new Map(payload.branches.map((b) => [b.key, b]));
    for (const c of payload.contacts) {
      if (!c.department?.trim()) continue;
      if (c.branchKey && byKey.has(c.branchKey)) continue;
      const key =
        c.branchKey ||
        c.department
          .toLowerCase()
          .replace(/[^a-z0-9äöüß]+/gi, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 48) ||
        `branch-${byKey.size + 1}`;
      if (!byKey.has(key)) {
        const branch: AiImportBranchDraft = {
          include: true,
          key,
          name: c.department.trim(),
          branchType: 'OFFICE',
          city: this.guessCityFromUnit(c.department),
          country: c.country,
          enrichmentStatus: 'SKIPPED',
        };
        byKey.set(key, branch);
      }
      c.branchKey = key;
    }
    return { ...payload, branches: [...byKey.values()] };
  }

  private guessCityFromUnit(unit: string): string | undefined {
    const m = unit.match(/[–-]\s*(.+)$/);
    if (!m) return undefined;
    const city = m[1].replace(/\s*\/\s*.*$/, '').trim();
    return city || undefined;
  }

  private guessCompanyFromBranches(branches: AiImportBranchDraft[]): string {
    const first = branches[0]?.name || '';
    const m = first.match(/^(.+?)\s*[–-]/);
    return m?.[1]?.trim() || first;
  }

  private async findCustomerMatches(companyName: string) {
    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        companyName: { equals: companyName, mode: 'insensitive' },
      },
      select: { id: true, customerNumber: true, companyName: true },
      take: 5,
    });
  }

  /**
   * Kundennummer race-safe innerhalb der Transaction.
   */
  private async generateCustomerNumber(tx: Tx): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `K-${year}-`;
    const last = await tx.customer.findFirst({
      where: { customerNumber: { startsWith: prefix } },
      orderBy: { customerNumber: 'desc' },
      select: { customerNumber: true },
    });
    const lastSeq = last
      ? Number.parseInt(last.customerNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }
}
