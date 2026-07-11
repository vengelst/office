import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

/** Schlanke Worker-Projektion für Team-Ansichten. */
const memberWorkerSelect = {
  id: true,
  workerNumber: true,
  firstName: true,
  lastName: true,
  photoPath: true,
  availability: true,
} as const;

/**
 * Service für die Teamverwaltung (Monteur-Teams/Kolonnen).
 * Verwaltet Teams mit Teamleiter, aktive Mitgliedschaften
 * und deren Historisierung (joinedAt/leftAt).
 */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Teams CRUD ───────────────────────────────────────────────

  /**
   * Liefert alle Teams mit Mitglieder-Anzahl und aufgelöstem Teamleiter.
   *
   * @returns Array aller Teams, alphabetisch sortiert
   */
  async findAll() {
    const teams = await this.prisma.workerTeam.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });

    // Teamleiter-Namen in einem Rutsch nachladen (leaderId ist kein FK).
    const leaders = await this.resolveLeaders(teams.map((t) => t.leaderId));
    return teams.map((team) => ({
      ...team,
      leader: team.leaderId ? (leaders.get(team.leaderId) ?? null) : null,
    }));
  }

  /**
   * Liefert ein einzelnes Team mit aktiven Mitgliedern und Teamleiter-Details.
   *
   * @param id - UUID des Teams
   * @returns Team mit Mitgliederliste
   * @throws NotFoundException wenn das Team nicht existiert
   */
  async findOne(id: string) {
    const team = await this.prisma.workerTeam.findUnique({
      where: { id },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
          include: { worker: { select: memberWorkerSelect } },
        },
      },
    });
    if (!team) {
      throw new NotFoundException('Team nicht gefunden');
    }
    const leaders = await this.resolveLeaders([team.leaderId]);
    return {
      ...team,
      leader: team.leaderId ? (leaders.get(team.leaderId) ?? null) : null,
    };
  }

  /** Erstellt ein neues Team mit optionalem Teamleiter. */
  async create(dto: CreateTeamDto) {
    if (dto.leaderId) await this.ensureWorker(dto.leaderId);
    return this.prisma.workerTeam.create({ data: { ...dto } });
  }

  /** Aktualisiert ein bestehendes Team (Name, Beschreibung, Teamleiter). */
  async update(id: string, dto: UpdateTeamDto) {
    await this.ensureTeam(id);
    if (dto.leaderId) await this.ensureWorker(dto.leaderId);
    return this.prisma.workerTeam.update({ where: { id }, data: { ...dto } });
  }

  /** Hartes Löschen – Mitgliedschaften werden via Cascade entfernt. */
  async remove(id: string) {
    await this.ensureTeam(id);
    await this.prisma.workerTeam.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Mitglieder ───────────────────────────────────────────────

  /**
   * Fügt einen Monteur als aktives Mitglied zu einem Team hinzu.
   * Prüft auf Duplikate (gleicher Monteur bereits aktiv im Team).
   *
   * @param teamId - UUID des Teams
   * @param dto - Monteur-ID und optionale Rolle
   * @returns Das erstellte Mitglied mit Worker-Daten
   */
  async addMember(teamId: string, dto: CreateTeamMemberDto) {
    await this.ensureTeam(teamId);
    await this.ensureWorker(dto.workerId);

    const existing = await this.prisma.workerTeamMember.findFirst({
      where: { teamId, workerId: dto.workerId, leftAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        'Monteur ist bereits aktives Mitglied dieses Teams.',
      );
    }

    return this.prisma.workerTeamMember.create({
      data: {
        teamId,
        workerId: dto.workerId,
        role: dto.role,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
      },
      include: { worker: { select: memberWorkerSelect } },
    });
  }

  /** Mitglied entfernen: setzt leftAt (historisiert die Mitgliedschaft). */
  async removeMember(teamId: string, memberId: string) {
    const member = await this.prisma.workerTeamMember.findFirst({
      where: { id: memberId, teamId },
    });
    if (!member) {
      throw new NotFoundException('Mitglied nicht gefunden');
    }
    if (member.leftAt) {
      return member;
    }
    return this.prisma.workerTeamMember.update({
      where: { id: memberId },
      data: { leftAt: new Date() },
    });
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  private async resolveLeaders(leaderIds: (string | null)[]) {
    const ids = leaderIds.filter((id): id is string => !!id);
    if (ids.length === 0) return new Map<string, unknown>();
    const workers = await this.prisma.worker.findMany({
      where: { id: { in: ids } },
      select: memberWorkerSelect,
    });
    return new Map(workers.map((w) => [w.id, w]));
  }

  private async ensureTeam(id: string): Promise<void> {
    const count = await this.prisma.workerTeam.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Team nicht gefunden');
    }
  }

  private async ensureWorker(id: string): Promise<void> {
    const count = await this.prisma.worker.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
  }
}
