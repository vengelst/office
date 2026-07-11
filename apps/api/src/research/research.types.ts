/** Extrahierte Firmendaten aus dem Research-Microservice. */
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

/** Extrahierter Ansprechpartner aus dem Research-Microservice. */
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

/** Social-Media-Profile aus dem Research-Microservice. */
export interface ResearchSocialMedia {
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  xing: string | null;
}

/** Vollständiges Recherche-Ergebnis vom Research-Microservice. */
export interface ResearchResult {
  company: ResearchCompany;
  contacts: ResearchContact[];
  socialMedia: ResearchSocialMedia;
  sources: string[];
  confidence: number;
}
