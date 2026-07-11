import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify, fileSlug, compactNumber, dateSlug, timeSlug } from './slug.util';

/** Ordnernamen-Mapping (DE) je Entity-Typ. */
const CATEGORY_SLUGS: Record<string, string> = {
  CUSTOMER: 'kunden',
  CONTACT: 'kunden',
  PROJECT: 'projekte',
  WORKER: 'monteure',
  VEHICLE: 'fahrzeuge',
  SUBCONTRACTOR: 'subunternehmen',
};

/** Unterordner-Mapping für DocumentType → lesbarer Ordnername. */
const FOLDER_SLUGS: Record<string, string> = {
  CONTRACT: 'vertraege',
  WORK_CONTRACT: 'vertraege',
  INVOICE: 'rechnungen',
  PHOTO: 'fotos',
  SITE_PHOTO: 'baustellenfotos',
  DELIVERY_NOTE: 'lieferscheine',
  DRAWING: 'plaene-zeichnungen',
  PROJECT_DOC: 'protokolle',
  SPECIFICATION: 'protokolle',
  HANDOVER_PROTOCOL: 'protokolle',
  PASSPORT: 'ausweise-paesse',
  ID_CARD: 'ausweise-paesse',
  WORK_PERMIT: 'ausweise-paesse',
  RESIDENCE_PERMIT: 'ausweise-paesse',
  CERTIFICATION: 'zertifikate',
  HEALTH_CERTIFICATE: 'zertifikate',
  CERTIFICATE: 'zertifikate',
  WORKER_PHOTO: 'fotos',
  BUSINESS_CARD: 'logos-visitenkarten',
  LOGO: 'logos-visitenkarten',
  NOTE_DOCUMENT: 'korrespondenz',
  REGISTRATION_DOC: 'fahrzeugschein',
  INSURANCE_DOC: 'versicherung',
  INSPECTION_DOC: 'tuev',
  OTHER: 'sonstiges',
};

export interface EntityInfo {
  slug: string;
  displayName: string;
  number: string;
}

/**
 * Service für die Generierung lesbarer und konsistenter Speicherpfade.
 * Erzeugt sowohl MinIO-Storage-Pfade als auch Google-Drive-Ordnernamen
 * basierend auf Entitätstyp, -name und Dokumentkategorie.
 */
