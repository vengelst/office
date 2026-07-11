/**
 * Typen und API-Funktionen für das Monteur-/Personalmodul.
 * Spiegelt die Antworten der NestJS-Workers-/Subcontractors-/Teams-Endpoints wider.
 */
import { apiClient } from './api-client';

/** Beschäftigungsart: eigener Mitarbeiter oder über Subunternehmer. */
export type WorkerType = 'EMPLOYED' | 'SUBCONTRACTED';

/** Aktueller Verfügbarkeitsstatus eines Monteurs. */
export type WorkerAvailability =
  | 'AVAILABLE'
  | 'ON_PROJECT'
  | 'SICK'
  | 'VACATION'
  | 'UNAVAILABLE';

/** GER-Sprachniveau (A1–C2) oder Muttersprachler. */
export type LanguageProficiency =
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2'
  | 'C1'
  | 'C2'
  | 'NATIVE';

// ── Sub-Entities ───────────────────────────────────────────────

/** Sprachkenntnis eines Monteurs (Sprache + Niveaustufe). */
export interface WorkerLanguage {
  id: string;
  workerId: string;
  language: string;
  proficiency: LanguageProficiency;
}

/** Zertifikat/Qualifikation eines Monteurs (Name, Aussteller, Ablaufdatum). */
export interface WorkerCertification {
  id: string;
  workerId: string;
  name: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

/** Verknüpftes Projekt in einer Monteur-Zuordnung (kompakte Darstellung). */
export interface WorkerAssignmentProject {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
}

/** Zuordnung eines Monteurs zu einem Projekt (Zeitraum, Rolle, Lead-Flag). */
export interface WorkerAssignment {
  id: string;
  projectId: string;
  workerId: string;
  roleName: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  isLead: boolean;
  notes: string | null;
  project: WorkerAssignmentProject;
}

/** Team-Mitgliedschaft eines Monteurs (inkl. Beitritt-/Austrittsdatum). */
export interface WorkerTeamMembership {
  id: string;
  teamId: string;
  workerId: string;
  joinedAt: string;
  leftAt: string | null;
  role: string | null;
  team: { id: string; name: string };
}

/** Ausrüstungsgegenstand, der einem Monteur zugewiesen wurde (Ausgabe/Rückgabe). */
export interface WorkerEquipmentIssue {
  id: string;
  workerId: string;
  equipmentItemId: string;
  issuedAt: string;
  returnedAt: string | null;
  conditionOut: string | null;
  conditionIn: string | null;
  notes: string | null;
  equipmentItem?: {
    id: string;
    name: string;
    category: string;
    itemNumber: string;
  };
}

// ── Worker ─────────────────────────────────────────────────────

/** Kompakte Darstellung eines Monteurs für Listenansichten. */
export interface WorkerListItem {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  workerType: WorkerType;
  availability: WorkerAvailability;
  hourlyRate: number | null;
  phone: string | null;
  email: string | null;
  subcontractor: { id: string; name: string } | null;
  assignments: WorkerAssignment[];
}

/** Paginierte Antwort der Monteurliste. */
export interface WorkerListResponse {
  data: WorkerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Vollständiger Monteurdatensatz mit Personalien, Dokumenten, Zuordnungen und Ausrüstung. */
export interface WorkerDetail {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  nationality: string | null;
  active: boolean;
  photoPath: string | null;
  hasDriversLicense: boolean;
  notes: string | null;
  workerType: WorkerType;
  availability: WorkerAvailability;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  idNumber: string | null;
  taxNumber: string | null;
  socialSecurityNumber: string | null;
  oib: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  residencePermitNumber: string | null;
  residencePermitExpiry: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
  subcontractorId: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  shoeSize: string | null;
  clothingSize: string | null;
  createdAt: string;
  updatedAt: string;
  subcontractor: { id: string; name: string; city: string | null } | null;
  languages: WorkerLanguage[];
  certifications: WorkerCertification[];
  teamMemberships: WorkerTeamMembership[];
  assignments: WorkerAssignment[];
  currentAssignment: WorkerAssignment | null;
  equipmentIssues?: WorkerEquipmentIssue[];
}

/** Monteur mit ablaufenden Ausweisdokumenten (Reisepass, Aufenthalts-/Arbeitserlaubnis). */
export interface ExpiringDocumentWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  passportNumber: string | null;
  passportExpiry: string | null;
  residencePermitNumber: string | null;
  residencePermitExpiry: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
}

// ── Subcontractor ──────────────────────────────────────────────

/** Kompakte Darstellung eines Subunternehmers für Listenansichten. */
export type SubcontractorType = 'SUBCONTRACTOR' | 'SUPPLIER';

export interface SubcontractorListItem {
  id: string;
  name: string;
  subcontractorType: SubcontractorType;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  active: boolean;
  _count: { workers: number };
}

/** Paginierte Antwort der Subunternehmerliste. */
export interface SubcontractorListResponse {
  data: SubcontractorListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Monteur eines Subunternehmers (vereinfachte Darstellung in der Sub-Detailansicht). */
export interface SubcontractorWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  availability: WorkerAvailability;
  photoPath: string | null;
}

/** Vollständiger Subunternehmer-Datensatz mit Adresse, Bankdaten und zugehörigen Monteuren. */
export interface SubcontractorDetail {
  id: string;
  name: string;
  subcontractorType: SubcontractorType;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  taxNumber: string | null;
  vatId: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  workers: SubcontractorWorker[];
}

// ── Team ───────────────────────────────────────────────────────

/** Teamleiter (kompakt, für Anzeige in Team-Listen). */
export interface TeamLeader {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  availability: WorkerAvailability;
}

/** Kompakte Darstellung eines Teams für Listenansichten. */
export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  leader: TeamLeader | null;
  _count: { members: number };
}

