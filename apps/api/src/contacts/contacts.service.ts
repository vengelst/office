/**
 * Service für Contacts.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ContactSuggestion {
  id: string;
  source: 'CUSTOMER' | 'SUBCONTRACTOR';
  customerId: string | null;
  subcontractorId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneMobile: string | null;
  role: string | null;
  companyName: string | null;
  label: string;
}

export interface SuggestionsParams {
  q?: string;
  customerId?: string;
  limit?: number;
}

/**
 * Aggregiert Ansprechpartner aus Kunden und Subunternehmen
 * für durchsuchbare Comboboxen (Projekt, E-Mail-Verteiler).
 */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert Autocomplete-/Suchvorschläge.
   *
   * @param params - Filter-, Sortier- und/oder Pagination-Parameter (SuggestionsParams)
   * @returns Vorschlagsliste (ContactSuggestion[])
   */
  async suggestions(params: SuggestionsParams): Promise<ContactSuggestion[]> {
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
    const q = params.q?.trim() || '';
    const customerOnly = !!params.customerId;

    const customerWhere: Prisma.CustomerContactWhereInput = {
      customer: { deletedAt: null },
    };
    if (params.customerId) {
      customerWhere.customerId = params.customerId;
    }
    if (q) {
      customerWhere.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { role: { contains: q, mode: 'insensitive' } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const customerContacts = await this.prisma.customerContact.findMany({
      where: customerWhere,
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        customer: { select: { id: true, companyName: true } },
      },
    });

    const fromCustomers: ContactSuggestion[] = customerContacts.map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
      const company = c.customer.companyName;
      return {
        id: c.id,
        source: 'CUSTOMER' as const,
        customerId: c.customerId,
        subcontractorId: null,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phoneMobile: c.phoneMobile,
        role: c.role,
        companyName: company,
        label: company ? `${name} (${company})` : name,
      };
    });

    if (customerOnly) {
      return fromCustomers.slice(0, limit);
    }

    const remaining = Math.max(0, limit - fromCustomers.length);
    if (remaining === 0) return fromCustomers;

    const subWhere: Prisma.SubcontractorContactWhereInput = {
      subcontractor: { deletedAt: null },
    };
    if (q) {
      subWhere.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { role: { contains: q, mode: 'insensitive' } },
        {
          subcontractor: { name: { contains: q, mode: 'insensitive' } },
        },
      ];
    }

    const subContacts = await this.prisma.subcontractorContact.findMany({
      where: subWhere,
      take: remaining,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        subcontractor: { select: { id: true, name: true } },
      },
    });

    const fromSubs: ContactSuggestion[] = subContacts.map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
      const company = c.subcontractor.name;
      return {
        id: c.id,
        source: 'SUBCONTRACTOR' as const,
        customerId: null,
        subcontractorId: c.subcontractorId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phoneMobile: c.phoneMobile,
        role: c.role,
        companyName: company,
        label: company ? `${name} (${company})` : name,
      };
    });

    return [...fromCustomers, ...fromSubs].slice(0, limit);
  }
}
