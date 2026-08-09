/**
 * Projekt-Monteur-Zuordnungen und Verfügbarkeit.
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkerAvailability } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { coerceDate } from './project-shared';
import { ProjectResourcesService } from './project-resources.service';

@Injectable()
export class ProjectAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ProjectResourcesService,
  ) {}

  // ── Monteur-Zuordnungen ──────────────────────────────────────

  /**
   * Liefert alle Monteur-Zuordnungen eines Projekts mit Worker-Daten.
   *
   * @param projectId - ID des Projekts (string)
   */
  async findAssignments(projectId: string) {
    await this.resources.ensureProject(projectId);
    return this.prisma.projectAssignment.findMany({
      where: { projectId },
      orderBy: [{ isLead: 'desc' }, { startDate: 'asc' }],
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Erstellt eine neue Monteur-Zuordnung zum Projekt. Setzt die Worker-Verfügbarkeit auf ON_PROJECT wenn aktiv. Prüft Constraint: nur eine aktive Zuweisung pro Monteur.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateAssignmentDto)
   */
  async createAssignment(projectId: string, dto: CreateAssignmentDto) {
    await this.resources.ensureProject(projectId);
    const active = dto.active ?? true;
    const startDate = coerceDate(dto.startDate) ?? new Date();
    const endDate = coerceDate(dto.endDate) ?? null;
    // Datumsbasierter Konflikt: überlappende aktive Zuweisung.
    if (active) {
      await this.assertNoOverlappingAssignment(
        dto.workerId,
        startDate,
        endDate,
      );
    }

    const assignment = await this.prisma.projectAssignment.create({
      data: {
        projectId,
        workerId: dto.workerId,
        roleName: dto.roleName,
        startDate,
        endDate: endDate ?? undefined,
        active,
        isLead: dto.isLead ?? false,
        notes: dto.notes,
      },
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Verfügbarkeit auf "im Projekteinsatz" setzen.
    if (active) {
      await this.setWorkerAvailability(
        dto.workerId,
        WorkerAvailability.ON_PROJECT,
      );
    }
    return assignment;
  }

  /**
   * Aktualisiert eine Monteur-Zuordnung und synchronisiert die Verfügbarkeit. Bei Deaktivierung → AVAILABLE, bei Reaktivierung → ON_PROJECT.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateAssignmentDto)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async updateAssignment(
    projectId: string,
    id: string,
    dto: UpdateAssignmentDto,
  ) {
    const current = await this.prisma.projectAssignment.findFirst({
      where: { id, projectId },
      select: {
        id: true,
        workerId: true,
        active: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Zuordnung nicht gefunden');
    }

    const { workerId, ...rest } = dto;
    const targetWorkerId = workerId ?? current.workerId;
    const nextStart = coerceDate(dto.startDate) ?? current.startDate;
    const nextEnd: Date | null =
      dto.endDate !== undefined
        ? (coerceDate(dto.endDate) ?? null)
        : current.endDate;
    const willBeActive = dto.active ?? current.active;
    if (willBeActive) {
      await this.assertNoOverlappingAssignment(
        targetWorkerId,
        nextStart,
        nextEnd,
        id,
      );
    }

    const updated = await this.prisma.projectAssignment.update({
      where: { id },
      data: {
        ...rest,
        workerId: workerId ?? undefined,
        startDate: coerceDate(dto.startDate) ?? undefined,
        endDate: coerceDate(dto.endDate),
      },
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Verfügbarkeit: Reaktivierung → ON_PROJECT; Deaktivierung nur AVAILABLE
    // wenn keine andere aktive Zuweisung mehr existiert.
    if (dto.active === true && !current.active) {
      await this.setWorkerAvailability(
        targetWorkerId,
        WorkerAvailability.ON_PROJECT,
      );
    } else if (dto.active === false && current.active) {
      await this.syncAvailabilityAfterActiveLoss(current.workerId, id);
    }
    return updated;
  }

  /**
   * Löscht eine Zuordnung und setzt ggf. den Monteur auf AVAILABLE.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  async removeAssignment(projectId: string, id: string) {
    const current = await this.prisma.projectAssignment.findFirst({
      where: { id, projectId },
      select: { id: true, workerId: true, active: true },
    });
    if (!current) {
      throw new NotFoundException('Zuordnung nicht gefunden');
    }
    await this.prisma.projectAssignment.delete({ where: { id } });
    // Nur AVAILABLE, wenn keine weitere aktive Zuweisung bleibt.
    if (current.active) {
      await this.syncAvailabilityAfterActiveLoss(current.workerId);
    }
    return { id, deleted: true };
  }

  /**
   * Stellt sicher, dass der Monteur keine überlappende aktive Zuweisung hat. Überlappung: startDate <= to AND (endDate IS NULL OR endDate >= from). Wirft 409 mit Hinweis auf das belegende Projekt.
   *
   * @param workerId - ID des Monteurs (string)
   * @param from - Zeitraum-Beginn (Date)
   * @param to - Zeitraum-Ende (Date | null)
   * @param exceptAssignmentId - ID (exceptAssignmentId) (string)
   * @returns void
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  private async assertNoOverlappingAssignment(
    workerId: string,
    from: Date,
    to: Date | null,
    exceptAssignmentId?: string,
  ): Promise<void> {
    const effectiveTo = to ?? new Date('9999-12-31');
    const existing = await this.prisma.projectAssignment.findFirst({
      where: {
        workerId,
        active: true,
        id: exceptAssignmentId ? { not: exceptAssignmentId } : undefined,
        startDate: { lte: effectiveTo },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      include: { project: { select: { title: true } } },
    });
    if (existing) {
      throw new ConflictException(
        `Worker ist im gewählten Zeitraum bereits dem Projekt '${existing.project.title}' zugewiesen. Bitte zuerst die bestehende Zuweisung beenden oder den Zeitraum anpassen.`,
      );
    }
  }

  /**
   * Setzt die Verfügbarkeit eines Monteurs (für Zuweisungs-Workflow).
   *
   * @param workerId - ID des Monteurs (string)
   * @param availability - Parameter `availability` (WorkerAvailability)
   * @returns void
   */
  private async setWorkerAvailability(
    workerId: string,
    availability: WorkerAvailability,
  ): Promise<void> {
    await this.prisma.worker
      .update({ where: { id: workerId }, data: { availability } })
      .catch(() => undefined);
  }

  /**
   * Nach Ende/Löschen einer aktiven Zuweisung: AVAILABLE nur wenn keine andere aktive Assignment mehr existiert (sonst ON_PROJECT).
   *
   * @param workerId - ID des Monteurs (string)
   * @param exceptAssignmentId - ID (exceptAssignmentId) (string)
   * @returns void
   */
  private async syncAvailabilityAfterActiveLoss(
    workerId: string,
    exceptAssignmentId?: string,
  ): Promise<void> {
    const remaining = await this.prisma.projectAssignment.count({
      where: {
        workerId,
        active: true,
        id: exceptAssignmentId ? { not: exceptAssignmentId } : undefined,
      },
    });
    await this.setWorkerAvailability(
      workerId,
      remaining > 0
        ? WorkerAvailability.ON_PROJECT
        : WorkerAvailability.AVAILABLE,
    );
  }

}
