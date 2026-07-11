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

/** Einzelne extrahierte Ausschreibung vom Research-Microservice. */
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

/** Ergebnis der Ausschreibungsrecherche vom Research-Microservice. */
export interface ResearchSubmissionsResult {
  submissions: ResearchSubmission[];
  sources: string[];
  confidence: number;
}