/** Einzelnes Teammitglied mit Beitritts-/Austrittsinfo und Monteur-Daten. */
export interface TeamMember {
  id: string;
  teamId: string;
  workerId: string;
  joinedAt: string;
  leftAt: string | null;
  role: string | null;
  worker: TeamLeader;
}

/** Vollständiger Team-Datensatz mit Leiter und allen Mitgliedern. */
export interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  leader: TeamLeader | null;
  members: TeamMember[];
}

// ── Query-Parameter ────────────────────────────────────────────

/** Filter-, Paginierungs- und Sortierparameter für die Monteurliste. */
export interface WorkerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  availability?: string;
  subcontractorId?: string;
  teamId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Filter-, Paginierungs- und Sortierparameter für die Subunternehmerliste. */
export interface SubcontractorListParams {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── API ────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/** API-Client für Monteurverwaltung (CRUD, Sprachen, Zertifikate, PIN). */
export const workersApi = {
  /**
   * GET /workers – Listet Monteure paginiert mit optionalen Filtern.
   * @param params - Filter (Typ, Verfügbarkeit, Sub, Team) + Paginierung
   * @returns Paginierte Monteurliste
   */
  list(params: WorkerListParams): Promise<WorkerListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.type) q.set('type', params.type);
    if (params.availability) q.set('availability', params.availability);
    if (params.subcontractorId) q.set('subcontractorId', params.subcontractorId);
    if (params.teamId) q.set('teamId', params.teamId);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<WorkerListResponse>(`/workers?${q.toString()}`);
  },
  /**
   * GET /workers/:id – Lädt einen einzelnen Monteur mit allen Relationen.
   * @param id - Monteur-ID
   */
  get: (id: string) => apiClient.get<WorkerDetail>(`/workers/${id}`),
  /**
   * POST /workers – Erstellt einen neuen Monteur.
   * @param body - Monteurdaten
   */
  create: (body: unknown) => apiClient.post<WorkerDetail>('/workers', body),
  /**
   * PATCH /workers/:id – Aktualisiert einen bestehenden Monteur.
   * @param id - Monteur-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: unknown) =>
    apiClient.patch<WorkerDetail>(`/workers/${id}`, body),
  /**
   * DELETE /workers/:id – Löscht einen Monteur.
   * @param id - Monteur-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/workers/${id}`),

  /**
   * GET /workers/expiring-documents – Monteure mit bald ablaufenden Dokumenten.
   * @returns Liste von Monteuren mit ablaufenden Pässen/Genehmigungen
   */
  expiringDocuments: () =>
    apiClient.get<ExpiringDocumentWorker[]>('/workers/expiring-documents'),

  /**
   * Erzeugt die URL zum Profilbild eines Monteurs (für authentifiziertes Laden per fetch).
   * @param id - Monteur-ID
   */
  photoUrl: (id: string) => `${API_BASE_URL}/workers/${id}/photo`,

  // Sprachkenntnisse
  /**
   * GET /workers/:id/languages – Listet die Sprachkenntnisse eines Monteurs.
   * @param id - Monteur-ID
   */
  listLanguages: (id: string) =>
    apiClient.get<WorkerLanguage[]>(`/workers/${id}/languages`),
  /**
   * POST /workers/:id/languages – Fügt eine Sprachkenntnis hinzu.
   * @param id - Monteur-ID
   * @param body - Sprache und Niveaustufe
   */
  createLanguage: (id: string, body: unknown) =>
    apiClient.post<WorkerLanguage>(`/workers/${id}/languages`, body),
  /**
   * PATCH /workers/:id/languages/:langId – Aktualisiert eine Sprachkenntnis.
   * @param id - Monteur-ID
   * @param langId - Sprach-Eintrag-ID
   * @param body - Zu aktualisierende Felder
   */
  updateLanguage: (id: string, langId: string, body: unknown) =>
    apiClient.patch<WorkerLanguage>(`/workers/${id}/languages/${langId}`, body),
  /**
   * DELETE /workers/:id/languages/:langId – Löscht eine Sprachkenntnis.
   * @param id - Monteur-ID
   * @param langId - Sprach-Eintrag-ID
   */
  removeLanguage: (id: string, langId: string) =>
    apiClient.delete<unknown>(`/workers/${id}/languages/${langId}`),

  // Zertifikate
  /**
   * GET /workers/:id/certifications – Listet die Zertifikate eines Monteurs.
   * @param id - Monteur-ID
   */
  listCertifications: (id: string) =>
    apiClient.get<WorkerCertification[]>(`/workers/${id}/certifications`),
  /**
   * POST /workers/:id/certifications – Fügt ein Zertifikat hinzu.
   * @param id - Monteur-ID
   * @param body - Zertifikatsdaten
   */
  createCertification: (id: string, body: unknown) =>
    apiClient.post<WorkerCertification>(`/workers/${id}/certifications`, body),
  /**
   * PATCH /workers/:id/certifications/:certId – Aktualisiert ein Zertifikat.
   * @param id - Monteur-ID
   * @param certId - Zertifikats-ID
   * @param body - Zu aktualisierende Felder
   */
  updateCertification: (id: string, certId: string, body: unknown) =>
    apiClient.patch<WorkerCertification>(
      `/workers/${id}/certifications/${certId}`,
      body,
    ),
  /**
   * DELETE /workers/:id/certifications/:certId – Löscht ein Zertifikat.
   * @param id - Monteur-ID
   * @param certId - Zertifikats-ID
   */
  removeCertification: (id: string, certId: string) =>
    apiClient.delete<unknown>(`/workers/${id}/certifications/${certId}`),

  // PIN-Verwaltung
  /**
   * POST /workers/:id/pin – Setzt die Stempel-PIN eines Monteurs.
   * @param id - Monteur-ID
   * @param pin - Neue PIN (4–6 Ziffern)
   */
  setPin: (id: string, pin: string) =>
    apiClient.post<{ success: boolean }>(`/workers/${id}/pin`, { pin }),
  /**
   * POST /workers/:id/send-pin-email – Sendet die PIN per E-Mail an den Monteur.
   * @param id - Monteur-ID
   * @param pin - Aktuelle PIN
   */
  sendPinEmail: (id: string, pin: string) =>
    apiClient.post<{ success: boolean; error?: string }>(
      `/workers/${id}/send-pin-email`,
      { pin },
    ),
};

