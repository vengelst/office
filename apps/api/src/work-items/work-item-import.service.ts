import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImportWorkItemsDto } from './dto/workflow.dto';
import {
  ParsedItemRow,
  ParsedMaterialRow,
  ParseInput,
  parseWorkItemFiles,
} from './work-item-import.parser';
import { WorkItemsService } from './work-items.service';

/** Erlaubte Dateiendungen des Imports. */
const ALLOWED_EXTENSIONS = /\.(xlsx|xlsm|csv|txt)$/i;

/** Obergrenze je Import-Lauf – schützt vor versehentlichen Massenimporten. */
const MAX_ITEMS_PER_IMPORT = 5000;

/**
 * Felder aus `ParsedItemRow`, die nicht am WorkItem gespeichert werden:
 * `sourceRow` dient nur der Fehlermeldung, `blockKey` wird zur Block-Referenz
 * aufgelöst und `siteName`/`siteAddress` gehören zum Projekt, nicht zum Item.
 */
const NON_ITEM_FIELDS = ['sourceRow', 'blockKey', 'siteName', 'siteAddress'] as const;

export interface ImportSummary {
  dryRun: boolean;
  itemsCreated: number;
  itemsUpdated: number;
  blocksCreated: number;
  materialLinesImported: number;
  itemsWithMaterialsReplaced: number;
  /** Material-Zeilen, deren itemKey im Projekt nicht existiert. */
  orphanMaterialRows: number;
  warnings: string[];
  sources: string[];
  itemKeys: string[];
}

/**
 * Excel-/CSV-Import der Arbeitsitems (SPEZ-arbeitsitems.md Abschnitt 11).
 *
 * Strategie:
 *  - Upsert je `(projectId, itemKey)`: bestehende Items behalten Status,
 *    Zuordnungen und Historie, nur die Metadaten werden aktualisiert.
 *  - Unbekannte `blockKey` werden als Block angelegt.
 *  - Material: **replace** je Item – alle Materialzeilen eines im Import
 *    enthaltenen Items werden ersetzt. Items ohne Materialzeilen im Import
 *    behalten ihre bestehende Liste.
 *  - Neue Items starten in Status OPEN und ohne Zuordnung.
 */
@Injectable()
export class WorkItemImportService {
  private readonly logger = new Logger(WorkItemImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
  ) {}

