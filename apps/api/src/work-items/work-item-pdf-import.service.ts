import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { UploadDocumentDto } from '../documents/dto/upload-document.dto';
import { OcrService } from '../ocr/ocr.service';
import { PdfPageRasterService } from '../work-card-templates/pdf-page-raster.service';
import { extractWorkCardFields } from '../work-card-templates/work-card-field-extractor';
import type { WorkCardFieldMapping } from '../work-card-templates/work-card-field.types';
import { WorkItemsService } from './work-items.service';
import { PdfImportCommitDto, PdfImportItemDto, PdfImportPreviewDto } from './dto/pdf-import.dto';

/** Maximale Seitenanzahl je PDF (Schutz vor Missbrauch). */
const MAX_PDF_PAGES = 200;

/** Maximale Dateigröße für PDFs: 50 MB. */
const MAX_PDF_SIZE = 50 * 1024 * 1024;

/** Ein Item in der Vorschau-Antwort. */
export interface PdfPreviewItem {
  pdfPage: number;
  itemKey: string;
  title: string;
  workScopeDe: string | null;
  workScopeSk: string | null;
  floor: string | null;
  room: string | null;
  conflicts: string[];
  ocrWarnings: string[];
}

/** Antwort des Preview-Endpunkts. */
export interface PdfPreviewResponse {
  pageCount: number;
  blockKey: string;
  items: PdfPreviewItem[];
  warnings: string[];
}

/** Antwort des Commit-Endpunkts. */
export interface PdfCommitResponse {
  itemsCreated: number;
  itemsUpdated: number;
  blockId: string;
  documentId: string | null;
}

/**
 * PDF-Primärimport: Ein Mehrseiten-PDF wird je Seite als ein Work Item angelegt.
 * (SPEZ-arbeitsitems.md §10, Minimal-Modus ohne OCR/Template)
 */
@Injectable()
export class WorkItemPdfImportService {
  private readonly logger = new Logger(WorkItemPdfImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
    private readonly documentsService: DocumentsService,
    private readonly ocrService: OcrService,
    private readonly rasterService: PdfPageRasterService,
  ) {}

