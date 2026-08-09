import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import { PdfPageRasterService } from './pdf-page-raster.service';
import {
  getPngDimensions,
  suggestFieldMappings,
} from './work-card-field-extractor';

/** Max file size for calibrate: 10 MB */
const MAX_CALIBRATE_SIZE = 10 * 1024 * 1024;

export interface CalibrateResponse {
  text: string;
  blocks: Array<{
    text: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  suggestedFields: Array<{
    target: string;
    labelHints: string[];
    regex?: string;
    sampleValue?: string;
  }>;
  /** PNG der Beispielseite als data-URL für den Zone-Editor */
  pageImageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Kalibrierung: Nimmt eine Beispielseite (Bild oder 1-Seiten-PDF),
 * führt OCR durch und liefert Rohtext + heuristische Feldvorschläge + Seitenbild.
 */
@Injectable()
export class WorkCardCalibrateService {
  private readonly logger = new Logger(WorkCardCalibrateService.name);

  constructor(
    private readonly ocr: OcrService,
    private readonly raster: PdfPageRasterService,
  ) {}

  async calibrate(file: Express.Multer.File): Promise<CalibrateResponse> {
    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen (Feld "file")');
    }
    if (file.size > MAX_CALIBRATE_SIZE) {
      throw new BadRequestException(
        `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. 10 MB)`,
      );
    }

    let imageBuffer: Buffer;
    let mimeType: string;

    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      this.logger.log('Calibrate: PDF → rasterize Seite 1');
      imageBuffer = await this.raster.rasterizePage(file.buffer, 1);
      mimeType = 'image/png';
    } else if (file.mimetype.startsWith('image/')) {
      imageBuffer = file.buffer;
      mimeType = file.mimetype;
    } else {
      throw new BadRequestException(
        `Nur Bilder oder PDF erlaubt (erhalten: ${file.mimetype})`,
      );
    }

    // Für Zone-Editor brauchen wir PNG-Maße; Nicht-PNG → als PNG aus OCR-Pfad nicht nötig,
    // Maße nur wenn PNG (Raster) oder aus raw buffer lesen wenn möglich.
    let imageWidth = 0;
    let imageHeight = 0;
    let pageImageDataUrl: string;

    if (mimeType === 'image/png') {
      const dims = getPngDimensions(imageBuffer);
      imageWidth = dims.width;
      imageHeight = dims.height;
      pageImageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } else {
      // JPEG/WebP: data-URL ohne IHDR-Maße – Client nutzt naturalWidth/Height
      pageImageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    }

    const ocrResult = await this.ocr.extractText(imageBuffer, mimeType);
    const suggestedFields = suggestFieldMappings(ocrResult.text);

    return {
      text: ocrResult.text,
      blocks: ocrResult.blocks,
      suggestedFields,
      pageImageDataUrl,
      imageWidth,
      imageHeight,
    };
  }
}
