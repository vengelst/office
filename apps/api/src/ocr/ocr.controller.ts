import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService, OcrResult } from './ocr.service';
import { parseBusinessCard, BusinessCardData } from './business-card.parser';

@Controller('ocr')
export class OcrController {
  constructor(
    private readonly ocr: OcrService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  async extract(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<OcrResult> {
    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }
    return this.ocr.extractText(file.buffer, file.mimetype);
  }

  @Post('business-card')
  @UseInterceptors(FileInterceptor('file'))
  async businessCard(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessCardData> {
    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }
    const result = await this.ocr.extractText(file.buffer, file.mimetype);
    if (!result.text) {
      throw new BadRequestException('Kein Text erkannt');
    }
    return parseBusinessCard(result.text);
  }

  @Post('business-card/from-document/:documentId')
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
