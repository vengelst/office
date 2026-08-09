/**
 * Service für Worker Auth.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

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
   * Liefert das Profil des über das Worker-Token identifizierten Monteurs inkl. seiner aktiven Projektzuweisungen. Die Zuweisungen werden von der Monteur-App benötigt, um das einzustempelnde Projekt auszuwählen (aktuell = startDate <= heute, zukünftig = startDate > heute). `project.itemBased` sagt der App, ob für dieses Projekt der Arbeitsitems-Bereich angeboten wird – so entfällt ein Extra-Call.
   *
   * @param workerId - ID des Monteurs (string)
   * @returns Auth-Profil
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
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
                // Steuert in der Monteur-App, ob der Arbeitsitems-Bereich
                // für dieses Projekt angeboten wird (SPEZ-arbeitsitems.md).
                itemBased: true,
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
