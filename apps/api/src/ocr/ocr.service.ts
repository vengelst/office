import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import sharp from 'sharp';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { StorageService } from '../documents/storage.service';

export interface TextBlock {
  text: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface OcrResult {
  text: string;
  blocks: TextBlock[];
  confidence: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly settings: AppSettingsService,
    private readonly storage: StorageService,
  ) {}

  private async getClient(): Promise<ImageAnnotatorClient> {
    const json = await this.settings.get('google_drive_service_account_json');
    if (!json) {
      throw new Error('Service Account JSON nicht konfiguriert (AppSettings)');
    }
    const credentials = JSON.parse(json);
    return new ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    });
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    const optimized = await this.preprocess(imageBuffer, mimeType);
    const client = await this.getClient();

    const [result] = await client.textDetection({
      image: { content: optimized.toString('base64') },
    });

    const annotations = result.textAnnotations ?? [];
    if (annotations.length === 0) {
      return { text: '', blocks: [], confidence: 0 };
    }

    const fullText = annotations[0].description ?? '';
    const blocks: TextBlock[] = annotations.slice(1).map((a) => {
      const vertices = a.boundingPoly?.vertices ?? [];
      const xs = vertices.map((v) => v.x ?? 0);
      const ys = vertices.map((v) => v.y ?? 0);
      return {
        text: a.description ?? '',
        boundingBox: vertices.length >= 4
          ? {
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys),
            }
          : undefined,
      };
    });

    const pages = result.fullTextAnnotation?.pages ?? [];
    const confidence =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + (p.confidence ?? 0), 0) / pages.length
        : fullText.length > 0
          ? 0.8
          : 0;

    return { text: fullText, blocks, confidence };
  }

  async extractTextFromStorageKey(storageKey: string): Promise<OcrResult> {
    const stream = await this.storage.getStream(storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const mimeType = this.guessMimeType(storageKey);
    return this.extractText(buffer, mimeType);
  }

  private async preprocess(buffer: Buffer, mimeType: string): Promise<Buffer> {
    if (!mimeType.startsWith('image/')) {
      return buffer;
    }
    try {
      return await sharp(buffer)
        .rotate()
        .normalize()
        .sharpen()
        .toBuffer();
    } catch {
      this.logger.warn('Bildvorverarbeitung fehlgeschlagen, verwende Originalbild');
      return buffer;
    }
  }

  private guessMimeType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      pdf: 'application/pdf',
    };
    return map[ext ?? ''] ?? 'application/octet-stream';
  }
}
