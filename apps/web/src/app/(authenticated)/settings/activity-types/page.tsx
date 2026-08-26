/**
 * Seite: Einstellungen / Tätigkeitsbereiche (Master).
 */

'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import {
  activityTypesApi,
  type ActivityTypeBody,
  type ActivityTypeItem,
} from '@/lib/activity-types';
import { texts } from '@/lib/texts';

export default function ActivityTypesPage(): React.ReactNode {
  const t = texts.activityTypes;
  const { toast } = useToast();
  const [items, setItems] = useState<ActivityTypeItem[] | null>(null);
  const [editing, setEditing] = useState<ActivityTypeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = (): void => {
    activityTypesApi
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = (): void => {
    if (!deleteId) return;
    activityTypesApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        setDeleteId(null);
        load();
      })
      .catch(() => toast({ description: t.toast.error, variant: 'destructive' }));
  };

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button className="min-h-[44px]" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t.newItem}
        </Button>
      </PageHeader>

      {items === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.columns.code}</TableHead>
                <TableHead>{t.columns.name}</TableHead>
                <TableHead>{t.columns.sortOrder}</TableHead>
                <TableHead>{t.columns.billable}</TableHead>
                <TableHead>{t.columns.active}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(row)}
                >
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.sortOrder}</TableCell>
                  <TableCell>{row.billable ? 'Ja' : 'Nein'}</TableCell>
                  <TableCell>
                    {row.active ? (
                      <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                        aktiv
                      </Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(row.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {(creating || editing) && (
        <ActivityDialog
          item={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.actions.delete}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ActivityDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ActivityTypeItem | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactNode {
  const t = texts.activityTypes;
  const { toast } = useToast();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 100));
  const [active, setActive] = useState(item?.active ?? true);
  const [billable, setBillable] = useState(item?.billable ?? true);
  const [saving, setSaving] = useState(false);

  const save = (): void => {
    const body: ActivityTypeBody = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      sortOrder: Number(sortOrder) || 0,
      active,
      billable,
    };
    setSaving(true);
    const req = item
      ? activityTypesApi.update(item.id, body)
      : activityTypesApi.create(body);
    req
      .then(() => {
        toast({
          description: item ? t.toast.updated : t.toast.created,
        });
        onSaved();
      })
      .catch(() =>
        toast({ description: t.toast.error, variant: 'destructive' }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? t.editItem : t.newItem}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t.fields.code}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-[44px] font-mono uppercase"
              disabled={!!item}
            />
          </div>
          <div className="space-y-1">
            <Label>{t.fields.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <Label>{t.fields.sortOrder}</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            {t.fields.active}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            {t.fields.billable}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={save}
            disabled={saving || !code.trim() || !name.trim()}
          >
            {item ? t.actions.save : t.actions.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
