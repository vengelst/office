import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../documents/storage.service';

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface OcrResult {
  text: string;
  blocks: TextBlock[];
  confidence: number;
}

interface PaddleOcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

interface PaddleOcrResponse {
  raw_text: string;
  blocks: PaddleOcrBlock[];
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly ocrUrl: string;

  constructor(private readonly storage: StorageService) {
    this.ocrUrl =
      process.env.OCR_SERVICE_URL ?? 'http://ocr-service:8000';
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    const ext = mimeType.split('/')[1] ?? 'png';
    const filename = `upload.${ext === 'jpeg' ? 'jpg' : ext}`;

    const formData = new FormData();
    const uint8 = new Uint8Array(imageBuffer.buffer, imageBuffer.byteOffset, imageBuffer.byteLength);
    formData.append('file', new Blob([uint8], { type: mimeType }), filename);

    const res = await fetch(`${this.ocrUrl}/ocr/text`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`OCR-Service Fehler: ${res.status} – ${body}`);
      throw new Error(`OCR-Service antwortet mit ${res.status}`);
    }

    const data: PaddleOcrResponse = await res.json();

    const blocks: TextBlock[] = data.blocks.map((b) => {
      const xs = b.box.map((p) => p[0]);
      const ys = b.box.map((p) => p[1]);
      return {
        text: b.text,
        confidence: b.confidence,
        boundingBox: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        },
      };
    });

    const avgConfidence =
      blocks.length > 0
        ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
        : 0;

    return { text: data.raw_text, blocks, confidence: avgConfidence };
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
