'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { BlocksSection } from '@/components/projects/tabs/work-items/blocks-section';
import { CustomerPlsSection } from '@/components/projects/tabs/work-items/customer-pls-section';
import { ImportSection } from '@/components/projects/tabs/work-items/import-section';
import { ItemDetailSheet } from '@/components/projects/tabs/work-items/item-detail-sheet';
import { ItemsSection } from '@/components/projects/tabs/work-items/items-section';
import { PdfImportSection } from '@/components/projects/tabs/work-items/pdf-import-section';
import { TemplatesSection } from '@/components/projects/tabs/work-items/templates-section';
import { ApiError } from '@/lib/api-client';
import { projectsApi, type ProjectDetail } from '@/lib/projects';
import { texts } from '@/lib/texts';
import {
  workItemsApi,
  type CustomerPlAssignment,
  type ProjectBlock,
  type WorkItemListResponse,
  type WorkItemStatus,
} from '@/lib/work-items';

/**
 * Tab „Arbeitsitems“ der Projekt-Detailseite (Büro-Sicht).
 *
 * Kopfbereich schaltet den Item-Modus (`itemBased`) am Projekt; darunter
 * die Unterbereiche Blöcke & PDFs, Import, Items und Kunden-PL.
 * Fertigmeldungen und Kontrollen sind bewusst nur lesbar – sie laufen über
 * Monteur-App und Kunden-PL (SPEZ-arbeitsitems.md Abschnitt 13).
 */
export function WorkItemsTab({
  project,
  onProjectChange,
}: {
  project: ProjectDetail;
  onProjectChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems;
  const projectId = project.id;
  const itemBased = project.itemBased;

  const [section, setSection] = useState('items');
  const [toggling, setToggling] = useState(false);

  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [customerPls, setCustomerPls] = useState<CustomerPlAssignment[]>([]);
  const [items, setItems] = useState<WorkItemListResponse | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filter der Item-Liste
  const [status, setStatus] = useState<WorkItemStatus | ''>('');
  const [blockKey, setBlockKey] = useState('');
  const [search, setSearch] = useState('');

  const fail = useCallback(
    (err: unknown): void => {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : texts.projects.toast.error,
      });
    },
    [toast],
  );

  const loadBlocks = useCallback((): void => {
    workItemsApi
      .listBlocks(projectId)
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, [projectId]);

  const loadCustomerPls = useCallback((): void => {
    workItemsApi
      .listCustomerPls(projectId)
      .then(setCustomerPls)
      .catch(() => setCustomerPls([]));
  }, [projectId]);

  const loadItems = useCallback((): void => {
    setItemsLoading(true);
    workItemsApi
      .listItems(projectId, {
        status: status || undefined,
        blockKey: blockKey || undefined,
        q: search || undefined,
      })
      .then(setItems)
      .catch(() => setItems(null))
      .finally(() => setItemsLoading(false));
  }, [projectId, status, blockKey, search]);

  useEffect(() => {
    if (!itemBased) return;
    loadBlocks();
    loadCustomerPls();
  }, [itemBased, loadBlocks, loadCustomerPls]);

  useEffect(() => {
    if (!itemBased) return;
    loadItems();
  }, [itemBased, loadItems]);

  /** Schaltet den Item-Modus am Projekt (PATCH /projects/:id). */
  const toggleItemBased = (next: boolean): void => {
    setToggling(true);
    projectsApi
      .update(projectId, { itemBased: next })
      .then(() => {
        toast({
          description: next ? t.toast.itemBasedOn : t.toast.itemBasedOff,
        });
        onProjectChange();
      })
      .catch(fail)
      .finally(() => setToggling(false));
  };

  /** Nach dem Import: Items, Blöcke und Projekt (itemBased) neu laden. */
  const afterImport = (): void => {
    loadBlocks();
    loadItems();
    onProjectChange();
  };

  return (
    <div className="space-y-4">
      {/* Kopfbereich: Item-Modus */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={itemBased}
              disabled={toggling}
              onChange={(e) => toggleItemBased(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">{t.itemBased.label}</span>
          </label>
          <p className="text-sm text-muted-foreground">
            {toggling ? t.itemBased.enabling : t.itemBased.hint}
          </p>
          {!itemBased && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
              {t.itemBased.disabledHint}
            </p>
          )}
        </CardContent>
      </Card>

      {itemBased && (
        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="items" className="min-h-[44px]">
              {t.sections.items}
            </TabsTrigger>
            <TabsTrigger value="blocks" className="min-h-[44px]">
              {t.sections.blocks}
            </TabsTrigger>
            <TabsTrigger value="import" className="min-h-[44px]">
              {t.sections.import}
            </TabsTrigger>
            <TabsTrigger value="templates" className="min-h-[44px]">
              {t.sections.templates}
            </TabsTrigger>
            <TabsTrigger value="customerPls" className="min-h-[44px]">
              {t.sections.customerPls}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Card>
              <CardContent className="pt-6">
                <ItemsSection
                  data={items}
                  blocks={blocks}
                  loading={itemsLoading}
                  status={status}
                  blockKey={blockKey}
                  search={search}
                  onStatusChange={setStatus}
                  onBlockChange={setBlockKey}
                  onSearchChange={setSearch}
                  onReload={loadItems}
                  onSelect={setSelectedItemId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocks">
            <Card>
              <CardContent className="pt-6">
                <BlocksSection
                  projectId={projectId}
                  blocks={blocks}
                  onChange={() => {
                    loadBlocks();
                    loadItems();
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardContent className="pt-6">
                <PdfImportSection projectId={projectId} onImported={afterImport} />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <ImportSection projectId={projectId} onImported={afterImport} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardContent className="pt-6">
                <TemplatesSection />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customerPls">
            <Card>
              <CardContent className="pt-6">
                <CustomerPlsSection
                  projectId={projectId}
                  assignments={customerPls}
                  onChange={loadCustomerPls}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <ItemDetailSheet
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  );
}
