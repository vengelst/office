import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { OcrModule } from '../ocr/ocr.module';
import { WorkCardTemplatesModule } from '../work-card-templates/work-card-templates.module';
import { CustomerPlWorkItemsController } from './customer-pl-work-items.controller';
import { ProjectCustomerPlsService } from './project-customer-pls.service';
import { ProjectWorkItemsController } from './project-work-items.controller';
import { WorkItemBlocksService } from './work-item-blocks.service';
import { WorkItemImportService } from './work-item-import.service';
import { WorkItemPdfImportService } from './work-item-pdf-import.service';
import { WorkItemWorkflowService } from './work-item-workflow.service';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { WorkerWorkItemsController } from './worker-work-items.controller';

/**
 * Arbeitsitems (SPEZ-arbeitsitems.md): Blöcke, Items, Material, Excel-Import,
 * Zuordnung/Zeitsessions der Monteure und die Prüfung durch den Kunden-PL.
 *
 * Controller nach Zielgruppe getrennt:
 *  - `ProjectWorkItemsController`     Büro, projektbezogen (Blöcke, Liste, Import, Kunden-PLs)
 *  - `WorkItemsController`            Büro, einzelnes Item (Detail, Material, Item-Zeit)
 *  - `WorkerWorkItemsController`      Monteur-App (claim, Sessions, Rückmeldungen)
 *  - `CustomerPlWorkItemsController`  Kunden-PL (Board, approve, force-complete)
 *
 * `DocumentsModule` liefert `DocumentsService` und `StoragePathService` für die
 * Fotos der Rückmeldungen. `WorkItemWorkflowService` wird exportiert, damit das
 * Ausstempeln offene Item-Sessions schließen kann (TimeEntriesModule).
 */
@Module({
  imports: [DocumentsModule, OcrModule, WorkCardTemplatesModule],
  controllers: [
    ProjectWorkItemsController,
    WorkItemsController,
    WorkerWorkItemsController,
    CustomerPlWorkItemsController,
  ],
  providers: [
    WorkItemsService,
    WorkItemBlocksService,
    WorkItemImportService,
    WorkItemPdfImportService,
    WorkItemWorkflowService,
    ProjectCustomerPlsService,
  ],
  exports: [WorkItemsService, WorkItemWorkflowService],
})
export class WorkItemsModule {}