/** API-Client für Subunternehmerverwaltung (CRUD). */
export const subcontractorsApi = {
  /**
   * GET /subcontractors – Listet Subunternehmer paginiert mit optionalen Filtern.
   * @param params - Filter (aktiv, Suche) + Paginierung
   * @returns Paginierte Subunternehmerliste
   */
  list(params: SubcontractorListParams): Promise<SubcontractorListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.active !== undefined) q.set('active', String(params.active));
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<SubcontractorListResponse>(
      `/subcontractors?${q.toString()}`,
    );
  },
  /**
   * GET /subcontractors/:id – Lädt einen einzelnen Subunternehmer mit zugehörigen Monteuren.
   * @param id - Subunternehmer-ID
   */
  get: (id: string) =>
    apiClient.get<SubcontractorDetail>(`/subcontractors/${id}`),
  /**
   * POST /subcontractors – Erstellt einen neuen Subunternehmer.
   * @param body - Subunternehmerdaten
   */
  create: (body: unknown) =>
    apiClient.post<SubcontractorDetail>('/subcontractors', body),
  /**
   * PATCH /subcontractors/:id – Aktualisiert einen bestehenden Subunternehmer.
   * @param id - Subunternehmer-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: unknown) =>
    apiClient.patch<SubcontractorDetail>(`/subcontractors/${id}`, body),
  /**
   * DELETE /subcontractors/:id – Löscht einen Subunternehmer.
   * @param id - Subunternehmer-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/subcontractors/${id}`),
};

/** API-Client für Teamverwaltung (CRUD, Mitglieder). */
export const teamsApi = {
  /**
   * GET /teams – Listet alle Teams.
   * @returns Alle Teams mit Leiter und Mitgliederanzahl
   */
  list: () => apiClient.get<TeamListItem[]>('/teams'),
  /**
   * GET /teams/:id – Lädt ein einzelnes Team mit allen Mitgliedern.
   * @param id - Team-ID
   */
  get: (id: string) => apiClient.get<TeamDetail>(`/teams/${id}`),
  /**
   * POST /teams – Erstellt ein neues Team.
   * @param body - Teamdaten (Name, Beschreibung, Leiter)
   */
  create: (body: unknown) => apiClient.post<TeamDetail>('/teams', body),
  /**
   * PATCH /teams/:id – Aktualisiert ein bestehendes Team.
   * @param id - Team-ID
   * @param body - Zu aktualisierende Felder
   */
  update: (id: string, body: unknown) =>
    apiClient.patch<TeamDetail>(`/teams/${id}`, body),
  /**
   * DELETE /teams/:id – Löscht ein Team.
   * @param id - Team-ID
   */
  remove: (id: string) => apiClient.delete<unknown>(`/teams/${id}`),
  /**
   * POST /teams/:id/members – Fügt ein Mitglied zum Team hinzu.
   * @param id - Team-ID
   * @param body - Monteur-ID und optionale Rolle
   */
  addMember: (id: string, body: unknown) =>
    apiClient.post<TeamMember>(`/teams/${id}/members`, body),
  /**
   * DELETE /teams/:id/members/:memberId – Entfernt ein Mitglied aus dem Team.
   * @param id - Team-ID
   * @param memberId - Mitgliedschafts-ID
   */
  removeMember: (id: string, memberId: string) =>
    apiClient.delete<unknown>(`/teams/${id}/members/${memberId}`),
};

// ── Helfer ─────────────────────────────────────────────────────

/** Erzeugt den vollen Namen eines Monteurs aus Vor- und Nachname. */
export const workerFullName = (w: {
  firstName: string;
  lastName: string;
}): string => [w.firstName, w.lastName].filter(Boolean).join(' ');

/**
 * Ablauf-Status eines Datums für gelb/rot-Markierung.
 * 'expired' = abgelaufen (rot), 'soon' = < 30 Tage (gelb), 'ok' / null sonst.
 */
export type ExpiryStatus = 'expired' | 'soon' | 'ok' | null;

/**
 * Berechnet den Ablauf-Status eines Datums für die UI-Markierung.
 * @param value - ISO-Datumsstring (oder null)
 * @param windowDays - Warnfenster in Tagen (Standard: 30)
 * @returns 'expired', 'soon', 'ok' oder null wenn kein Datum vorhanden
 */
export function expiryStatus(
  value: string | null | undefined,
  windowDays = 30,
): ExpiryStatus {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return 'expired';
  if (diffDays <= windowDays) return 'soon';
  return 'ok';
}
