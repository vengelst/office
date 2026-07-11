import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BreakScopeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBreakRuleDto } from './dto/create-break-rule.dto';
import { UpdateBreakRuleDto } from './dto/update-break-rule.dto';

const ruleSelect = {
  id: true,
  scopeType: true,
  projectId: true,
  name: true,
  autoDeductEnabled: true,
  thresholdMinutes1: true,
  breakMinutes1: true,
  thresholdMinutes2: true,
  breakMinutes2: true,
  active: true,
  project: { select: { id: true, projectNumber: true, title: true } },
} satisfies Prisma.BreakRuleSelect;

/**
 * Service für die Pausenregel-Verwaltung.
 * Definiert automatische Pausenabzüge basierend auf Schwellenwerten
 * (z.B. >6h → 30 Min Pause, >9h → 45 Min Pause).
 * Regeln können global oder projektspezifisch gelten.
 */
@Injectable()
export class BreakRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Alle Regeln (global + projektspezifisch), optional auf ein Projekt gefiltert. */
  findAll(projectId?: string) {
    const where: Prisma.BreakRuleWhereInput = {};
    if (projectId) {
      where.OR = [
        { scopeType: BreakScopeType.GLOBAL },
        { projectId },
      ];
    }
    return this.prisma.breakRule.findMany({
      where,
      select: ruleSelect,
      orderBy: [{ scopeType: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Liefert eine einzelne Pausenregel.
   *
   * @param id - UUID der Regel
   * @returns Die Pausenregel mit Projekt-Referenz
   * @throws NotFoundException wenn die Regel nicht existiert
   */
  async findOne(id: string) {
    const rule = await this.prisma.breakRule.findUnique({
      where: { id },
      select: ruleSelect,
    });
    if (!rule) {
      throw new NotFoundException('Pausenregel nicht gefunden');
    }
    return rule;
  }

  /**
   * Erstellt eine neue Pausenregel (global oder projektspezifisch).
   * Validiert Scope-Konsistenz und Schwellenwert-Reihenfolge.
   *
   * @param dto - Regeldaten (Scope, Schwellenwerte, Pausenminuten)
   * @returns Die erstellte Regel
   */
  async create(dto: CreateBreakRuleDto) {
    this.validateScope(dto.scopeType, dto.projectId);
    this.validateThresholds(dto.thresholdMinutes1, dto.thresholdMinutes2);
    return this.prisma.breakRule.create({
      data: {
        scopeType: dto.scopeType,
        projectId:
          dto.scopeType === BreakScopeType.PROJECT ? dto.projectId : null,
        name: dto.name,
        autoDeductEnabled: dto.autoDeductEnabled ?? true,
        thresholdMinutes1: dto.thresholdMinutes1,
        breakMinutes1: dto.breakMinutes1,
        thresholdMinutes2: dto.thresholdMinutes2,
        breakMinutes2: dto.breakMinutes2,
        active: dto.active ?? true,
      },
      select: ruleSelect,
    });
  }

  /** Aktualisiert eine bestehende Pausenregel. */
  async update(id: string, dto: UpdateBreakRuleDto) {
    await this.findOne(id);
    if (dto.scopeType) {
      this.validateScope(dto.scopeType, dto.projectId);
    }
    if (dto.thresholdMinutes1 !== undefined) {
      this.validateThresholds(dto.thresholdMinutes1, dto.thresholdMinutes2);
    }
    return this.prisma.breakRule.update({
      where: { id },
      data: {
        scopeType: dto.scopeType,
        projectId:
          dto.scopeType === BreakScopeType.GLOBAL
            ? null
            : (dto.projectId ?? undefined),
        name: dto.name,
        autoDeductEnabled: dto.autoDeductEnabled,
        thresholdMinutes1: dto.thresholdMinutes1,
        breakMinutes1: dto.breakMinutes1,
        thresholdMinutes2: dto.thresholdMinutes2,
        breakMinutes2: dto.breakMinutes2,
        active: dto.active,
      },
      select: ruleSelect,
    });
  }

  /** Löscht eine Pausenregel vollständig. */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.breakRule.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Stellt sicher, dass bei PROJECT-Scope eine projectId übergeben wird. */
  private validateScope(scopeType: BreakScopeType, projectId?: string): void {
    if (scopeType === BreakScopeType.PROJECT && !projectId) {
      throw new BadRequestException(
        'projectId ist bei scopeType=PROJECT erforderlich',
      );
    }
  }

  /** Prüft, dass Schwellenwert 2 größer als Schwellenwert 1 ist. */
  private validateThresholds(t1: number, t2?: number): void {
    if (t2 !== undefined && t2 <= t1) {
      throw new BadRequestException(
        'Schwellenwert 2 muss größer als Schwellenwert 1 sein',
      );
    }
  }
}
