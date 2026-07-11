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
  text: string;
  blocks: PaddleOcrBlock[];
}

/**
 * Service für optische Zeichenerkennung (OCR).
 * Kommuniziert mit dem externen PaddleOCR-Microservice um Text aus Bildern zu extrahieren.
 * Liefert erkannten Text, einzelne Textblöcke mit Positionsdaten und Konfidenzwerte.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly ocrUrl: string;

  constructor(private readonly storage: StorageService) {
    this.ocrUrl =
      process.env.OCR_SERVICE_URL ?? 'http://ocr-service:8000';
  }

  /**
   * Extrahiert Text aus einem Bild-Buffer via PaddleOCR-Service.
   * Sendet das Bild als FormData an den OCR-Microservice und
   * transformiert die Antwort in ein einheitliches OcrResult-Format.
   *
   * @param imageBuffer - Bilddaten als Buffer
   * @param mimeType - MIME-Type des Bildes (image/jpeg, image/png, etc.)
   * @returns Erkannter Text, Textblöcke mit Bounding-Boxes und Durchschnitts-Konfidenz
   * @throws Error wenn der OCR-Service einen Fehler zurückgibt
   */
  async extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    const ext = mimeType.split('/')[1] ?? 'png';
    const filename = `upload.${ext === 'jpeg' ? 'jpg' : ext}`;

    const formData = new FormData();
    const arrayBuf = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength,
    ) as ArrayBuffer;
    formData.append('file', new Blob([arrayBuf], { type: mimeType }), filename);

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

    return { text: data.text, blocks, confidence: avgConfidence };
  }

  /**
   * Extrahiert Text aus einer bereits in MinIO gespeicherten Datei.
   * Lädt die Datei aus dem Storage, bestimmt den MIME-Type anhand der Dateiendung
   * und delegiert an extractText().
   *
   * @param storageKey - MinIO-Speicherschlüssel der Datei
   * @returns OCR-Ergebnis mit extrahiertem Text
   */
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

  /**
   * Ermittelt den MIME-Type anhand der Dateiendung im Storage-Key.
   * Fallback: application/octet-stream für unbekannte Endungen.
   *
   * @param key - Datei-Schlüssel oder Pfad mit Endung
   * @returns MIME-Type-String
   */
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
