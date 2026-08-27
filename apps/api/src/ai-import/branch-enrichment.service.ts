/**
 * Web-Anreicherung von Niederlassungen: öffentliche Seiten fetchen + KI-Extraktion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import {
  mergeEnrichmentIntoBranch,
  type EnrichmentLlmResult,
} from './branch-merge.util';
import { BRANCH_ENRICH_SYSTEM_PROMPT } from './prompt';
import type { AiImportBranchDraft } from './types';

const MAX_PARALLEL = 6;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PAGE_CHARS = 14_000;
const MAX_PAGES_TO_LLM = 3;

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
            const { branch: enriched, warnings: w } = await this.enrichOne(
              opts.companyName,
              opts.website,
              branch,
            );
            results[i] = enriched;
            warnings.push(...w);
            if (enriched.enrichmentStatus === 'NOT_FOUND') {
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
  ): Promise<{ branch: AiImportBranchDraft; warnings: string[] }> {
    const candidates = await this.findCandidateUrls(
      companyName,
      website,
      branch,
    );
    this.logger.debug(
      `NL „${branch.name}“ (${branch.key}): ${candidates.length} URL-Kandidaten`,
    );

    if (candidates.length === 0) {
      return {
        branch: { ...branch, enrichmentStatus: 'NOT_FOUND', sourceUrls: [] },
        warnings: [],
      };
    }

    const pageParts: string[] = [];
    const usedUrls: string[] = [];
    const tried: string[] = [];

    for (const url of candidates) {
      if (usedUrls.length >= MAX_PAGES_TO_LLM) break;
      tried.push(url);
      const text = await this.fetchPageText(url);
      if (text) {
        usedUrls.push(url);
        pageParts.push(`URL: ${url}\n${text}`);
      }
    }

    this.logger.debug(
      `NL „${branch.name}“: versucht=${tried.length}, geladen=${usedUrls.length}, status-pending`,
    );

    if (pageParts.length === 0) {
      return {
        branch: {
          ...branch,
          enrichmentStatus: 'NOT_FOUND',
          sourceUrls: tried.slice(0, MAX_PAGES_TO_LLM),
        },
        warnings: [],
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

    let parsed: EnrichmentLlmResult;
    try {
      parsed = await this.ai.chatJson<EnrichmentLlmResult>({
        system: BRANCH_ENRICH_SYSTEM_PROMPT,
        user,
        maxTokens: 800,
      });
    } catch (err) {
      this.logger.warn(
        `NL „${branch.name}“: KI-Parse fehlgeschlagen – ${(err as Error).message}`,
      );
      return {
        branch: {
          ...branch,
          enrichmentStatus: 'NOT_FOUND',
          sourceUrls: usedUrls,
        },
        warnings: [
          `Niederlassung „${branch.name}“: KI-Antwort ungültig – keine Adressen übernommen.`,
        ],
      };
    }

    const merged = mergeEnrichmentIntoBranch(branch, parsed, usedUrls);
    this.logger.debug(
      `NL „${branch.name}“: URLs=${usedUrls.join(' | ') || '—'} → ${merged.branch.enrichmentStatus}`,
    );
    return merged;
  }

  /**
   * Kandidaten-URLs: generische Standort-Pfade aus Website + Stadt/NL-Name,
   * optional SPIE-Extras, plus DuckDuckGo-HTML-Suche.
   */
  private async findCandidateUrls(
    companyName: string,
    website: string | undefined,
    branch: AiImportBranchDraft,
  ): Promise<string[]> {
    const urls: string[] = [];
    const base = this.normalizeWebsite(website);
    const citySlug = this.slugify(
      branch.city || this.guessCityFromBranchName(branch.name) || '',
    );
    const nameSlug = this.slugify(branch.name);

    if (base) {
      const staticPaths = [
        '',
        '/kontakt',
        '/contact',
        '/standorte',
        '/locations',
        '/niederlassungen',
        '/impressum',
        '/ueber-uns/standorte',
        '/about/locations',
      ];
      for (const p of staticPaths) {
        urls.push(`${base}${p}`);
      }

      // Generische Standort-URL-Kandidaten aus Stadt / NL-Name
      if (citySlug) {
        for (const p of [
          `/standorte/${citySlug}`,
          `/locations/${citySlug}`,
          `/niederlassungen/${citySlug}`,
          `/kontakt/${citySlug}`,
          `/contact/${citySlug}`,
          `/${citySlug}`,
        ]) {
          urls.push(`${base}${p}`);
        }
      }
      if (nameSlug && nameSlug !== citySlug) {
        for (const p of [
          `/standorte/${nameSlug}`,
          `/locations/${nameSlug}`,
          `/${nameSlug}`,
        ]) {
          urls.push(`${base}${p}`);
        }
      }
    }

    // Domain-Hints aus Firmenname (zusätzlich, nicht einzige Strategie)
    const slug = companyName.toLowerCase();
    if (slug.includes('spie')) {
      urls.push(
        'https://www.spie.de',
        'https://www.spie.de/kontakt',
        'https://www.spie.com/en/contact',
      );
      if (citySlug) {
        urls.push(
          `https://www.spie.de/standorte/${citySlug}`,
          `https://www.spie.de/kontakt/${citySlug}`,
        );
      }
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
    return out.slice(0, 12);
  }

  private guessCityFromBranchName(name: string): string | undefined {
    const m = name.match(/[–-]\s*(.+)$/);
    if (!m) return undefined;
    return m[1].replace(/\s*\/\s*.*$/, '').trim() || undefined;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
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
          if (
            /^https?:\/\//i.test(decoded) &&
            !/duckduckgo\.com/i.test(decoded)
          ) {
            urls.push(decoded);
          }
        } catch {
          /* ignore */
        }
      }
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
