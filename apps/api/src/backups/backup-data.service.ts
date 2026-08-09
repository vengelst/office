/**
 * Backup-Datenexport/-import je Modul.
 * Ausgelagert aus BackupsService – Format unverändert.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BackupModule } from './backup-modules';

@Injectable()
export class BackupDataService {
  constructor(private readonly prisma: PrismaService) {}

  async exportModule(mod: BackupModule): Promise<unknown> {
    switch (mod) {
      case 'todos':
        return this.prisma.todo.findMany();
      case 'customers':
        return {
          customers: await this.prisma.customer.findMany(),
          emails: await this.prisma.customerEmail.findMany(),
          bankAccounts: await this.prisma.customerBankAccount.findMany(),
          branches: await this.prisma.customerBranch.findMany(),
          contacts: await this.prisma.customerContact.findMany(),
          notes: await this.prisma.customerNote.findMany(),
          callLogs: await this.prisma.customerCallLog.findMany(),
        };
      case 'projects':
        return {
          projects: await this.prisma.project.findMany(),
          sites: await this.prisma.projectSite.findMany(),
          equipment: await this.prisma.projectEquipment.findMany(),
          statusHistory: await this.prisma.projectStatusHistory.findMany(),
          notes: await this.prisma.projectNote.findMany(),
          assignments: await this.prisma.projectAssignment.findMany(),
          emailRecipients: await this.prisma.projectEmailRecipient.findMany(),
        };
      case 'workers':
        return {
          workers: await this.prisma.worker.findMany(),
          languages: await this.prisma.workerLanguage.findMany(),
          certifications: await this.prisma.workerCertification.findMany(),
          pins: await this.prisma.workerPin.findMany(),
          equipmentIssues: await this.prisma.workerEquipmentIssue.findMany(),
        };
      case 'teams':
        return {
          teams: await this.prisma.workerTeam.findMany(),
          members: await this.prisma.workerTeamMember.findMany(),
        };
      case 'subcontractors':
        return {
          subcontractors: await this.prisma.subcontractor.findMany(),
          contacts: await this.prisma.subcontractorContact.findMany(),
        };
      case 'vehicles':
        return {
          vehicles: await this.prisma.vehicle.findMany(),
          assignments: await this.prisma.workerVehicleAssignment.findMany(),
        };
      case 'equipment':
        return {
          equipment: await this.prisma.equipment.findMany(),
          items: await this.prisma.equipmentItem.findMany(),
          assignments: await this.prisma.equipmentAssignment.findMany(),
        };
      case 'timesheets':
        return {
          timesheets: await this.prisma.weeklyTimesheet.findMany(),
          timeEntries: await this.prisma.timeEntry.findMany(),
        };
      case 'documents':
        return {
          folders: await this.prisma.documentFolder.findMany(),
          documents: await this.prisma.document.findMany(),
          links: await this.prisma.documentLink.findMany(),
        };
      case 'invoices':
        return {
          invoices: await this.prisma.invoice.findMany(),
          lines: await this.prisma.invoiceLine.findMany(),
          payments: await this.prisma.invoicePayment.findMany(),
        };
      default:
        return [];
    }
  }

  /**
   * Importiert Moduldaten: vorhandene Zeilen mit gleicher ID werden per upsert ersetzt. Kein Hard-Delete der gesamten Tabelle (sicherer bei Teil-Restore).
   *
   * @param mod - Parameter `mod` (BackupModule)
   * @param data - Nutzdaten
   * @returns number
   */
  async importModule(mod: BackupModule, data: unknown): Promise<number> {
    switch (mod) {
      case 'todos': {
        const rows = data as Array<Prisma.TodoCreateManyInput>;
        let n = 0;
        for (const row of rows) {
          await this.prisma.todo.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'customers': {
        const bundle = data as {
          customers: Prisma.CustomerCreateManyInput[];
          emails: Prisma.CustomerEmailCreateManyInput[];
          bankAccounts: Prisma.CustomerBankAccountCreateManyInput[];
          branches: Prisma.CustomerBranchCreateManyInput[];
          contacts: Prisma.CustomerContactCreateManyInput[];
          notes: Prisma.CustomerNoteCreateManyInput[];
          callLogs: Prisma.CustomerCallLogCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.customers ?? []) {
          await this.prisma.customer.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.branches ?? []) {
          await this.prisma.customerBranch.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.emails ?? []) {
          await this.prisma.customerEmail.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.bankAccounts ?? []) {
          await this.prisma.customerBankAccount.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.contacts ?? []) {
          await this.prisma.customerContact.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.notes ?? []) {
          await this.prisma.customerNote.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.callLogs ?? []) {
          await this.prisma.customerCallLog.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'projects': {
        const bundle = data as {
          projects: Prisma.ProjectCreateManyInput[];
          sites: Prisma.ProjectSiteCreateManyInput[];
          equipment: Prisma.ProjectEquipmentCreateManyInput[];
          statusHistory: Prisma.ProjectStatusHistoryCreateManyInput[];
          notes: Prisma.ProjectNoteCreateManyInput[];
          assignments: Prisma.ProjectAssignmentCreateManyInput[];
          emailRecipients: Prisma.ProjectEmailRecipientCreateManyInput[];
        };
        for (const row of bundle.projects ?? []) {
          await this.prisma.project.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.sites ?? []) {
          await this.prisma.projectSite.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.equipment ?? []) {
          await this.prisma.projectEquipment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.statusHistory ?? []) {
          await this.prisma.projectStatusHistory.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.notes ?? []) {
          await this.prisma.projectNote.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.projectAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.emailRecipients ?? []) {
          await this.prisma.projectEmailRecipient.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        return (
          (bundle.projects?.length ?? 0) +
          (bundle.sites?.length ?? 0) +
          (bundle.equipment?.length ?? 0) +
          (bundle.statusHistory?.length ?? 0) +
          (bundle.notes?.length ?? 0) +
          (bundle.assignments?.length ?? 0) +
          (bundle.emailRecipients?.length ?? 0)
        );
      }
      case 'workers': {
        const bundle = data as {
          workers: Prisma.WorkerCreateManyInput[];
          languages: Prisma.WorkerLanguageCreateManyInput[];
          certifications: Prisma.WorkerCertificationCreateManyInput[];
          pins: Prisma.WorkerPinCreateManyInput[];
          equipmentIssues: Prisma.WorkerEquipmentIssueCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.workers ?? []) {
          await this.prisma.worker.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.languages ?? []) {
          await this.prisma.workerLanguage.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.certifications ?? []) {
          await this.prisma.workerCertification.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.pins ?? []) {
          await this.prisma.workerPin.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.equipmentIssues ?? []) {
          await this.prisma.workerEquipmentIssue.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'teams': {
        const bundle = data as {
          teams: Prisma.WorkerTeamCreateManyInput[];
          members: Prisma.WorkerTeamMemberCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.teams ?? []) {
          await this.prisma.workerTeam.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.members ?? []) {
          await this.prisma.workerTeamMember.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'subcontractors': {
        const bundle = data as {
          subcontractors: Prisma.SubcontractorCreateManyInput[];
          contacts: Prisma.SubcontractorContactCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.subcontractors ?? []) {
          await this.prisma.subcontractor.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.contacts ?? []) {
          await this.prisma.subcontractorContact.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'vehicles': {
        const bundle = data as {
          vehicles: Prisma.VehicleCreateManyInput[];
          assignments: Prisma.WorkerVehicleAssignmentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.vehicles ?? []) {
          await this.prisma.vehicle.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.workerVehicleAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'equipment': {
        const bundle = data as {
          equipment: Prisma.EquipmentCreateManyInput[];
          items: Prisma.EquipmentItemCreateManyInput[];
          assignments: Prisma.EquipmentAssignmentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.items ?? []) {
          await this.prisma.equipmentItem.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.equipment ?? []) {
          await this.prisma.equipment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.equipmentAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'timesheets': {
        const bundle = data as {
          timesheets: Prisma.WeeklyTimesheetCreateManyInput[];
          timeEntries: Prisma.TimeEntryCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.timesheets ?? []) {
          await this.prisma.weeklyTimesheet.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.timeEntries ?? []) {
          await this.prisma.timeEntry.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'documents': {
        const bundle = data as {
          folders: Prisma.DocumentFolderCreateManyInput[];
          documents: Prisma.DocumentCreateManyInput[];
          links: Prisma.DocumentLinkCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.folders ?? []) {
          await this.prisma.documentFolder.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.documents ?? []) {
          await this.prisma.document.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.links ?? []) {
          await this.prisma.documentLink.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'invoices': {
        const bundle = data as {
          invoices: Prisma.InvoiceCreateManyInput[];
          lines: Prisma.InvoiceLineCreateManyInput[];
          payments: Prisma.InvoicePaymentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.invoices ?? []) {
          await this.prisma.invoice.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.lines ?? []) {
          await this.prisma.invoiceLine.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.payments ?? []) {
          await this.prisma.invoicePayment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      default:
        return 0;
    }
  }

}
