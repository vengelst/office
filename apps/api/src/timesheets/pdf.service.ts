import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { isoWeekRange } from './timesheet.util';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

@Injectable()
export class TimesheetPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Erzeugt den Wochenstundenzettel als PDF-Buffer. */
  async generate(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const sheet = await this.prisma.weeklyTimesheet.findUnique({
      where: { id },
      include: {
        worker: true,
        project: { include: { customer: true } },
        days: { orderBy: { workDate: 'asc' } },
        signatures: true,
      },
    });
    if (!sheet) {
      throw new NotFoundException('Stundenzettel nicht gefunden');
    }

    const { start, end } = isoWeekRange(sheet.weekYear, sheet.weekNumber);

    // Signatur-Bilder vorab laden (Storage ist asynchron).
    const signatureImages = await this.loadSignatures(sheet.signatures);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(18).text('Wochenstundenzettel', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444');
    doc.text(
      `Projekt: ${sheet.project.title} (${sheet.project.projectNumber})`,
    );
    doc.text(`Kunde: ${sheet.project.customer.companyName}`);
    doc.text(
      `Monteur: ${sheet.worker.firstName} ${sheet.worker.lastName} (${sheet.worker.workerNumber})`,
    );
    doc.text(
      `KW ${sheet.weekNumber}/${sheet.weekYear}  ·  ${formatDate(start)} – ${formatDate(end)}`,
    );
    doc.text(`Status: ${sheet.status}`);
    doc.fillColor('#000').moveDown(0.8);

    // ── Tabelle ─────────────────────────────────────────────
    const cols = [
      { label: 'Tag', width: 70 },
      { label: 'Datum', width: 75 },
      { label: 'Beginn', width: 65 },
      { label: 'Ende', width: 65 },
      { label: 'Brutto', width: 65 },
      { label: 'Pause', width: 65 },
      { label: 'Netto', width: 65 },
    ];
    const startX = doc.x;
    let y = doc.y;

    this.drawRow(
      doc,
      startX,
      y,
      cols,
      cols.map((c) => c.label),
      true,
    );
    y += 20;

    // Tage der Woche – auch leere Tage anzeigen.
    const dayMap = new Map<string, (typeof sheet.days)[number]>();
    for (const d of sheet.days) {
      dayMap.set(dateKey(d.workDate), d);
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      const day = dayMap.get(dateKey(date));
      const values = [
        WEEKDAYS[i],
        formatDate(date),
        day?.firstClockInAt ? formatTime(day.firstClockInAt) : '–',
        day?.lastClockOutAt ? formatTime(day.lastClockOutAt) : '–',
        formatMinutes(day?.grossMinutes),
        formatMinutes(day?.breakMinutes),
        formatMinutes(day?.netMinutes),
      ];
      this.drawRow(doc, startX, y, cols, values, false);
      y += 18;
    }

    // ── Summenzeile ─────────────────────────────────────────
    y += 4;
    this.drawRow(
      doc,
      startX,
      y,
      cols,
      [
        'Summe',
        '',
        '',
        '',
        formatMinutes(sheet.totalMinutesGross),
        formatMinutes(sheet.totalBreakMinutes),
        formatMinutes(sheet.totalMinutesNet),
      ],
      true,
    );
    y += 30;

    // ── Unterschriften ──────────────────────────────────────
    doc.y = y;
    doc.x = startX;
    doc.fontSize(12).text('Unterschriften');
    doc.moveDown(0.5);

    const sigY = doc.y;
    const boxWidth = 230;
    this.drawSignatureBox(
      doc,
      startX,
      sigY,
      boxWidth,
      'Monteur',
      signatureImages.WORKER,
      sheet.signatures.find((s) => s.signerType === 'WORKER'),
    );
    this.drawSignatureBox(
      doc,
      startX + boxWidth + 30,
      sigY,
      boxWidth,
      'Vorarbeiter',
      signatureImages.SUPERVISOR ?? signatureImages.CUSTOMER,
      sheet.signatures.find(
        (s) => s.signerType === 'SUPERVISOR' || s.signerType === 'CUSTOMER',
      ),
    );

    doc.end();
    const buffer = await done;
    const filename = `Stundenzettel_${sheet.worker.lastName}_KW${sheet.weekNumber}-${sheet.weekYear}.pdf`;
    return { buffer, filename };
  }

  // ── intern ───────────────────────────────────────────────────

  private drawRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    cols: Array<{ width: number }>,
    values: string[],
    bold: boolean,
  ): void {
    doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    let cx = x;
    for (let i = 0; i < cols.length; i++) {
      doc.text(values[i] ?? '', cx + 2, y + 4, {
        width: cols[i].width - 4,
        ellipsis: true,
      });
      cx += cols[i].width;
    }
    const totalWidth = cols.reduce((s, c) => s + c.width, 0);
    doc
      .moveTo(x, y + 17)
      .lineTo(x + totalWidth, y + 17)
      .strokeColor('#ccc')
      .stroke();
    doc.font('Helvetica').fillColor('#000');
  }

  private drawSignatureBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    label: string,
    image: Buffer | null,
    signature?: { signerName: string; signedAt: Date },
  ): void {
    const height = 90;
    doc.rect(x, y, width, height).strokeColor('#999').stroke();
    if (image) {
      try {
        doc.image(image, x + 8, y + 8, {
          fit: [width - 16, height - 30],
          align: 'center',
        });
      } catch {
        /* ungültiges Bild ignorieren */
      }
    }
    doc.fontSize(8).fillColor('#000');
    const caption = signature
      ? `${label}: ${signature.signerName} · ${formatDate(signature.signedAt)}`
      : `${label}: ____________________`;
    doc.text(caption, x + 4, y + height + 4, { width });
  }

  private async loadSignatures(
    signatures: Array<{ signerType: string; signatureImagePath: string }>,
  ): Promise<Record<string, Buffer>> {
    const result: Record<string, Buffer> = {};
    for (const sig of signatures) {
      try {
        const stream = await this.storage.getStream(sig.signatureImagePath);
        result[sig.signerType] = await streamToBuffer(stream);
      } catch {
        /* fehlendes Signatur-Objekt überspringen */
      }
    }
    return result;
  }
}

// ── Hilfsfunktionen ────────────────────────────────────────────

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function formatMinutes(minutes?: number | null): string {
  if (minutes == null) return '–';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${`${m}`.padStart(2, '0')} h`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}
