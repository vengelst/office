import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerPlDto, UpdateCustomerPlDto } from './dto/workflow.dto';
import { WorkItemsService } from './work-items.service';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  isActive: true,
} as const;

/**
 * Zuordnung von Kunden-Projektleitern (Rolle CUSTOMER_PL) zu Projekten.
 * Nur User mit dieser Rolle dürfen zugeordnet werden – bewusst getrennt von
 * den internen Rollen (siehe SPEZ-arbeitsitems.md Abschnitt 4.2).
 */
@Injectable()
export class ProjectCustomerPlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
  ) {}

  /** Alle (auch inaktiven) Kunden-PL-Zuordnungen eines Projekts. */
  async findAll(projectId: string) {
    await this.workItems.ensureProject(projectId);
    return this.prisma.projectCustomerPlAssignment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: userSelect } },
    });
  }

  /**
   * Projekte, für die der angemeldete Kunden-PL freigeschaltet ist.
   * SUPERADMIN sieht alle item-basierten Projekte.
   *
   * @param user - Angemeldeter Benutzer (JWT)
   */
  async findProjectsForUser(user: AuthUser) {
    const isSuperadmin = user.roles.includes(RoleCode.SUPERADMIN);
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        itemBased: true,
        ...(isSuperadmin
          ? {}
          : { customerPls: { some: { userId: user.id, active: true } } }),
      },
      orderBy: { projectNumber: 'desc' },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        status: true,
        itemBased: true,
        customer: { select: { id: true, companyName: true } },
        _count: { select: { workItems: true } },
      },
    });
  }

  /** Auswahlliste: alle aktiven User mit Rolle CUSTOMER_PL. */
  listCandidates() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { code: RoleCode.CUSTOMER_PL } } },
      },
      orderBy: { displayName: 'asc' },
      select: userSelect,
    });
  }

  /**
   * Ordnet einen Kunden-PL dem Projekt zu (idempotent: reaktiviert eine
   * vorhandene, inaktive Zuordnung).
   *
   * @throws BadRequestException wenn der User die Rolle CUSTOMER_PL nicht hat
   */
  async create(projectId: string, dto: CreateCustomerPlDto) {
    await this.workItems.ensureProject(projectId);
    await this.assertCustomerPlUser(dto.userId);

    return this.prisma.projectCustomerPlAssignment.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      update: { active: true },
      create: { projectId, userId: dto.userId },
      include: { user: { select: userSelect } },
    });
  }

  /**
   * Aktualisiert Felder der Kunden-PL-Zuordnung (derzeit Zustell-E-Mail).
   * Leerer String wird als `null` gespeichert (= Fallback auf User-E-Mail).
   */
  async update(projectId: string, userId: string, dto: UpdateCustomerPlDto) {
    await this.workItems.ensureProject(projectId);
    const assignment = await this.prisma.projectCustomerPlAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException('Kunden-PL-Zuordnung nicht gefunden');
    }

    const notificationEmail =
      dto.notificationEmail === undefined
        ? undefined
        : dto.notificationEmail === null || dto.notificationEmail.trim() === ''
          ? null
          : dto.notificationEmail.trim();

    return this.prisma.projectCustomerPlAssignment.update({
      where: { id: assignment.id },
      data: {
        ...(notificationEmail !== undefined ? { notificationEmail } : {}),
      },
      include: { user: { select: userSelect } },
    });
  }

  /** Setzt die Zuordnung inaktiv (Historie bleibt erhalten). */
  async remove(projectId: string, userId: string) {
    const assignment = await this.prisma.projectCustomerPlAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException('Kunden-PL-Zuordnung nicht gefunden');
    }
    await this.prisma.projectCustomerPlAssignment.update({
      where: { id: assignment.id },
      data: { active: false },
    });
    return { projectId, userId, active: false };
  }

  private async assertCustomerPlUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, roles: { select: { role: { select: { code: true } } } } },
    });
    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }
    const hasRole = user.roles.some((r) => r.role.code === RoleCode.CUSTOMER_PL);
    if (!hasRole) {
      throw new BadRequestException(
        'Benutzer hat nicht die Rolle CUSTOMER_PL (Kunden-PL)',
      );
    }
  }
}
