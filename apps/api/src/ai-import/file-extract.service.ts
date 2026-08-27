/**
 * Extrahiert Text aus PDF / Excel / CSV / TXT für den KI-Import.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { Workbook } from 'exceljs';

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_CHARS = 120_000;

@Injectable()
export class FileExtractService {
  private readonly logger = new Logger(FileExtractService.name);

  /**
   * Extrahiert Text aus einer hochgeladenen Datei.
   */
  async extract(
    file: Express.Multer.File,
  ): Promise<{ text: string; truncated: boolean }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Keine Datei übermittelt');
    }
    if (file.size > MAX_FILE_BYTES || file.buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Datei zu groß (max. ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB)`,
      );
    }

    const name = file.originalname || 'upload';
    const lower = name.toLowerCase();
    let text: string;

    if (lower.endsWith('.pdf') || file.mimetype === 'application/pdf') {
      text = await this.extractPdf(file.buffer);
    } else if (
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xlsm') ||
      lower.endsWith('.xls')
    ) {
      text = await this.extractExcel(file.buffer);
    } else if (lower.endsWith('.csv')) {
      text = await this.extractCsv(file.buffer);
    } else if (
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      file.mimetype?.startsWith('text/')
    ) {
      text = file.buffer.toString('utf8');
    } else {
      throw new BadRequestException(
        `Nicht unterstütztes Format: ${name} (erlaubt: PDF, Excel, CSV, TXT, MD)`,
      );
    }

    text = text.replace(/\u0000/g, '').trim();
    if (!text) {
      if (lower.endsWith('.pdf')) {
        throw new BadRequestException(
          'PDF ohne extrahierbaren Text (kein Textlayer). Bitte Text-PDF oder Excel/CSV verwenden.',
        );
      }
      throw new BadRequestException('Datei enthält keinen Text');
    }

    if (text.length > MAX_CHARS) {
      this.logger.warn(
        `Text auf ${MAX_CHARS} Zeichen gekürzt (war ${text.length})`,
      );
      return { text: text.slice(0, MAX_CHARS), truncated: true };
    }
    return { text, truncated: false };
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'ai-import-pdf-'));
    const pdfPath = join(dir, 'input.pdf');
    const txtPath = join(dir, 'output.txt');
    try {
      await writeFile(pdfPath, buffer);
      try {
        await execFileAsync(
          'pdftotext',
          ['-layout', '-enc', 'UTF-8', pdfPath, txtPath],
          { timeout: 60_000 },
        );
      } catch (err) {
        this.logger.error(`pdftotext failed: ${(err as Error).message}`);
        throw new BadRequestException(
          'PDF-Textextraktion fehlgeschlagen (pdftotext)',
        );
      }
      return await readFile(txtPath, 'utf8');
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async extractExcel(buffer: Buffer): Promise<string> {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const parts: string[] = [];
    for (const sheet of workbook.worksheets) {
      parts.push(`# Sheet: ${sheet.name}`);
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const v = cell.text ?? String(cell.value ?? '');
          cells.push(v.replace(/\t|\n/g, ' ').trim());
        });
        if (cells.some((c) => c)) {
          parts.push(cells.join('\t'));
        }
      });
      parts.push('');
    }
    return parts.join('\n');
  }

  private async extractCsv(buffer: Buffer): Promise<string> {
    return buffer.toString('utf8');
  }
}
