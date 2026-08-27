/**
 * Erkennung und Normalisierung von Sammel-/Firmen-E-Mails (kein Ansprechpartner).
 */

import type {
  AiImportCompanyEmailDraft,
  AiImportContactDraft,
} from './types';

/** Lokale Parts, die typischerweise keine Person sind. */
const COLLECTIVE_LOCAL_PREFIXES = [
  'nl-',
  'office-',
  'info.',
  'info@',
  'customer.care',
  'customercare',
  'kundenservice',
  'service.',
  'kontakt',
  'contact',
  'hello',
  'mail.',
  'noreply',
  'no-reply',
  'poststelle',
  'zentrale',
  'reception',
  'empfang',
  'buchhaltung',
  'accounting',
  'hr.',
  'jobs.',
  'presse',
  'marketing',
  'sales.',
  'vertrieb',
];

const COLLECTIVE_LOCAL_EXACT = new Set([
  'info',
  'office',
  'kontakt',
  'contact',
  'hello',
  'mail',
  'post',
  'admin',
  'support',
  'service',
  'sales',
  'vertrieb',
  'hr',
  'jobs',
  'presse',
  'reception',
  'empfang',
  'zentrale',
  'buchhaltung',
]);

/**
 * Prüft, ob ein Contact als Firmen-/Sammel-E-Mail behandelt werden soll.
 */
export function isCompanyEmailContact(
  contact: Pick<AiImportContactDraft, 'kind' | 'email' | 'firstName' | 'lastName'>,
): boolean {
  if (contact.kind === 'COMPANY_EMAIL') return true;
  if (!contact.email?.trim()) return false;
  return isCollectiveEmailAddress(contact.email);
}

/**
 * Heuristik: lokale Parts wie nl-, office-, info, customer.care, …
 */
export function isCollectiveEmailAddress(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return false;
  const local = trimmed.slice(0, at);

  if (COLLECTIVE_LOCAL_EXACT.has(local)) return true;
  if (COLLECTIVE_LOCAL_PREFIXES.some((p) => local.startsWith(p.replace(/@$/, '')))) {
    return true;
  }
  // nl.stadt / office.region
  if (/^(nl|office|info|kontakt|contact)[._-]/.test(local)) return true;
  // Domain-only style labels without person name pattern
  if (/^(nl|office)-[a-z0-9.-]+$/.test(local)) return true;

  return false;
}

/**
 * Baut einen CustomerEmail-Draft aus einem Contact.
 */
export function contactToCompanyEmail(
  contact: AiImportContactDraft,
): AiImportCompanyEmailDraft | null {
  const email = contact.email?.trim();
  if (!email) return null;
  const label =
    contact.role?.trim() ||
    contact.department?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
    undefined;
  return {
    include: contact.include !== false,
    email,
    label: label || undefined,
    emailType: 'GENERAL',
  };
}

export interface SplitCompanyEmailsResult {
  contacts: AiImportContactDraft[];
  companyEmails: AiImportCompanyEmailDraft[];
  movedCount: number;
  warnings: string[];
}

/**
 * Verschiebt COMPANY_EMAIL-/Heuristik-Kontakte nach companyEmails und dedupliziert.
 */
export function splitAndDedupCompanyEmails(
  contacts: AiImportContactDraft[],
  companyEmails: AiImportCompanyEmailDraft[] = [],
): SplitCompanyEmailsResult {
  const warnings: string[] = [];
  const personContacts: AiImportContactDraft[] = [];
  const emailMap = new Map<string, AiImportCompanyEmailDraft>();

  const addEmail = (draft: AiImportCompanyEmailDraft): void => {
    const key = draft.email.trim().toLowerCase();
    if (!key) return;
    const existing = emailMap.get(key);
    if (existing) {
      // Keep include=true if either is included; prefer non-empty label
      emailMap.set(key, {
        include: existing.include || draft.include,
        email: existing.email || draft.email,
        label: existing.label || draft.label,
        emailType: existing.emailType || draft.emailType || 'GENERAL',
      });
      return;
    }
    emailMap.set(key, {
      include: draft.include !== false,
      email: draft.email.trim(),
      label: draft.label,
      emailType: draft.emailType || 'GENERAL',
    });
  };

  for (const e of companyEmails) {
    if (e.email?.trim()) addEmail(e);
  }

  let movedCount = 0;
  for (const c of contacts) {
    if (isCompanyEmailContact(c)) {
      const asEmail = contactToCompanyEmail(c);
      if (asEmail) {
        const key = asEmail.email.toLowerCase();
        const wasNew = !emailMap.has(key);
        addEmail(asEmail);
        movedCount += 1;
        if (wasNew && c.kind !== 'COMPANY_EMAIL') {
          warnings.push(
            `Sammel-E-Mail „${asEmail.email}“ als Firmen-E-Mail erkannt (kein Ansprechpartner).`,
          );
        }
      }
      continue;
    }
    // Person with email that duplicates a company email: keep contact, drop email dup later at commit
    personContacts.push({
      ...c,
      kind: c.kind || 'PERSON',
    });
  }

  // If a person contact shares email with companyEmails, strip email from contact at commit —
  // here we only dedupe companyEmails list. Optionally warn.
  for (const c of personContacts) {
    const key = c.email?.trim().toLowerCase();
    if (key && emailMap.has(key)) {
      warnings.push(
        `E-Mail „${c.email}“ ist sowohl bei Kontakt „${c.firstName} ${c.lastName}“ als auch als Firmen-E-Mail – wird nur einmal als Firmen-E-Mail gespeichert.`,
      );
    }
  }

  return {
    contacts: personContacts,
    companyEmails: [...emailMap.values()],
    movedCount,
    warnings,
  };
}
