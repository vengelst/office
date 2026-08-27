/**
 * Merge-Regeln für NL-Anreicherung: NOT_FOUND darf keine KI-Adressen übernehmen.
 */

import type { AiImportBranchDraft, EnrichmentStatus } from './types';

export interface EnrichmentLlmResult {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  mapsUrl?: string;
  notes?: string;
  status?: string;
}

const PLACEHOLDER_RE =
  /^(n\/?a|n\.a\.|none|null|unknown|unbekannt|example\.com|placeholder|xxx+|-+|\.+)$/i;

/**
 * Entfernt leere und offensichtliche Platzhalter-Werte.
 */
export function cleanEnrichmentValue(
  value: string | undefined | null,
): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (!t) return undefined;
  if (PLACEHOLDER_RE.test(t)) return undefined;
  return t;
}

/**
 * Grobe PLZ-Validierung (DE 5-stellig, AT/CH 4, international alphanumerisch kurz).
 */
export function isPlausiblePostalCode(value: string | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (PLACEHOLDER_RE.test(t)) return false;
  if (/^\d{4,5}$/.test(t)) return true;
  if (/^[A-Z0-9][A-Z0-9\s-]{2,10}$/i.test(t)) return true;
  return false;
}

function pickField(
  llm: string | undefined,
  draft: string | undefined,
): string | undefined {
  return cleanEnrichmentValue(llm) || cleanEnrichmentValue(draft) || undefined;
}

/**
 * Zählt verifizierbare Kontaktteile aus dem LLM-Ergebnis (Straße ODER PLZ+Ort ODER Tel/E-Mail).
 */
export function hasVerifiablePartial(parsed: EnrichmentLlmResult): boolean {
  const street = cleanEnrichmentValue(parsed.addressLine1);
  const postal = cleanEnrichmentValue(parsed.postalCode);
  const city = cleanEnrichmentValue(parsed.city);
  const phone = cleanEnrichmentValue(parsed.phone);
  const email = cleanEnrichmentValue(parsed.email);

  if (street) return true;
  if (postal && city && isPlausiblePostalCode(postal)) return true;
  if (phone || email) return true;
  return false;
}

function llmHasAddressLikeFields(parsed: EnrichmentLlmResult): boolean {
  return Boolean(
    cleanEnrichmentValue(parsed.addressLine1) ||
      cleanEnrichmentValue(parsed.addressLine2) ||
      cleanEnrichmentValue(parsed.postalCode) ||
      cleanEnrichmentValue(parsed.city) ||
      cleanEnrichmentValue(parsed.phone) ||
      cleanEnrichmentValue(parsed.email) ||
      cleanEnrichmentValue(parsed.mapsUrl),
  );
}

/**
 * Normalisiert den LLM-Status; PARTIAL ohne verifizierbaren Teil → NOT_FOUND.
 */
export function normalizeEnrichmentStatus(
  parsed: EnrichmentLlmResult,
): EnrichmentStatus {
  const raw = parsed.status;
  let status: EnrichmentStatus =
    raw === 'FOUND' || raw === 'PARTIAL' || raw === 'NOT_FOUND'
      ? raw
      : inferStatusFromFields(parsed);

  if (status === 'PARTIAL' && !hasVerifiablePartial(parsed)) {
    status = 'NOT_FOUND';
  }
  if (status === 'FOUND' && !hasVerifiablePartial(parsed)) {
    status = 'NOT_FOUND';
  }
  return status;
}

function inferStatusFromFields(p: EnrichmentLlmResult): EnrichmentStatus {
  const street = cleanEnrichmentValue(p.addressLine1);
  const city = cleanEnrichmentValue(p.city);
  const postal = cleanEnrichmentValue(p.postalCode);
  if (street && (city || postal)) return 'FOUND';
  if (hasVerifiablePartial(p)) return 'PARTIAL';
  return 'NOT_FOUND';
}

export interface MergeEnrichmentResult {
  branch: AiImportBranchDraft;
  warnings: string[];
}

/**
 * Merged LLM-Ergebnis in den Branch-Draft.
 * Bei NOT_FOUND: keine Adress-/Tel-/E-Mail-/mapsUrl-Felder aus dem LLM.
 */
export function mergeEnrichmentIntoBranch(
  branch: AiImportBranchDraft,
  parsed: EnrichmentLlmResult,
  usedUrls: string[],
): MergeEnrichmentResult {
  const warnings: string[] = [];
  const status = normalizeEnrichmentStatus(parsed);
  const sourceNote = usedUrls.length
    ? `Quelle: ${usedUrls.join(', ')}`
    : undefined;

  if (status === 'NOT_FOUND') {
    if (llmHasAddressLikeFields(parsed)) {
      warnings.push(
        `Niederlassung „${branch.name}“: KI lieferte Adresse trotz NOT_FOUND – verworfen.`,
      );
    }
    return {
      branch: {
        ...branch,
        // Draft-Felder aus Quelldatei bleiben; KI-Felder nicht übernehmen
        notes: [branch.notes, cleanEnrichmentValue(parsed.notes), sourceNote]
          .filter(Boolean)
          .join('\n'),
        enrichmentStatus: 'NOT_FOUND',
        sourceUrls: usedUrls,
      },
      warnings,
    };
  }

  // FOUND / PARTIAL: nur nicht-leere, bereinigte LLM-Felder; Draft als Fallback
  let postalCode = pickField(parsed.postalCode, branch.postalCode);
  if (postalCode && !isPlausiblePostalCode(postalCode)) {
    // If only LLM postal was implausible and draft had none, drop
    if (!cleanEnrichmentValue(branch.postalCode)) {
      postalCode = undefined;
    } else {
      postalCode = cleanEnrichmentValue(branch.postalCode);
    }
  }

  return {
    branch: {
      ...branch,
      addressLine1: pickField(parsed.addressLine1, branch.addressLine1),
      addressLine2: pickField(parsed.addressLine2, branch.addressLine2),
      postalCode,
      city: pickField(parsed.city, branch.city),
      country: pickField(parsed.country, branch.country),
      phone: pickField(parsed.phone, branch.phone),
      email: pickField(parsed.email, branch.email),
      mapsUrl: pickField(parsed.mapsUrl, branch.mapsUrl),
      notes: [branch.notes, cleanEnrichmentValue(parsed.notes), sourceNote]
        .filter(Boolean)
        .join('\n'),
      enrichmentStatus: status,
      sourceUrls: usedUrls,
    },
    warnings,
  };
}
