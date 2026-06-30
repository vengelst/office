import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Worker-spezifische Auth-Abfragen (Profil des eingeloggten Monteurs).
 * Der eigentliche PIN-Login läuft über den AuthService (gemeinsames JWT-Secret).
 */
@Injectable()
export class WorkerAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert das Profil des über das Worker-Token identifizierten Monteurs
   * inkl. seiner aktiven Projektzuweisungen. Die Zuweisungen werden von der
   * Monteur-App benötigt, um das einzustempelnde Projekt auszuwählen
   * (aktuell = startDate <= heute, zukünftig = startDate > heute).
   */
  async me(workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, active: true, deletedAt: null },
      select: {
        id: true,
        workerNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        photoPath: true,
        availability: true,
        assignments: {
          where: { active: true },
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            isLead: true,
            roleName: true,
            project: {
              select: {
                id: true,
                projectNumber: true,
                title: true,
                customer: { select: { companyName: true } },
              },
            },
          },
        },
      },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
    return worker;
  }
}
