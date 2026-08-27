/**
 * Web-Anreicherung von Niederlassungen: öffentliche Seiten fetchen + KI-Extraktion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { BRANCH_ENRICH_SYSTEM_PROMPT } from './prompt';
import type { AiImportBranchDraft, EnrichmentStatus } from './types';

const MAX_PARALLEL = 6;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PAGE_CHARS = 14_000;

interface EnrichResult {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  mapsUrl?: string;
  notes?: string;
  status: EnrichmentStatus;
}

@Injectable()
export class BranchEnrichmentService {
  private readonly logger = new Logger(BranchEnrichmentService.name);

  constructor(private readonly ai: AiAssistantService) {}

  /**
   * Reichert Branches parallel an (Limit). Fehlschläge → NOT_FOUND + Warning.
   */
  async enrichBranches(opts: {
    companyName: string;
    website?: string;
    branches: AiImportBranchDraft[];
  }): Promise<{ branches: AiImportBranchDraft[]; warnings: string[] }> {
    const warnings: string[] = [];
    const queue = [...opts.branches];
    const results: AiImportBranchDraft[] = new Array(queue.length);

    let index = 0;
    const workers = Array.from(
      { length: Math.min(MAX_PARALLEL, queue.length || 1) },
      async () => {
        while (index < queue.length) {
          const i = index++;
          const branch = queue[i];
          try {
            results[i] = await this.enrichOne(
              opts.companyName,
              opts.website,
              branch,
            );
            if (results[i].enrichmentStatus === 'NOT_FOUND') {
              warnings.push(
                `Niederlassung „${branch.name}“: keine öffentliche Adresse gefunden – manuell nachpflegen.`,
              );
            }
          } catch (err) {
            this.logger.warn(
              `Enrich ${branch.key}: ${(err as Error).message}`,
            );
            results[i] = {
              ...branch,
              enrichmentStatus: 'NOT_FOUND',
            };
            warnings.push(
              `Niederlassung „${branch.name}“: Lookup fehlgeschlagen (${(err as Error).message})`,
            );
          }
        }
      },
    );

    if (queue.length === 0) return { branches: [], warnings };
    await Promise.all(workers);
    return { branches: results, warnings };
  }

  private async enrichOne(
    companyName: string,
    website: string | undefined,
    branch: AiImportBranchDraft,
  ): Promise<AiImportBranchDraft> {
    const candidates = await this.findCandidateUrls(
      companyName,
      website,
      branch,
    );
    if (candidates.length === 0) {
      return { ...branch, enrichmentStatus: 'NOT_FOUND', sourceUrls: [] };
    }

    const pageParts: string[] = [];
    const usedUrls: string[] = [];
    for (const url of candidates.slice(0, 3)) {
      const text = await this.fetchPageText(url);
      if (text) {
        usedUrls.push(url);
        pageParts.push(`URL: ${url}\n${text}`);
      }
    }

    if (pageParts.length === 0) {
      return {
        ...branch,
        enrichmentStatus: 'NOT_FOUND',
        sourceUrls: candidates.slice(0, 3),
      };
    }

    const user = [
      `Firma: ${companyName}`,
      `Niederlassung: ${branch.name}`,
      branch.city ? `Stadt-Hinweis: ${branch.city}` : null,
      '',
      'Seitentexte (nur daraus extrahieren):',
      pageParts.join('\n\n---\n\n').slice(0, MAX_PAGE_CHARS * 2),
    ]
      .filter(Boolean)
      .join('\n');

    const parsed = await this.ai.chatJson<EnrichResult>({
      system: BRANCH_ENRICH_SYSTEM_PROMPT,
      user,
      maxTokens: 800,
    });

    const status: EnrichmentStatus =
      parsed.status === 'FOUND' ||
      parsed.status === 'PARTIAL' ||
      parsed.status === 'NOT_FOUND'
        ? parsed.status
        : this.inferStatus(parsed);

    const sourceNote = usedUrls.length
      ? `Quelle: ${usedUrls.join(', ')}`
      : undefined;

    return {
      ...branch,
      addressLine1: parsed.addressLine1 || branch.addressLine1,
      addressLine2: parsed.addressLine2 || branch.addressLine2,
      postalCode: parsed.postalCode || branch.postalCode,
      city: parsed.city || branch.city,
      country: parsed.country || branch.country,
      phone: parsed.phone || branch.phone,
      email: parsed.email || branch.email,
      mapsUrl: parsed.mapsUrl || branch.mapsUrl,
      notes: [branch.notes, parsed.notes, sourceNote].filter(Boolean).join('\n'),
      enrichmentStatus: status,
      sourceUrls: usedUrls,
    };
  }

  private inferStatus(p: EnrichResult): EnrichmentStatus {
    const hasStreet = Boolean(p.addressLine1?.trim());
    const hasCity = Boolean(p.city?.trim() || p.postalCode?.trim());
    if (hasStreet && hasCity) return 'FOUND';
    if (hasStreet || hasCity || p.phone || p.email) return 'PARTIAL';
    return 'NOT_FOUND';
  }

  /**
   * Kandidaten-URLs: Firmenwebsite-Pfade + DuckDuckGo-HTML-Suche.
   */
  private async findCandidateUrls(
    companyName: string,
    website: string | undefined,
    branch: AiImportBranchDraft,
  ): Promise<string[]> {
    const urls: string[] = [];
    const base = this.normalizeWebsite(website);
    if (base) {
      const paths = [
        '',
        '/kontakt',
        '/contact',
        '/standorte',
        '/locations',
        '/niederlassungen',
        '/impressum',
      ];
      for (const p of paths) {
        urls.push(`${base}${p}`);
      }
    }

    // Domain-Hints aus Firmenname (z. B. SPIE)
    const slug = companyName.toLowerCase();
    if (slug.includes('spie')) {
      urls.push(
        'https://www.spie.de',
        'https://www.spie.de/kontakt',
        'https://www.spie.com/en/contact',
      );
    }

    const searchQuery = `${companyName} ${branch.name} Adresse Kontakt`;
    const searchUrls = await this.duckDuckGoUrls(searchQuery);
    urls.push(...searchUrls);

    // Dedup
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of urls) {
      const n = u.replace(/\/+$/, '');
      if (!seen.has(n)) {
        seen.add(n);
        out.push(u);
      }
    }
    return out.slice(0, 8);
  }

  private normalizeWebsite(website?: string): string | null {
    if (!website?.trim()) return null;
    let w = website.trim();
    if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
    try {
      const u = new URL(w);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  private async duckDuckGoUrls(query: string): Promise<string[]> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const html = await this.fetchRaw(url);
      if (!html) return [];
      const matches = [...html.matchAll(/uddg=([^&"]+)/g)];
      const urls: string[] = [];
      for (const m of matches) {
        try {
          const decoded = decodeURIComponent(m[1]);
          if (/^https?:\/\//i.test(decoded) && !/duckduckgo\.com/i.test(decoded)) {
            urls.push(decoded);
          }
        } catch {
          /* ignore */
        }
      }
      // Fallback: hrefs
      if (urls.length === 0) {
        for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
          const href = m[1];
          if (!/duckduckgo\.com/i.test(href)) urls.push(href);
        }
      }
      return urls.slice(0, 5);
    } catch (err) {
      this.logger.debug(`DDG search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchPageText(url: string): Promise<string | null> {
    const html = await this.fetchRaw(url);
    if (!html) return null;
    return this.htmlToText(html).slice(0, MAX_PAGE_CHARS);
  }

  private async fetchRaw(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'OfficeAIImport/1.0 (+https://office.vivahome.de; public lookup)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (
        ct &&
        !ct.includes('text/html') &&
        !ct.includes('text/plain') &&
        !ct.includes('application/xhtml')
      ) {
        return null;
      }
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