@Injectable()
export class StoragePathService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lädt Entity-Infos (Name + Nummer) aus der DB und erzeugt einen URL-sicheren Slug.
   * Unterstützt alle Entitätstypen: Kunde, Projekt, Monteur, Fahrzeug, Subunternehmer, Kontakt.
   * Gibt bei unbekanntem Typ einen Fallback-Slug mit gekürzter UUID zurück.
   *
   * @param entityType - Entitätstyp (CUSTOMER, PROJECT, WORKER, VEHICLE, SUBCONTRACTOR, CONTACT)
   * @param entityId - UUID der Entität
   * @returns EntityInfo mit Slug, Anzeigename und Nummer
   */
  async getEntityInfo(entityType: string, entityId: string): Promise<EntityInfo> {
    switch (entityType) {
      case 'CUSTOMER': {
        const c = await this.prisma.customer.findUnique({
          where: { id: entityId },
          select: { companyName: true, customerNumber: true },
        });
        if (!c) return fallback(entityType, entityId);
        return {
          slug: `${slugify(c.companyName)}-${compactNumber(c.customerNumber)}`,
          displayName: c.companyName,
          number: c.customerNumber,
        };
      }
      case 'PROJECT': {
        const p = await this.prisma.project.findUnique({
          where: { id: entityId },
          select: { title: true, projectNumber: true },
        });
        if (!p) return fallback(entityType, entityId);
        return {
          slug: `${slugify(p.title)}-${compactNumber(p.projectNumber)}`,
          displayName: p.title,
          number: p.projectNumber,
        };
      }
      case 'WORKER': {
        const w = await this.prisma.worker.findUnique({
          where: { id: entityId },
          select: { firstName: true, lastName: true, workerNumber: true },
        });
        if (!w) return fallback(entityType, entityId);
        return {
          slug: `${slugify(w.lastName)}-${slugify(w.firstName)}-${compactNumber(w.workerNumber)}`,
          displayName: `${w.lastName}, ${w.firstName}`,
          number: w.workerNumber,
        };
      }
      case 'VEHICLE': {
        const v = await this.prisma.vehicle.findUnique({
          where: { id: entityId },
          select: { licensePlate: true, make: true, model: true },
        });
        if (!v) return fallback(entityType, entityId);
        const desc = [v.make, v.model].filter(Boolean).join(' ');
        const display = desc ? `${v.licensePlate} (${desc})` : v.licensePlate;
        return {
          slug: slugify(display),
          displayName: display,
          number: v.licensePlate,
        };
      }
      case 'SUBCONTRACTOR': {
        const s = await this.prisma.subcontractor.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        if (!s) return fallback(entityType, entityId);
        return {
          slug: slugify(s.name),
          displayName: s.name,
          number: '',
        };
      }
      case 'CONTACT': {
        const cc = await this.prisma.customerContact.findUnique({
          where: { id: entityId },
          select: { customer: { select: { companyName: true, customerNumber: true } } },
        });
        if (!cc) return fallback(entityType, entityId);
        return {
          slug: `${slugify(cc.customer.companyName)}-${compactNumber(cc.customer.customerNumber)}`,
          displayName: cc.customer.companyName,
          number: cc.customer.customerNumber,
        };
      }
      default:
        return fallback(entityType, entityId);
    }
  }

  /**
   * Generiert den lesbaren MinIO-Storage-Pfad für ein Dokument.
   * Kombiniert Kategorie-Slug, Entity-Slug, Unterordner und Dateiname.
   * Beispiel: "kunden/mueller-elektrotechnik-gmbh-K0001/vertraege/Vertrag_Mueller.pdf"
   *
   * @param entityType - Entitätstyp (CUSTOMER, PROJECT, etc.)
   * @param entityId - UUID der Entität
   * @param documentType - Dokumentkategorie (CONTRACT, INVOICE, etc.)
   * @param filename - Bereits bereinigter Dateiname
   * @returns Vollständiger relativer Storage-Pfad
   */
  async generatePath(
    entityType: string,
    entityId: string,
    documentType: string,
    filename: string,
  ): Promise<string> {
    const category = CATEGORY_SLUGS[entityType] ?? slugify(entityType);
    const entity = await this.getEntityInfo(entityType, entityId);
    const folder = FOLDER_SLUGS[documentType] ?? 'sonstiges';
    return `${category}/${entity.slug}/${folder}/${filename}`;
  }

  /**
   * Generiert den lesbaren Dateinamen für einen Stundenzettel-PDF-Export.
   * Format: "Stundenzettel_KW{Nr}_{Nachname}-{Vorname}.pdf"
   *
   * @param weekNumber - Kalenderwoche
   * @param workerLastName - Nachname des Monteurs
   * @param workerFirstName - Vorname des Monteurs
   * @returns Bereinigter Dateiname
   */
  buildTimesheetFilename(weekNumber: number, workerLastName: string, workerFirstName: string): string {
    const worker = fileSlug(`${workerLastName}-${workerFirstName}`);
    return `Stundenzettel_KW${weekNumber}_${worker}.pdf`;
  }

  /**
   * Generiert den lesbaren Dateinamen für eine Rechnungs-PDF.
   * Format: "{Rechnungsnummer}_{Partnername}.pdf"
   *
   * @param invoiceNumber - Rechnungsnummer (wird auf alphanumerische Zeichen reduziert)
   * @param partnerName - Name des Kunden/Lieferanten
   * @returns Bereinigter Dateiname
   */
  buildInvoiceFilename(invoiceNumber: string, partnerName: string): string {
    const partner = fileSlug(partnerName);
    const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '');
    return `${safeNumber}_${partner}.pdf`;
  }

  /**
   * Generiert den lesbaren Dateinamen für ein Baustellenfoto.
   * Format: "{Projekt}_{Monteur}_{Datum}_{Uhrzeit}.{ext}"
   *
   * @param projectName - Projektname
   * @param workerLastName - Nachname des Monteurs
   * @param workerFirstName - Vorname des Monteurs
   * @param date - Zeitpunkt der Aufnahme
   * @param ext - Dateierweiterung (jpg, png, etc.)
   * @returns Bereinigter Dateiname mit Zeitstempel
   */
  buildSitePhotoFilename(
    projectName: string,
    workerLastName: string,
    workerFirstName: string,
    date: Date,
    ext: string,
  ): string {
    const project = fileSlug(projectName);
    const worker = fileSlug(`${workerLastName}-${workerFirstName}`);
    return `${project}_${worker}_${dateSlug(date)}_${timeSlug(date)}.${ext}`;
  }

  /**
   * Gibt den lesbaren Drive-Anzeigenamen eines Entity-Ordners zurück.
   * Für Kunden/Projekte/Monteure wird die Nummer in eckigen Klammern angehängt.
   *
   * @param entityType - Entitätstyp
   * @param info - Entity-Infos aus getEntityInfo()
   * @returns Ordnername z.B. "Müller GmbH [K-2026-0001]"
   */
  driveEntityFolderName(entityType: string, info: EntityInfo): string {
    switch (entityType) {
      case 'WORKER':
        return `${info.displayName} [${info.number}]`;
      case 'CUSTOMER':
        return `${info.displayName} [${info.number}]`;
      case 'PROJECT':
        return `${info.displayName} [${info.number}]`;
      case 'VEHICLE':
        return info.displayName;
      case 'SUBCONTRACTOR':
        return info.displayName;
      default:
        return info.displayName;
    }
  }

  /**
   * Gibt den deutschen Kategorie-Ordnernamen für Google Drive zurück.
   * Beispiel: CUSTOMER → "Kunden", PROJECT → "Projekte"
   *
   * @param entityType - Entitätstyp
   * @returns Deutscher Kategoriename
   */
  driveCategoryName(entityType: string): string {
    const map: Record<string, string> = {
      CUSTOMER: 'Kunden',
      CONTACT: 'Kunden',
      PROJECT: 'Projekte',
      WORKER: 'Monteure',
      VEHICLE: 'Fahrzeuge',
      SUBCONTRACTOR: 'Subunternehmen',
    };
    return map[entityType] ?? entityType;
  }

  /**
   * Gibt den deutschen Unterordner-Namen für einen Dokumenttyp in Google Drive zurück.
   * Beispiel: CONTRACT → "Verträge", INVOICE → "Rechnungen"
   *
   * @param documentType - Dokumentkategorie
   * @returns Deutscher Unterordnername
   */
  driveFolderName(documentType: string): string {
    const map: Record<string, string> = {
      CONTRACT: 'Verträge',
      WORK_CONTRACT: 'Verträge',
      INVOICE: 'Rechnungen',
      PHOTO: 'Fotos',
      SITE_PHOTO: 'Baustellenfotos',
      DELIVERY_NOTE: 'Lieferscheine',
      DRAWING: 'Pläne & Zeichnungen',
      PROJECT_DOC: 'Protokolle',
      SPECIFICATION: 'Protokolle',
      HANDOVER_PROTOCOL: 'Protokolle',
      PASSPORT: 'Ausweise & Pässe',
      ID_CARD: 'Ausweise & Pässe',
      WORK_PERMIT: 'Ausweise & Pässe',
      RESIDENCE_PERMIT: 'Ausweise & Pässe',
      CERTIFICATION: 'Zertifikate',
      HEALTH_CERTIFICATE: 'Zertifikate',
      CERTIFICATE: 'Zertifikate',
      WORKER_PHOTO: 'Fotos',
      BUSINESS_CARD: 'Logos & Visitenkarten',
      LOGO: 'Logos & Visitenkarten',
      NOTE_DOCUMENT: 'Korrespondenz',
      REGISTRATION_DOC: 'Fahrzeugschein',
      INSURANCE_DOC: 'Versicherung',
      INSPECTION_DOC: 'TÜV',
      OTHER: 'Sonstiges',
    };
    return map[documentType] ?? 'Sonstiges';
  }
}

/**
 * Fallback für unbekannte Entitätstypen oder wenn der DB-Lookup fehlschlägt.
 * Erzeugt einen generischen Slug aus Typ + gekürzter UUID.
 */
function fallback(entityType: string, entityId: string): EntityInfo {
  return {
    slug: `${slugify(entityType)}-${entityId.slice(0, 8)}`,
    displayName: entityId,
    number: '',
  };
}
