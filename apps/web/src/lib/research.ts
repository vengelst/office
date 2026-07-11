/**
 * API-Client und Typen für die Firmenrecherche.
 * Kommuniziert mit dem NestJS-Backend, das als Proxy zum Research-Microservice dient.
 */
import { apiClient } from './api-client';

/** Extrahierte Firmendaten. */
export interface ResearchCompany {
  companyName: string | null;
  legalForm: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  vatId: string | null;
  taxNumber: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}

/** Extrahierter Ansprechpartner. */
export interface ResearchContact {
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  department: string | null;
  email: string | null;
  phoneMobile: string | null;
  phoneLandline: string | null;
  linkedInUrl: string | null;
}

/** Social-Media-Profile. */
export interface ResearchSocialMedia {
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  xing: string | null;
}

/** Vollständiges Recherche-Ergebnis. */
export interface ResearchResult {
  company: ResearchCompany;
  contacts: ResearchContact[];
  socialMedia: ResearchSocialMedia;
  sources: string[];
  confidence: number;
}

/** Einzelne extrahierte Ausschreibung. */
export interface ResearchSubmission {
  title: string | null;
  description: string | null;
  reference: string | null;
  deadline: string | null;
  startDate: string | null;
  endDate: string | null;
  value: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requirements: string | null;
  source: string | null;
}

/** Ergebnis der Ausschreibungsrecherche. */
export interface ResearchSubmissionsResult {
  submissions: ResearchSubmission[];
  sources: string[];
  confidence: number;
}

/** API-Client für die Firmenrecherche. */
export const researchApi = {
  /**
   * Recherchiert Firmendaten anhand einer Website-URL.
   * @param url - Website-URL der Firma
   * @param includeSocialMedia - Social-Media-Profile einbeziehen (Standard: true)
   */
  lookup: (url: string, includeSocialMedia = true) =>
    apiClient.post<ResearchResult>('/research/company', {
      url,
      includeSocialMedia,
    }),

  /**
   * Recherchiert Ausschreibungen anhand einer Website-URL.
   * @param url - URL der Ausschreibungsseite
   */
  lookupSubmissions: (url: string) =>
    apiClient.post<ResearchSubmissionsResult>('/research/submissions', { url }),
};
