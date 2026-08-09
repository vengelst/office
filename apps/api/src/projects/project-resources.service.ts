/**
 * Projekt-Ressourcen: Standorte, Equipment, E-Mail-Verteiler, Notizen.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { CreateEmailRecipientDto } from './dto/create-email-recipient.dto';
import { UpdateEmailRecipientDto } from './dto/update-email-recipient.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { coerceDate } from './project-shared';

@Injectable()
export class ProjectResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sites ────────────────────────────────────────────────────

  /**
   * Liefert alle Standorte eines Projekts.
   *
   * @param projectId - UUID des Projekts
   * @returns Array der Standorte, sortiert nach Reihenfolge
   */
  async findSites(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Erstellt einen neuen Standort für ein Projekt.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateSiteDto)
   * @returns Neuer Standort
   */
  async createSite(projectId: string, dto: CreateSiteDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.create({ data: { ...dto, projectId } });
  }

  /**
   * Aktualisiert einen bestehenden Standort.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSiteDto)
   * @returns Aktualisierter Standort
   */
  async updateSite(projectId: string, id: string, dto: UpdateSiteDto) {
    await this.ensureSite(projectId, id);
    return this.prisma.projectSite.update({ where: { id }, data: dto });
  }

  /**
   * Löscht einen Standort.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis
   */
  async removeSite(projectId: string, id: string) {
    await this.ensureSite(projectId, id);
    await this.prisma.projectSite.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Equipment ────────────────────────────────────────────────

  /**
   * Liefert alle Geräte/Ausstattung eines Projekts.
   *
   * @param projectId - ID des Projekts (string)
   * @returns Equipment-Liste
   */
  async findEquipment(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEquipment.findMany({
      where: { projectId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Fügt ein Gerät zu einem Projekt hinzu.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateEquipmentDto)
   * @returns Neues Equipment
   */
  async createEquipment(projectId: string, dto: CreateEquipmentDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectEquipment.create({
      data: {
        ...dto,
        projectId,
        issuedAt: coerceDate(dto.issuedAt) ?? undefined,
        returnedAt: coerceDate(dto.returnedAt) ?? undefined,
      },
    });
  }

  /**
   * Aktualisiert ein bestehendes Gerät.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateEquipmentDto)
   * @returns Aktualisiertes Equipment
   */
  async updateEquipment(projectId: string, id: string, dto: UpdateEquipmentDto) {
    await this.ensureEquipment(projectId, id);
    return this.prisma.projectEquipment.update({
      where: { id },
      data: {
        ...dto,
        issuedAt: coerceDate(dto.issuedAt) ?? undefined,
        returnedAt: coerceDate(dto.returnedAt),
      },
    });
  }

  /**
   * Entfernt ein Gerät aus dem Projekt.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis
   */
  async removeEquipment(projectId: string, id: string) {
    await this.ensureEquipment(projectId, id);
    await this.prisma.projectEquipment.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── E-Mail-Verteiler ─────────────────────────────────────────

  /**
   * Liefert alle E-Mail-Verteiler-Empfänger eines Projekts.
   *
   * @param projectId - ID des Projekts (string)
   */
  async findEmailRecipients(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.findMany({
      where: { projectId },
      orderBy: { recipientType: 'asc' },
    });
  }

  /**
   * Fügt einen neuen Empfänger zum E-Mail-Verteiler des Projekts hinzu.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateEmailRecipientDto)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async createEmailRecipient(projectId: string, dto: CreateEmailRecipientDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.create({
      data: { ...dto, projectId },
    });
  }

  /**
   * Aktualisiert einen bestehenden E-Mail-Empfänger.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateEmailRecipientDto)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async updateEmailRecipient(
    projectId: string,
    id: string,
    dto: UpdateEmailRecipientDto,
  ) {
    await this.ensureEmailRecipient(projectId, id);
    return this.prisma.projectEmailRecipient.update({ where: { id }, data: dto });
  }

  /**
   * Entfernt einen Empfänger aus dem E-Mail-Verteiler.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async removeEmailRecipient(projectId: string, id: string) {
    await this.ensureEmailRecipient(projectId, id);
    await this.prisma.projectEmailRecipient.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Notizen ──────────────────────────────────────────────────

  /**
   * Liefert alle Notizen eines Projekts, sortiert nach Erstellungsdatum (neueste zuerst).
   *
   * @param projectId - ID des Projekts (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async findNotes(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  /**
   * Erstellt eine neue Notiz für ein Projekt (mit Benutzer-Zuordnung).
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateNoteDto)
   * @param userId - ID (userId) (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async createNote(projectId: string, dto: CreateNoteDto, userId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.create({
      data: { projectId, body: dto.body, createdByUserId: userId },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  /**
   * Löscht eine Projektnotiz.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async removeNote(projectId: string, id: string) {
    const count = await this.prisma.projectNote.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Notiz nicht gefunden');
    }
    await this.prisma.projectNote.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Interner Helfer: stellt sicher, dass das Projekt existiert.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Projekt (void)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async ensureProject(id: string): Promise<void> {
    const count = await this.prisma.project.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureSite` (ensure Site).
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async ensureSite(projectId: string, id: string): Promise<void> {
    const count = await this.prisma.projectSite.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Standort nicht gefunden');
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureEquipment` (ensure Equipment).
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async ensureEquipment(projectId: string, id: string): Promise<void> {
    const count = await this.prisma.projectEquipment.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Gerät nicht gefunden');
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureEmailRecipient` (ensure Email Recipient).
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async ensureEmailRecipient(
    projectId: string,
    id: string,
  ): Promise<void> {
    const count = await this.prisma.projectEmailRecipient.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Empfänger nicht gefunden');
    }
  }

}
