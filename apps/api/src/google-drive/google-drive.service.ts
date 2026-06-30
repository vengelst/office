import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import type { Readable } from 'node:stream';
import { AppSettingsService } from '../app-settings/app-settings.service';

const DRIVE_KEYS = [
  'google_drive_enabled',
  'google_drive_folder_id',
  'google_drive_service_account_json',
] as const;

export interface DriveConfig {
  enabled: boolean;
  folderId: string;
  serviceAccountJson: string;
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private readonly settings: AppSettingsService) {}

  async getConfig(): Promise<DriveConfig> {
    const vals = await this.settings.getMany([...DRIVE_KEYS]);
    return {
      enabled: vals.google_drive_enabled === 'true',
      folderId: vals.google_drive_folder_id ?? '',
      serviceAccountJson: vals.google_drive_service_account_json ?? '',
    };
  }

  async saveConfig(config: DriveConfig): Promise<void> {
    await this.settings.setMany({
      google_drive_enabled: String(config.enabled),
      google_drive_folder_id: config.folderId,
      google_drive_service_account_json: config.serviceAccountJson,
    });
  }

  async isEnabled(): Promise<boolean> {
    const val = await this.settings.get('google_drive_enabled');
    return val === 'true';
  }

  private async authenticate(): Promise<drive_v3.Drive> {
    const config = await this.getConfig();
    if (!config.serviceAccountJson) {
      throw new Error('Google Drive Service Account nicht konfiguriert');
    }
    const credentials = JSON.parse(config.serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

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
