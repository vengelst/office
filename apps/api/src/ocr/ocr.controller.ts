import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService, OcrResult } from './ocr.service';
import { parseBusinessCard, BusinessCardData } from './business-card.parser';

const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/pdf',
];

function validateOcrFile(file: Express.Multer.File | undefined): void {
  if (!file) {
    throw new BadRequestException('Keine Datei hochgeladen');
  }
  if (file.size > MAX_OCR_FILE_SIZE) {
    throw new PayloadTooLargeException(
      `Datei zu groß (max. ${MAX_OCR_FILE_SIZE / 1024 / 1024} MB)`,
    );
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Ungültiger Dateityp: ${file.mimetype}. Erlaubt: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }
}

@ApiTags('ocr')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER')
@Controller('ocr')
export class OcrController {
  constructor(
    private readonly ocr: OcrService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('extract')
  @ApiOperation({ summary: 'Text per OCR aus einem Bild/PDF extrahieren' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_OCR_FILE_SIZE } }),
  )
  async extract(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<OcrResult> {
    validateOcrFile(file);
    return this.ocr.extractText(file!.buffer, file!.mimetype);
  }

  @Post('business-card')
  @ApiOperation({ summary: 'Visitenkarte scannen und Kontaktdaten extrahieren' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_OCR_FILE_SIZE } }),
  )
  async businessCard(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessCardData> {
    validateOcrFile(file);
    const result = await this.ocr.extractText(file!.buffer, file!.mimetype);
    if (!result.text) {
      throw new BadRequestException('Kein Text erkannt');
    }
    return parseBusinessCard(result.text);
  }

  @Post('business-card/from-document/:documentId')
  @ApiOperation({ summary: 'Visitenkarte aus bestehendem Dokument scannen' })
  async businessCardFromDocument(
    @Param('documentId') documentId: string,
  ): Promise<BusinessCardData> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new BadRequestException('Dokument nicht gefunden');
    }
    if (!doc.storageKey) {
      throw new BadRequestException('Dokument hat keinen Storage-Key');
    }
    const result = await this.ocr.extractTextFromStorageKey(doc.storageKey);
    if (!result.text) {
      throw new BadRequestException('Kein Text erkannt');
    }
    return parseBusinessCard(result.text);
  }
}
