import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardStats {
  customers: number;
  projects: number;
  workers: number;
  hoursThisWeek: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const [customers, projects, workers, activeProjects] = await Promise.all([
      this.prisma.customer.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.project.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.worker.count({
        where: { active: true },
      }),
      this.prisma.project.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: {
          weeklyPackageHours: true,
          _count: { select: { assignments: { where: { active: true } } } },
        },
      }),
    ]);

    const hoursThisWeek = activeProjects.reduce((sum, p) => {
      const hours = p.weeklyPackageHours ?? 0;
      const engineers = p._count.assignments;
      return sum + hours * engineers;
    }, 0);

    return { customers, projects, workers, hoursThisWeek };
  }

}
