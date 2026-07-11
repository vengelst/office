import { Injectable, Logger } from '@nestjs/common';
import type { ResearchResult, ResearchSubmissionsResult } from './research.types';

/**
 * Service zur Kommunikation mit dem Research-Microservice.
 * Leitet Recherche-Anfragen als HTTP-Proxy weiter und behandelt Timeouts/Fehler.
 */
@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private readonly serviceUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.serviceUrl =
      process.env.RESEARCH_SERVICE_URL || 'http://research-service:8000';
    this.apiKey = process.env.RESEARCH_API_KEY || '';
  }

  /**
   * Recherchiert Firmendaten anhand einer Website-URL via Research-Microservice.
   *
   * @param url - Website-URL der Firma
   * @param includeSocialMedia - Ob Social-Media-Profile einbezogen werden sollen
   * @returns Strukturiertes Recherche-Ergebnis
   * @throws Error bei Timeout, Service-Ausfall oder API-Fehler
   */
  async researchCompany(
    url: string,
    includeSocialMedia: boolean,
  ): Promise<ResearchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(
        `${this.serviceUrl}/research/company`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify({
            url,
            include_social_media: includeSocialMedia,
            language: 'de',
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `Research-Service Fehler: ${response.status} – ${body}`,
        );
        throw new Error(
          `Research-Service antwortet mit Status ${response.status}`,
        );
      }

      return (await response.json()) as ResearchResult;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Research-Service Timeout (120s überschritten)');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Recherchiert Ausschreibungen anhand einer Website-URL via Research-Microservice.
   *
   * @param url - Website-URL für die Ausschreibungssuche
   * @returns Extrahierte Ausschreibungen
   * @throws Error bei Timeout, Service-Ausfall oder API-Fehler
   */
  async researchSubmissions(url: string): Promise<ResearchSubmissionsResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(
        `${this.serviceUrl}/research/submissions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify({ url, language: 'de' }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `Research-Service Fehler: ${response.status} – ${body}`,
        );
        throw new Error(
          `Research-Service antwortet mit Status ${response.status}`,
        );
      }

      return (await response.json()) as ResearchSubmissionsResult;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Research-Service Timeout (120s überschritten)');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
