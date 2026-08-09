/**
 * Stundenzettel-Workflow: Submit, Approve, Reject, Archive, Sign, PDF-Export.
 */

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  SignerType,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { DocumentsService } from '../documents/documents.service';
import { StoragePathService } from '../common/storage-path.service';
import { EmailService } from '../email/email.service';
import { TimesheetPdfService } from './pdf.service';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import {
  EDITABLE_STATUSES,
  FINAL_STATUSES,
  detailInclude,
  decodeBase64Png,
  type SignatureMeta,
} from './timesheet-shared';

@Injectable()
export class TimesheetWorkflowService {
  private readonly logger = new Logger(TimesheetWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentsService: DocumentsService,
    private readonly storagePathService: StoragePathService,
    private readonly pdfService: TimesheetPdfService,
    private readonly emailService: EmailService,
  ) {}

  private async findOne(id: string) {
    const timesheet = await this.prisma.weeklyTimesheet.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!timesheet) {
      throw new NotFoundException('Stundenzettel nicht gefunden');
    }
    return timesheet;
  }

  // ── Workflow ─────────────────────────────────────────────────

  /**
   * Reicht einen Stundenzettel zur Prüfung ein (DRAFT/REJECTED → SUBMITTED).
   *
   * @param id - UUID des Stundenzettels
   * @returns Der aktualisierte Stundenzettel
   */
  async submit(id: string) {
    const sheet = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Nur Entwürfe oder zurückgewiesene Stundenzettel können eingereicht werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.SUBMITTED,
        submittedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    return this.findOne(id);
  }

  /**
   * Genehmigt einen eingereichten Stundenzettel (SUBMITTED → APPROVED).
   * Löst asynchron den PDF-Export aus.
   *
   * @param id - UUID des Stundenzettels
   * @param userId - ID des genehmigenden Benutzers
   * @returns Der genehmigte Stundenzettel
   */
  async approve(id: string, userId: string | null) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.SUBMITTED) {
      throw new ConflictException(
        'Nur eingereichte Stundenzettel können genehmigt werden',
      );
    }
    const now = new Date();
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.APPROVED,
        reviewedAt: now,
        approvedAt: now,
        reviewedByUserId: userId,
        approvedByUserId: userId,
      },
    });

    // PDF-Export (async, non-blocking).
    this.exportTimesheetPdf(id, sheet, userId)
      .catch((err) => this.logger.warn(`Stundenzettel-PDF-Export fehlgeschlagen: ${(err as Error).message}`));

    return this.findOne(id);
  }

  /**
   * Generiert PDF, speichert in MinIO und erstellt Document-Eintrag. Genehmigt ein Kunden-PL mit aktiver Projektzuordnung, wird das PDF zusätzlich an `notificationEmail ?? user.email` gesendet. E-Mail-Fehler werden nur geloggt und blockieren den Approve nicht.
   */
  private async exportTimesheetPdf(
    timesheetId: string,
    sheet: {
      weekNumber: number;
      weekYear: number;
      worker: { id: string; firstName: string; lastName: string };
      project: { id: string; projectNumber: string; title: string };
    },
    userId: string | null,
  ): Promise<void> {
    const { buffer } = await this.pdfService.generate(timesheetId);
    const filename = this.storagePathService.buildTimesheetFilename(
      sheet.weekNumber,
      sheet.worker.lastName,
      sheet.worker.firstName,
    );
    const storagePath = await this.storagePathService.generatePath(
      'PROJECT',
      sheet.project.id,
      'PROJECT_DOC',
      filename,
    );
    const readablePath = storagePath.replace(/\/protokolle\//, '/stundenzettel/');

    await this.documentsService.createFromBuffer({
      buffer,
      filename,
      mimeType: 'application/pdf',
      documentType: DocumentType.PROJECT_DOC,
      entityType: 'PROJECT',
      entityId: sheet.project.id,
      storagePath: readablePath,
      title: `Stundenzettel KW${sheet.weekNumber} ${sheet.worker.lastName}`,
      userId,
    });

    await this.sendTimesheetPdfToCustomerPl(sheet, userId, buffer, filename);
  }

  /**
   * Sendet das genehmigte Stundenzettel-PDF an den genehmigenden Kunden-PL, sofern eine aktive Zuordnung am Projekt existiert. Fehler werden geloggt, nicht geworfen.
   */
  private async sendTimesheetPdfToCustomerPl(
    sheet: {
      weekNumber: number;
      weekYear: number;
      worker: { firstName: string; lastName: string };
      project: { id: string; projectNumber: string; title: string };
    },
    userId: string | null,
    buffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (!userId) return;

    try {
      const assignment = await this.prisma.projectCustomerPlAssignment.findFirst({
        where: {
          projectId: sheet.project.id,
          userId,
          active: true,
        },
        select: {
          notificationEmail: true,
          user: { select: { email: true, displayName: true } },
        },
      });
      if (!assignment) return;

      const to = assignment.notificationEmail?.trim() || assignment.user.email;
      if (!to) {
        this.logger.warn(
          `Stundenzettel-PDF: keine Zustell-E-Mail für Kunden-PL ${userId}`,
        );
        return;
      }

      const workerName = `${sheet.worker.firstName} ${sheet.worker.lastName}`.trim();
      const subject = `Stundenzettel KW${sheet.weekNumber}/${sheet.weekYear} – ${workerName}`;
      const html = `<div style="font-family: sans-serif; padding: 20px; max-width: 560px;">
  <h2 style="color: #333;">Stundenzettel abgezeichnet</h2>
  <p>Hallo ${assignment.user.displayName},</p>
  <p>der Stundenzettel wurde abgezeichnet und liegt als PDF bei.</p>
  <ul style="color: #444; line-height: 1.6;">
    <li><strong>Projekt:</strong> ${sheet.project.projectNumber} – ${sheet.project.title}</li>
    <li><strong>Monteur:</strong> ${workerName}</li>
    <li><strong>Woche:</strong> KW ${sheet.weekNumber}/${sheet.weekYear}</li>
  </ul>
  <p style="color: #666; font-size: 12px; margin-top: 24px;">Diese E-Mail wurde automatisch von Office generiert.</p>
</div>`;

      const result = await this.emailService.send(to, subject, html, [
        {
          filename,
          content: buffer,
          contentType: 'application/pdf',
        },
      ]);
      if (!result.success) {
        this.logger.warn(
          `Stundenzettel-PDF-Mail fehlgeschlagen (${to}): ${result.error ?? 'unbekannt'}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Stundenzettel-PDF-Mail fehlgeschlagen: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Weist einen eingereichten Stundenzettel mit Begründung zurück (SUBMITTED → REJECTED).
   *
   * @param id - UUID des Stundenzettels
   * @param reason - Begründung für die Zurückweisung
   * @param userId - ID des prüfenden Benutzers
   * @returns Der zurückgewiesene Stundenzettel
   */
  async reject(id: string, reason: string, userId: string | null) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.SUBMITTED) {
      throw new ConflictException(
        'Nur eingereichte Stundenzettel können zurückgewiesen werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
    return this.findOne(id);
  }

  // ── Archivieren ─────────────────────────────────────────────

  /**
   * Archiviert einen genehmigten Stundenzettel (APPROVED → ARCHIVED).
   *
   * @param id - UUID des Stundenzettels
   * @returns Der archivierte Stundenzettel
   */
  async archive(id: string) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.APPROVED) {
      throw new ConflictException(
        'Nur genehmigte Stundenzettel können archiviert werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: { status: WeeklyTimesheetStatus.ARCHIVED },
    });
    return this.findOne(id);
  }

  // ── Unterschrift ─────────────────────────────────────────────

  /**
   * Fügt eine digitale Unterschrift (Base64-PNG) zum Stundenzettel hinzu.
   * Ersetzt ggf. eine bestehende Unterschrift desselben Typs.
   * Bei Worker-Signatur im DRAFT-Status → automatischer Übergang zu WORKER_SIGNED.
   *
   * @param id - UUID des Stundenzettels
   * @param dto - Signatur-Daten (Base64, Typ, Name)
   * @param meta - IP-Adresse und Geräte-Info des Unterzeichners
   * @returns Der aktualisierte Stundenzettel
   */
  async sign(id: string, dto: SignTimesheetDto, meta: SignatureMeta) {
    const sheet = await this.findOne(id);
    if (FINAL_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Stundenzettel ist abgeschlossen – keine Unterschrift mehr möglich',
      );
    }

    const buffer = decodeBase64Png(dto.signatureBase64);
    const storageKey = `timesheets/${id}/signatures/${dto.signerType}.png`;
    await this.storage.upload(storageKey, buffer, 'image/png');

    // Bestehende Unterschrift desselben Typs ersetzen.
    await this.prisma.weeklyTimesheetSignature.deleteMany({
      where: { weeklyTimesheetId: id, signerType: dto.signerType },
    });
    await this.prisma.weeklyTimesheetSignature.create({
      data: {
        weeklyTimesheetId: id,
        signerType: dto.signerType,
        signerName: dto.signerName,
        signerRole: dto.signerRole,
        signatureImagePath: storageKey,
        ipAddress: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
      },
    });

    // Status-Übergang bei Monteur-Unterschrift im Entwurf.
    if (
      dto.signerType === SignerType.WORKER &&
      sheet.status === WeeklyTimesheetStatus.DRAFT
    ) {
      await this.prisma.weeklyTimesheet.update({
        where: { id },
        data: { status: WeeklyTimesheetStatus.WORKER_SIGNED },
      });
    }

    return this.findOne(id);
  }
}