  /**
   * Importiert Items und Material aus den hochgeladenen Dateien in ein Projekt.
   *
   * @param projectId - UUID des Zielprojekts
   * @param files - Hochgeladene .xlsx/.csv-Dateien (Multipart-Feld `files`)
   * @param dto - Optionen (dryRun, setItemBased, csvDelimiter)
   * @returns Zusammenfassung mit Zählern, Warnungen und Quellen
   */
  async import(
    projectId: string,
    files: Express.Multer.File[] | undefined,
    dto: ImportWorkItemsDto,
  ): Promise<ImportSummary> {
    await this.workItems.ensureProject(projectId);

    const inputs = this.toParseInputs(files);
    const parsed = await parseWorkItemFiles(inputs, {
      csvDelimiter: dto.csvDelimiter,
    });

    if (parsed.items.length === 0 && parsed.materials.length === 0) {
      throw new BadRequestException(
        `Keine verwertbaren Zeilen gefunden. ${parsed.warnings.join(' | ')}`.trim(),
      );
    }
    if (parsed.items.length > MAX_ITEMS_PER_IMPORT) {
      throw new BadRequestException(
        `Zu viele Items in einem Lauf (${parsed.items.length}, Maximum ${MAX_ITEMS_PER_IMPORT})`,
      );
    }

    const warnings = [...parsed.warnings];
    const dryRun = dto.dryRun === true;

    // Bestandsabgleich für die Zähler (auch im dryRun aussagekräftig).
    const existing = await this.prisma.workItem.findMany({
      where: { projectId },
      select: { id: true, itemKey: true },
    });
    const existingByKey = new Map(existing.map((i) => [i.itemKey, i.id]));

    const existingBlocks = await this.prisma.projectBlock.findMany({
      where: { projectId },
      select: { id: true, blockKey: true },
    });
    const blockIdByKey = new Map(existingBlocks.map((b) => [b.blockKey, b.id]));

    const importedKeys = new Set(parsed.items.map((i) => i.itemKey));
    const newBlockKeys = [
      ...new Set(
        parsed.items
          .map((i) => i.blockKey)
          .filter((key): key is string => !!key && !blockIdByKey.has(key)),
      ),
    ];

    const { materialsByItem, orphanMaterialRows } = this.groupMaterials(
      parsed.materials,
      importedKeys,
      existingByKey,
      warnings,
    );

    const summary: ImportSummary = {
      dryRun,
      itemsCreated: parsed.items.filter((i) => !existingByKey.has(i.itemKey)).length,
      itemsUpdated: parsed.items.filter((i) => existingByKey.has(i.itemKey)).length,
      blocksCreated: newBlockKeys.length,
      materialLinesImported: [...materialsByItem.values()].reduce(
        (sum, lines) => sum + lines.length,
        0,
      ),
      itemsWithMaterialsReplaced: materialsByItem.size,
      orphanMaterialRows,
      warnings,
      sources: parsed.sources,
      itemKeys: parsed.items.map((i) => i.itemKey),
    };

    if (dryRun) {
      return summary;
    }

    const importedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Fehlende Blöcke anlegen.
      for (const blockKey of newBlockKeys) {
        const block = await tx.projectBlock.upsert({
          where: { projectId_blockKey: { projectId, blockKey } },
          update: {},
          create: { projectId, blockKey },
          select: { id: true },
        });
        blockIdByKey.set(blockKey, block.id);
      }

      // 2. Items upserten – Status/Zuordnungen bestehender Items bleiben unberührt.
      for (const row of parsed.items) {
        const data = this.toItemData(row, blockIdByKey);
        const item = await tx.workItem.upsert({
          where: { projectId_itemKey: { projectId, itemKey: row.itemKey } },
          update: { ...data, importedAt },
          create: { ...data, projectId, itemKey: row.itemKey, importedAt },
          select: { id: true },
        });
        existingByKey.set(row.itemKey, item.id);
      }

      // 3. Material je betroffenem Item vollständig ersetzen.
      for (const [itemKey, lines] of materialsByItem) {
        const workItemId = existingByKey.get(itemKey);
        if (!workItemId) continue;
        await tx.workItemMaterial.deleteMany({ where: { workItemId } });
        await tx.workItemMaterial.createMany({
          data: lines.map((line, index) => ({
            workItemId,
            sortOrder: line.sortOrder ?? index + 1,
            qty: line.qty ?? null,
            qtyUnit: line.qtyUnit ?? null,
            materialDe: line.materialDe,
            materialSk: line.materialSk ?? null,
          })),
        });
      }

      // 4. Projekt auf itemBased setzen (Default: ja).
      if (dto.setItemBased !== false) {
        await tx.project.update({
          where: { id: projectId },
          data: { itemBased: true },
        });
      }
    });

    this.logger.log(
      `Import Projekt ${projectId}: ${summary.itemsCreated} neu, ${summary.itemsUpdated} aktualisiert, ` +
        `${summary.materialLinesImported} Materialzeilen`,
    );

    return summary;
  }

  /**
   * Vorschau ohne Schreibzugriff – identisch zu `import` mit `dryRun: true`.
   */
  preview(
    projectId: string,
    files: Express.Multer.File[] | undefined,
    dto: ImportWorkItemsDto,
  ): Promise<ImportSummary> {
    return this.import(projectId, files, { ...dto, dryRun: true });
  }

  // ── Helfer ───────────────────────────────────────────────────

  /** Prüft die Uploads und wandelt sie in Parser-Eingaben. */
  private toParseInputs(files: Express.Multer.File[] | undefined): ParseInput[] {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Keine Datei übermittelt (Multipart-Feld "files" mit .xlsx oder .csv)',
      );
    }
    return files.map((file) => {
      if (!ALLOWED_EXTENSIONS.test(file.originalname)) {
        throw new BadRequestException(
          `Nicht unterstütztes Format: ${file.originalname} (erlaubt: .xlsx, .csv)`,
        );
      }
      return { filename: file.originalname, buffer: file.buffer };
    });
  }

  /**
   * Gruppiert Materialzeilen je itemKey und meldet Zeilen, deren Item weder im
   * Import noch im Projekt existiert (typischer Tippfehler in der Vorlage).
   */
  private groupMaterials(
    rows: ParsedMaterialRow[],
    importedKeys: Set<string>,
    existingByKey: Map<string, string>,
    warnings: string[],
  ): { materialsByItem: Map<string, ParsedMaterialRow[]>; orphanMaterialRows: number } {
    const materialsByItem = new Map<string, ParsedMaterialRow[]>();
    let orphanMaterialRows = 0;

    for (const row of rows) {
      if (!importedKeys.has(row.itemKey) && !existingByKey.has(row.itemKey)) {
        orphanMaterialRows++;
        warnings.push(
          `Material Zeile ${row.sourceRow}: Item "${row.itemKey}" existiert nicht – übersprungen`,
        );
        continue;
      }
      const lines = materialsByItem.get(row.itemKey) ?? [];
      lines.push(row);
      materialsByItem.set(row.itemKey, lines);
    }

    for (const lines of materialsByItem.values()) {
      lines.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.sourceRow - b.sourceRow);
    }

    return { materialsByItem, orphanMaterialRows };
  }

  /**
   * Übersetzt eine geparste Zeile in Prisma-Daten und löst den blockKey auf.
   * Leere Spalten werden ausgelassen, damit ein Teil-Import keine bereits
   * gepflegten Felder überschreibt.
   */
  private toItemData(
    row: ParsedItemRow,
    blockIdByKey: Map<string, string>,
  ): Prisma.WorkItemUncheckedUpdateInput & Prisma.WorkItemUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if ((NON_ITEM_FIELDS as readonly string[]).includes(key)) continue;
      if (key === 'itemKey') continue;
      if (value === undefined || value === '') continue;
      data[key] = value;
    }
    if (row.blockKey) {
      data.blockId = blockIdByKey.get(row.blockKey) ?? null;
    }
    return data as Prisma.WorkItemUncheckedUpdateInput &
      Prisma.WorkItemUncheckedCreateInput;
  }
}
