import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import type { Readable } from 'node:stream';
import { AppSettingsService } from '../app-settings/app-settings.service';

const DRIVE_KEYS = [
  'google_drive_enabled',
  'google_drive_folder_id',
  'google_drive_service_account_json',
  'google_drive_impersonate_email',
] as const;

export interface DriveConfig {
  enabled: boolean;
  folderId: string;
  serviceAccountJson: string;
  impersonateEmail: string;
}

export interface DriveUploadResult {
  fileId: string;
  folderId: string;
  webViewLink?: string;
}

/**
 * Service für die Google-Drive-Integration.
 * Verwaltet Authentifizierung, Ordnerstruktur und Datei-Upload/-Organisation
 * über Domain-Wide Delegation mit einem Service Account.
 */
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private readonly settings: AppSettingsService) {}

  /**
   * Liest die aktuelle Google-Drive-Konfiguration aus den App-Einstellungen.
   *
   * @returns Konfigurationsobjekt mit Aktivierungsstatus, Ordner-ID, SA-JSON und Impersonation-E-Mail
   */
  async getConfig(): Promise<DriveConfig> {
    const vals = await this.settings.getMany([...DRIVE_KEYS]);
    return {
      enabled: vals.google_drive_enabled === 'true',
      folderId: vals.google_drive_folder_id ?? '',
      serviceAccountJson: vals.google_drive_service_account_json ?? '',
      impersonateEmail: vals.google_drive_impersonate_email ?? '',
    };
  }

  /**
   * Speichert die Google-Drive-Konfiguration in den App-Einstellungen.
   *
   * @param config - Neue Konfiguration (Aktivierung, Ordner-ID, SA-JSON, E-Mail)
   */
  async saveConfig(config: DriveConfig): Promise<void> {
    await this.settings.setMany({
      google_drive_enabled: String(config.enabled),
      google_drive_folder_id: config.folderId,
      google_drive_service_account_json: config.serviceAccountJson,
      google_drive_impersonate_email: config.impersonateEmail,
    });
  }

  /**
   * Prüft ob die Google-Drive-Integration aktiviert ist.
   *
   * @returns true wenn Drive-Sync aktiviert ist
   */
  async isEnabled(): Promise<boolean> {
    const val = await this.settings.get('google_drive_enabled');
    return val === 'true';
  }

  /**
   * Authentifiziert sich bei der Google Drive API.
   * Nutzt JWT mit Domain-Wide Delegation (Impersonation) wenn konfiguriert,
   * ansonsten direktes Service-Account-Auth.
   *
   * @returns Authentifizierte Drive-API-Instanz
   * @throws Error wenn Service Account nicht konfiguriert ist
   */
  private async authenticate(): Promise<drive_v3.Drive> {
    const config = await this.getConfig();
    if (!config.serviceAccountJson) {
      throw new Error('Google Drive Service Account nicht konfiguriert');
    }
    const credentials = JSON.parse(config.serviceAccountJson);

    if (config.impersonateEmail) {
      const jwtClient = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/drive'],
        subject: config.impersonateEmail,
      });
      return google.drive({ version: 'v3', auth: jwtClient });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Testet die Verbindung zu Google Drive durch einen Probe-Request auf den Root-Ordner.
   * Wird im Frontend-Settings-Panel verwendet um die Konfiguration zu validieren.
   *
   * @returns Erfolgsstatus und ggf. Fehlermeldung
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const drive = await this.authenticate();
      const config = await this.getConfig();
      await drive.files.list({
        q: `'${config.folderId}' in parents`,
        pageSize: 1,
        fields: 'files(id, name)',
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      return { success: false, error: message };
    }
  }

  /**
   * Lädt eine einzelne Datei in einen Google-Drive-Ordner hoch.
   * Gibt null zurück wenn Drive deaktiviert ist oder der Upload fehlschlägt.
   *
   * @param fileBuffer - Dateiinhalt als Buffer
   * @param fileName - Anzeigename der Datei in Drive
   * @param mimeType - MIME-Type der Datei
   * @param parentFolderId - Zielordner-ID (optional, nutzt Root wenn nicht angegeben)
   * @returns Objekt mit fileId und webViewLink, oder null bei Fehler
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    parentFolderId?: string,
  ): Promise<{ fileId: string; webViewLink?: string } | null> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return null;

      const drive = await this.authenticate();
      const { Readable: ReadableStream } = await import('node:stream');
      const stream = new ReadableStream();
      stream.push(fileBuffer);
      stream.push(null);

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId ?? config.folderId],
        },
        media: {
          mimeType,
          body: stream as unknown as Readable,
        },
        fields: 'id, webViewLink',
      });

      return {
        fileId: response.data.id ?? '',
        webViewLink: response.data.webViewLink ?? undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Google Drive Upload fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Hochladen mit automatischer Ordnerstruktur.
   * Erstellt Kategorie → Entity → Unterordner und lädt die Datei dort hoch.
   */
  async uploadWithStructure(
    fileBuffer: Buffer,
    mimeType: string,
    categoryName: string,
    entityFolderName: string,
    subFolderName: string,
    readableFilename: string,
  ): Promise<DriveUploadResult | null> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return null;

      const drive = await this.authenticate();
      const rootFolderId = config.folderId;

      const categoryFolderId = await this.findOrCreateFolder(drive, categoryName, rootFolderId);
      if (!categoryFolderId) return null;

      const entityFolderId = await this.findOrCreateFolder(drive, entityFolderName, categoryFolderId);
      if (!entityFolderId) return null;

      const subFolderId = await this.findOrCreateFolder(drive, subFolderName, entityFolderId);
      if (!subFolderId) return null;

      const result = await this.uploadFile(fileBuffer, readableFilename, mimeType, subFolderId);
      if (!result) return null;

      return {
        fileId: result.fileId,
        folderId: subFolderId,
        webViewLink: result.webViewLink,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Google Drive Upload (structured) fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Erstellt einen neuen Ordner in Google Drive.
   *
   * @param name - Ordnername
   * @param parentFolderId - Übergeordneter Ordner (optional, nutzt Root wenn nicht angegeben)
   * @returns Die ID des erstellten Ordners, oder null bei Fehler
   */
  async createFolder(
    name: string,
    parentFolderId?: string,
  ): Promise<string | null> {
    try {
      const config = await this.getConfig();
      const drive = await this.authenticate();

      const response = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId ?? config.folderId],
        },
        fields: 'id',
      });

      return response.data.id ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Google Drive Ordner-Erstellung fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Erstellt einen Drive-Shortcut (Verknüpfung) auf eine Datei in einem Zielordner.
   * Wird für Monteur-Foto-Verknüpfungen verwendet.
   */
  async createShortcut(fileId: string, targetFolderId: string): Promise<string | null> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return null;

      const drive = await this.authenticate();
      const response = await drive.files.create({
        requestBody: {
          shortcutDetails: { targetId: fileId },
          mimeType: 'application/vnd.google-apps.shortcut',
          parents: [targetFolderId],
        },
        fields: 'id',
      });

      return response.data.id ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Drive Shortcut-Erstellung fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Setzt Benutzerberechtigungen auf eine Datei oder einen Ordner in Google Drive.
   * Sendet keine Benachrichtigungs-E-Mail an den berechtigten Benutzer.
   *
   * @param fileOrFolderId - Google-Drive-ID der Datei/des Ordners
   * @param email - E-Mail-Adresse des Benutzers der berechtigt wird
   * @param role - Berechtigungsstufe ('writer' oder 'reader')
   * @returns true bei Erfolg, false bei Fehler
   */
  async setPermissions(
    fileOrFolderId: string,
    email: string,
    role: 'writer' | 'reader',
  ): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return false;

      const drive = await this.authenticate();
      await drive.permissions.create({
        fileId: fileOrFolderId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
        sendNotificationEmail: false,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Drive Berechtigung fehlgeschlagen: ${message}`);
      return false;
    }
  }

  /**
   * Stellt die Ordnerstruktur für eine Entität sicher (erstellt Ordner bei Bedarf).
   * Struktur: Root → Kategorie (z.B. "Kunden") → Entity-Ordner (z.B. "Müller GmbH").
   *
   * @param entityType - Entitätstyp (CUSTOMER, PROJECT, WORKER, etc.)
   * @param entityId - UUID der Entität
   * @param entityName - Anzeigename für den Entitäts-Ordner
   * @returns Die ID des Entity-Ordners, oder null bei Fehler/Deaktivierung
   */
  async ensureFolderStructure(
    entityType: string,
    entityId: string,
    entityName: string,
  ): Promise<string | null> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return null;

      const drive = await this.authenticate();
      const rootFolderId = config.folderId;

      const categoryMap: Record<string, string> = {
        CUSTOMER: 'Kunden',
        PROJECT: 'Projekte',
        WORKER: 'Monteure',
        VEHICLE: 'Fahrzeuge',
        SUBCONTRACTOR: 'Subunternehmen',
      };

      const categoryName = categoryMap[entityType] ?? entityType;

      const categoryFolderId = await this.findOrCreateFolder(
        drive,
        categoryName,
        rootFolderId,
      );
      if (!categoryFolderId) return null;

      const entityFolderId = await this.findOrCreateFolder(
        drive,
        entityName,
        categoryFolderId,
      );
      return entityFolderId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Ordnerstruktur fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Stellt eine vollständige Unterordner-Hierarchie sicher und gibt die Unterordner-ID zurück.
   */
  async ensureSubfolderStructure(
    categoryName: string,
    entityFolderName: string,
    subFolderName: string,
  ): Promise<string | null> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return null;

      const drive = await this.authenticate();
      const rootFolderId = config.folderId;

      const categoryFolderId = await this.findOrCreateFolder(drive, categoryName, rootFolderId);
      if (!categoryFolderId) return null;

      const entityFolderId = await this.findOrCreateFolder(drive, entityFolderName, categoryFolderId);
      if (!entityFolderId) return null;

      return this.findOrCreateFolder(drive, subFolderName, entityFolderId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`Unterordner-Struktur fehlgeschlagen: ${message}`);
      return null;
    }
  }

  /**
   * Initialisiert die Hauptordner-Struktur in Google Drive (Kunden, Projekte, Monteure, etc.).
   * Idempotent: bereits existierende Ordner werden nicht erneut angelegt.
   *
   * @returns Objekt mit Listen der erstellten und bereits vorhandenen Ordner
   * @throws Error wenn Google Drive nicht aktiviert ist
   */
  async initMainFolders(): Promise<{ created: string[]; existing: string[] }> {
    const config = await this.getConfig();
    if (!config.enabled) throw new Error('Google Drive ist nicht aktiviert');

    const drive = await this.authenticate();
    const rootId = config.folderId;
    const folders = ['Kunden', 'Projekte', 'Monteure', 'Fahrzeuge', 'Subunternehmen'];
    const created: string[] = [];
    const existing: string[] = [];

    for (const name of folders) {
      const query = `name='${name}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const result = await drive.files.list({ q: query, fields: 'files(id)', pageSize: 1 });
      if (result.data.files && result.data.files.length > 0) {
        existing.push(name);
      } else {
        await drive.files.create({
          requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
          fields: 'id',
        });
        created.push(name);
      }
    }

    return { created, existing };
  }

  /**
   * Sucht einen Ordner nach Name im übergeordneten Ordner oder erstellt ihn falls nicht vorhanden.
   * Kernbaustein für die idempotente Ordnerstruktur-Verwaltung.
   *
   * @param drive - Authentifizierte Drive-API-Instanz
   * @param name - Gesuchter/zu erstellender Ordnername
   * @param parentId - ID des übergeordneten Ordners
   * @returns Die ID des gefundenen/erstellten Ordners, oder null bei Fehler
   */
  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    name: string,
    parentId: string,
  ): Promise<string | null> {
    const query = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const existing = await drive.files.list({
      q: query,
      fields: 'files(id)',
      pageSize: 1,
    });

    if (existing.data.files && existing.data.files.length > 0) {
      return existing.data.files[0].id ?? null;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    return created.data.id ?? null;
  }
}
