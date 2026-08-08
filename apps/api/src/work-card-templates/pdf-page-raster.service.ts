import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { readFile, unlink, writeFile, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Rendert einzelne PDF-Seiten als Bilder via `pdftoppm` (poppler-utils).
 * pdf-lib kann nicht rendern → deshalb externer Rasterizer.
 *
 * Benötigt `poppler-utils` im Runtime-Container:
 *   apk add --no-cache poppler-utils  (Alpine)
 *   apt-get install -y poppler-utils  (Debian/Ubuntu)
 */
@Injectable()
export class PdfPageRasterService {
  private readonly logger = new Logger(PdfPageRasterService.name);
  private readonly DPI = 200;

  /**
   * Rendert eine bestimmte Seite eines PDFs als PNG-Buffer.
   *
   * @param pdfBuffer - Vollständiger PDF-Buffer
   * @param pageNumber - 1-basierte Seitennummer
   * @returns PNG-Bilddaten als Buffer
   */
  async rasterizePage(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
    const tempDir = await mkdtemp(join(tmpdir(), 'pdfraster-'));
    const inputPath = join(tempDir, 'input.pdf');
    const outputPrefix = join(tempDir, 'page');

    try {
      await writeFile(inputPath, pdfBuffer);

      await execFileAsync('pdftoppm', [
        '-f', String(pageNumber),
        '-l', String(pageNumber),
        '-r', String(this.DPI),
        '-png',
        '-singlefile',
        inputPath,
        outputPrefix,
      ]);

      const outputPath = `${outputPrefix}.png`;
      const imageBuffer = await readFile(outputPath);
      return imageBuffer;
    } catch (err: any) {
      if (err?.code === 'ENOENT' && err?.path === 'pdftoppm') {
        this.logger.error(
          'pdftoppm nicht gefunden – poppler-utils fehlt im Container. ' +
          'Bitte `apk add poppler-utils` (Alpine) oder ' +
          '`apt-get install poppler-utils` (Debian) im Dockerfile ergänzen.',
        );
        throw new Error(
          'pdftoppm nicht verfügbar – Server-Konfiguration prüfen (poppler-utils fehlt)',
        );
      }
      this.logger.error(`Rasterisierung Seite ${pageNumber} fehlgeschlagen: ${err.message}`);
      throw new Error(`PDF-Seite ${pageNumber} konnte nicht gerendert werden`);
    } finally {
      await this.cleanupTemp(tempDir, inputPath, outputPrefix);
    }
  }

  private async cleanupTemp(dir: string, input: string, outputPrefix: string) {
    try {
      await unlink(input).catch(() => {});
      await unlink(`${outputPrefix}.png`).catch(() => {});
      const { rmdir } = await import('fs/promises');
      await rmdir(dir).catch(() => {});
    } catch {
      // Best-effort cleanup
    }
  }
}