  /**
   * Zählt die Seiten eines PDF-Buffers.
   * @throws BadRequestException bei ungültigem PDF oder 0 Seiten
   */
  async getPageCount(buffer: Buffer): Promise<number> {
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = pdf.getPageCount();
      if (count === 0) {
        throw new BadRequestException('PDF hat keine Seiten');
      }
      return count;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Ungültiges PDF – Datei konnte nicht gelesen werden');
    }
  }

  /**
   * Vorschau: Erzeugt die geplanten Items ohne zu schreiben.
   */
  async preview(
    projectId: string,
    file: Express.Multer.File | undefined,
    dto: PdfImportPreviewDto,
  ): Promise<PdfPreviewResponse> {
    await this.workItems.ensureProject(projectId);
    const buffer = this.validatePdfFile(file);
    const pageCount = await this.getPageCount(buffer);

    const startPage = dto.startPage ?? 1;
    const endPage = Math.min(dto.endPage ?? pageCount, pageCount);

    if (startPage > endPage) {
      throw new BadRequestException(
        `startPage (${startPage}) darf nicht größer als endPage (${endPage}) sein`,
      );
    }
    if (endPage > MAX_PDF_PAGES) {
      throw new BadRequestException(
        `PDF hat ${pageCount} Seiten – maximal ${MAX_PDF_PAGES} unterstützt`,
      );
    }

    const prefix = dto.itemKeyPrefix ?? 'Seite-';
    const digits = String(endPage).length;
    const warnings: string[] = [];

    const existing = await this.prisma.workItem.findMany({
      where: { projectId },
      select: { itemKey: true },
    });
    const existingKeys = new Set(existing.map((i) => i.itemKey));

    // OCR nur wenn explizit extract=true UND gültige templateId
    // (Vorschau ohne OCR bleibt schnell; UI kann OCR separat anstoßen)
    let fieldMappings: WorkCardFieldMapping[] | null = null;
    const templateId =
      dto.templateId && dto.templateId !== 'none' ? dto.templateId : undefined;
    const useExtraction = Boolean(templateId && dto.extract === true);
    if (useExtraction && templateId) {
      const template = await this.prisma.workCardTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        throw new BadRequestException(`Template ${templateId} nicht gefunden`);
      }
      fieldMappings = template.fields as unknown as WorkCardFieldMapping[];
    }

    const items: PdfPreviewItem[] = [];
    const OCR_CONCURRENCY = 3;

    if (fieldMappings) {
      // OCR-Extraktion je Seite (sequentiell in kleinen Batches)
      const pages = Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => startPage + i,
      );

      for (let i = 0; i < pages.length; i += OCR_CONCURRENCY) {
        const batch = pages.slice(i, i + OCR_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((page) => this.extractFieldsForPage(buffer, page, fieldMappings!)),
        );

        for (let j = 0; j < batch.length; j++) {
          const page = batch[j];
          const result = results[j];
          const fallbackKey = `${prefix}${String(page).padStart(digits, '0')}`;
          const ocrWarnings: string[] = [];

          let itemKey = fallbackKey;
          let title = `Seite ${page}`;
          let workScopeDe: string | null = null;
          let workScopeSk: string | null = null;
          let floor: string | null = null;
          let room: string | null = null;

          if (result.status === 'fulfilled') {
            const { fields, warnings: w } = result.value;
            ocrWarnings.push(...w);
            if (fields.itemKey) itemKey = fields.itemKey;
            if (fields.title) title = fields.title;
            if (fields.workScopeDe) workScopeDe = fields.workScopeDe;
            if (fields.workScopeSk) workScopeSk = fields.workScopeSk;
            if (fields.floor) floor = fields.floor;
            if (fields.room) room = fields.room;
          } else {
            ocrWarnings.push(`OCR-Fehler Seite ${page}: ${result.reason?.message ?? 'unbekannt'}`);
            warnings.push(`OCR fehlgeschlagen auf Seite ${page} – Fallback auf Platzhalter`);
          }

          const conflicts: string[] = [];
          if (existingKeys.has(itemKey)) {
            conflicts.push('existiert bereits – Commit würde upserten');
            warnings.push(`itemKey ${itemKey} existiert bereits – Commit würde upserten`);
          }

          items.push({
            pdfPage: page,
            itemKey,
            title,
            workScopeDe,
            workScopeSk,
            floor,
            room,
            conflicts,
            ocrWarnings,
          });
        }
      }
    } else {
      // Ohne Template: bisheriges Verhalten (Minimal-Modus)
      for (let page = startPage; page <= endPage; page++) {
        const itemKey = `${prefix}${String(page).padStart(digits, '0')}`;
        const conflicts: string[] = [];
        if (existingKeys.has(itemKey)) {
          conflicts.push('existiert bereits – Commit würde upserten');
          warnings.push(`itemKey ${itemKey} existiert bereits – Commit würde upserten`);
        }
        items.push({
          pdfPage: page,
          itemKey,
          title: `Seite ${page}`,
          workScopeDe: null,
          workScopeSk: null,
          floor: null,
          room: null,
          conflicts,
          ocrWarnings: [],
        });
      }
    }

    return {
      pageCount,
      blockKey: dto.blockKey,
      items,
      warnings,
    };
  }

  /**
   * Commit: Schreibt die Items in die DB, speichert das PDF als Document.
   */
  async commit(
    projectId: string,
    file: Express.Multer.File | undefined,
    dto: PdfImportCommitDto,
    userId: string | null,
  ): Promise<PdfCommitResponse> {
    await this.workItems.ensureProject(projectId);

    this.validateCommitItems(dto.items);

    let documentId = dto.pdfDocumentId ?? null;
    let pdfFileName: string | null = null;

    if (file) {
      const buffer = this.validatePdfFile(file);
      const pageCount = await this.getPageCount(buffer);
      const maxPage = Math.max(...dto.items.map((i) => i.pdfPage));
      if (maxPage > pageCount) {
        throw new BadRequestException(
          `pdfPage ${maxPage} überschreitet PDF-Seitenzahl (${pageCount})`,
        );
      }

      const uploadDto = new UploadDocumentDto();
      uploadDto.documentType = DocumentType.DRAWING;
      uploadDto.entityType = 'PROJECT';
      uploadDto.entityId = projectId;
      uploadDto.title = file.originalname;

      const doc = await this.documentsService.upload(file, uploadDto, userId);
      documentId = doc.id;
      pdfFileName = file.originalname;
    } else if (!dto.pdfDocumentId) {
      throw new BadRequestException(
        'Entweder PDF-Datei hochladen oder pdfDocumentId angeben',
      );
    } else {
      const existingDoc = await this.prisma.document.findUnique({
        where: { id: dto.pdfDocumentId },
        select: { originalFilename: true },
      });
      if (!existingDoc) {
        throw new BadRequestException(`Document ${dto.pdfDocumentId} nicht gefunden`);
      }
      pdfFileName = existingDoc.originalFilename;
    }

    let itemsCreated = 0;
    let itemsUpdated = 0;
    let blockId = '';

    await this.prisma.$transaction(async (tx) => {
      // Block upsert
      const block = await tx.projectBlock.upsert({
        where: { projectId_blockKey: { projectId, blockKey: dto.blockKey } },
        update: {
          ...(dto.blockName ? { name: dto.blockName } : {}),
          ...(documentId ? { pdfDocumentId: documentId } : {}),
        },
        create: {
          projectId,
          blockKey: dto.blockKey,
          name: dto.blockName ?? null,
          pdfDocumentId: documentId,
        },
        select: { id: true },
      });
      blockId = block.id;

      // Bestandsabgleich
      const existing = await tx.workItem.findMany({
        where: { projectId },
        select: { id: true, itemKey: true },
      });
      const existingByKey = new Map(existing.map((i) => [i.itemKey, i.id]));

      const importedAt = new Date();

      for (const item of dto.items) {
        const data: Record<string, any> = {
          blockId: block.id,
          title: item.title ?? `Seite ${item.pdfPage}`,
          pdfPage: item.pdfPage,
          pdfFile: pdfFileName,
          workScopeDe: item.workScopeDe ?? null,
          workScopeSk: item.workScopeSk ?? null,
          importedAt,
        };
        if (item.floor) data.floor = item.floor;
        if (item.room) data.room = item.room;

        if (existingByKey.has(item.itemKey)) {
          await tx.workItem.update({
            where: { projectId_itemKey: { projectId, itemKey: item.itemKey } },
            data,
          });
          itemsUpdated++;
        } else {
          await tx.workItem.create({
            data: {
              ...data,
              projectId,
              itemKey: item.itemKey,
            },
          });
          itemsCreated++;
        }
      }

      // Projekt auf itemBased setzen
      if (dto.setItemBased !== false) {
        await tx.project.update({
          where: { id: projectId },
          data: { itemBased: true },
        });
      }
    });

    this.logger.log(
      `PDF-Import Projekt ${projectId}: ${itemsCreated} neu, ${itemsUpdated} aktualisiert, Block ${dto.blockKey}`,
    );

    return { itemsCreated, itemsUpdated, blockId, documentId };
  }

  // ── Helfer ───────────────────────────────────────────────────

  /** Rasterisiert eine PDF-Seite und extrahiert Felder via OCR + Template-Mapping. */
  private async extractFieldsForPage(
    pdfBuffer: Buffer,
    pageNumber: number,
    mappings: WorkCardFieldMapping[],
  ) {
    const imageBuffer = await this.rasterService.rasterizePage(pdfBuffer, pageNumber);
    const ocrResult = await this.ocrService.extractText(imageBuffer, 'image/png');
    return extractWorkCardFields(ocrResult, mappings);
  }

  /** Validiert Multipart-PDF-Datei und gibt den Buffer zurück. */
  private validatePdfFile(file: Express.Multer.File | undefined): Buffer {
    if (!file) {
      throw new BadRequestException(
        'Keine PDF-Datei übermittelt (Multipart-Feld "file")',
      );
    }
    if (file.size > MAX_PDF_SIZE) {
      throw new BadRequestException(
        `PDF-Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. ${MAX_PDF_SIZE / 1024 / 1024} MB)`,
      );
    }
    if (
      file.mimetype !== 'application/pdf' &&
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException(
        `Nur PDF-Dateien erlaubt (erhalten: ${file.mimetype})`,
      );
    }
    return file.buffer;
  }

  /** Validiert die Item-Liste des Commits. */
  private validateCommitItems(items: PdfImportItemDto[]): void {
    if (items.length === 0) {
      throw new BadRequestException('Mindestens ein Item erforderlich');
    }
    if (items.length > MAX_PDF_PAGES) {
      throw new BadRequestException(
        `Zu viele Items (${items.length}, max. ${MAX_PDF_PAGES})`,
      );
    }

    const keys = new Set<string>();
    const pages = new Set<number>();
    for (const item of items) {
      if (keys.has(item.itemKey)) {
        throw new BadRequestException(
          `Doppelte itemKey "${item.itemKey}" in der Commit-Liste`,
        );
      }
      keys.add(item.itemKey);
      if (pages.has(item.pdfPage)) {
        throw new BadRequestException(
          `Doppelte pdfPage ${item.pdfPage} in der Commit-Liste`,
        );
      }
      pages.add(item.pdfPage);
    }
  }
}
