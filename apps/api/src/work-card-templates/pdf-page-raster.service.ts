/**
 * Service für Pdf Page Raster.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { readFile, unlink, writeFile, mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Temporäre Raster-Session: PDF einmal schreiben, Seiten sequentiell rendern.
 */
export interface PdfRasterSession {
  /**
   * Rendert eine PDF-Seite als Rasterbild.
   *
   * @param pageNumber - 1-basierte PDF-Seitennummer (number)
   * @returns Bildpuffer (Buffer)
   */
  rasterizePage(pageNumber: number): Promise<Buffer>;
  /**
   * Gibt native Ressourcen frei.
   *
   * @returns void (void)
   */
  dispose(): Promise<void>;
}

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
   * Rendert eine bestimmte Seite eines PDFs als PNG-Buffer. Für Einzelaufrufe (Kalibrierung). Bei vielen Seiten `createSession` nutzen.
   *
   * @param pdfBuffer - PDF als Buffer (Buffer)
   * @param pageNumber - 1-basierte PDF-Seitennummer (number)
   * @returns Bildpuffer (Buffer)
   */
  async rasterizePage(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
    const session = await this.createSession(pdfBuffer);
    try {
      return await session.rasterizePage(pageNumber);
    } finally {
      await session.dispose();
    }
  }

  /**
   * Schreibt das PDF einmal in ein Temp-Verzeichnis und erlaubt mehrere Seiten-Rasterisierungen ohne den Buffer erneut zu schreiben.
   *
   * @param pdfBuffer - PDF als Buffer (Buffer)
   * @returns PdfRasterSession
   */
  async createSession(pdfBuffer: Buffer): Promise<PdfRasterSession> {
    const tempDir = await mkdtemp(join(tmpdir(), 'pdfraster-'));
    const inputPath = join(tempDir, 'input.pdf');
    await writeFile(inputPath, pdfBuffer);

    let disposed = false;
    const outputFiles = new Set<string>();

    const rasterizePage = async (pageNumber: number): Promise<Buffer> => {
      if (disposed) {
        throw new Error('Raster-Session bereits geschlossen');
      }
      const outputPrefix = join(tempDir, `page-${pageNumber}`);
      try {
        await execFileAsync('pdftoppm', [
          '-f',
          String(pageNumber),
          '-l',
          String(pageNumber),
          '-r',
          String(this.DPI),
          '-png',
          '-singlefile',
          inputPath,
          outputPrefix,
        ]);

        const outputPath = `${outputPrefix}.png`;
        outputFiles.add(outputPath);
        return await readFile(outputPath);
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
        this.logger.error(
          `Rasterisierung Seite ${pageNumber} fehlgeschlagen: ${err.message}`,
        );
        throw new Error(`PDF-Seite ${pageNumber} konnte nicht gerendert werden`);
      }
    };

    const dispose = async (): Promise<void> => {
      if (disposed) return;
      disposed = true;
      try {
        await unlink(inputPath).catch(() => {});
        for (const f of outputFiles) {
          await unlink(f).catch(() => {});
        }
        await rmdir(tempDir).catch(() => {});
      } catch {
        // Best-effort cleanup
      }
    };

    return { rasterizePage, dispose };
  }
}
