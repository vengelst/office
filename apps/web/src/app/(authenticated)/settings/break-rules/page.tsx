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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ApiError } from '@/lib/api-client';
import { projectsApi, type ProjectListItem } from '@/lib/projects';
import {
  breakRulesApi,
  type BreakRuleBody,
  type BreakRuleItem,
  type BreakScopeType,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';

export default function BreakRulesPage(): React.ReactNode {
  const t = texts.breakRules;
  const { toast } = useToast();

  const [rules, setRules] = useState<BreakRuleItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [editing, setEditing] = useState<BreakRuleItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = (): void => {
    breakRulesApi
      .list()
      .then(setRules)
      .catch(() => setRules([]));
  };

  useEffect(() => {
    load();
    projectsApi
      .list({ limit: 100 })
      .then((r) => setProjects(r.data))
      .catch(() => setProjects([]));
  }, []);

  const handleDelete = (): void => {
    if (!deleteId) return;
    breakRulesApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        setDeleteId(null);
        load();
      })
      .catch(() => toast({ description: t.toast.error }));
  };

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button className="min-h-[44px]" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t.newRule}
        </Button>
      </PageHeader>

      {rules === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rules.length === 0 ? (
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
                <TableHead>{t.columns.name}</TableHead>
                <TableHead>{t.columns.scope}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t.columns.project}
                </TableHead>
                <TableHead>{t.columns.threshold1}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t.columns.threshold2}
                </TableHead>
                <TableHead>{t.columns.active}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(r)}
                >
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.scope[r.scopeType]}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {r.project?.title ?? '–'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.rule(r.thresholdMinutes1, r.breakMinutes1)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {r.thresholdMinutes2 != null && r.breakMinutes2 != null
                      ? t.rule(r.thresholdMinutes2, r.breakMinutes2)
                      : '–'}
                  </TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      >
                        ✓
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        –
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(r.id);
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
        <RuleDialog
          rule={editing}
          projects={projects}
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
        onConfirm={handleDelete}
      />
    </div>
  );
}

const SCOPES: BreakScopeType[] = ['GLOBAL', 'PROJECT'];

function RuleDialog({
  rule,
  projects,
  onClose,
  onSaved,
}: {
  rule: BreakRuleItem | null;
  projects: ProjectListItem[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactNode {
  const t = texts.breakRules.dialog;
  const { toast } = useToast();

  const [name, setName] = useState(rule?.name ?? '');
  const [scopeType, setScopeType] = useState<BreakScopeType>(
    rule?.scopeType ?? 'GLOBAL',
  );
  const [projectId, setProjectId] = useState(rule?.projectId ?? '');
  const [autoDeduct, setAutoDeduct] = useState(rule?.autoDeductEnabled ?? true);
  const [threshold1, setThreshold1] = useState(rule?.thresholdMinutes1 ?? 360);
  const [break1, setBreak1] = useState(rule?.breakMinutes1 ?? 30);
  const [threshold2, setThreshold2] = useState<number | ''>(
    rule?.thresholdMinutes2 ?? '',
  );
  const [break2, setBreak2] = useState<number | ''>(rule?.breakMinutes2 ?? '');
  const [active, setActive] = useState(rule?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    if (!name.trim()) return;
    if (scopeType === 'PROJECT' && !projectId) return;
    setBusy(true);
    const body: BreakRuleBody = {
      scopeType,
      projectId: scopeType === 'PROJECT' ? projectId : undefined,
      name: name.trim(),
      autoDeductEnabled: autoDeduct,
      thresholdMinutes1: Number(threshold1),
      breakMinutes1: Number(break1),
      thresholdMinutes2: threshold2 === '' ? null : Number(threshold2),
      breakMinutes2: break2 === '' ? null : Number(break2),
      active,
    };
    try {
      if (rule) {
        await breakRulesApi.update(rule.id, body);
        toast({ description: texts.breakRules.toast.updated });
      } else {
        await breakRulesApi.create(body);
        toast({ description: texts.breakRules.toast.created });
      }
      onSaved();
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.breakRules.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t.editTitle : t.createTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.scope}</Label>
              <Select
                value={scopeType}
                onValueChange={(v) => setScopeType(v as BreakScopeType)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {texts.breakRules.scope[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scopeType === 'PROJECT' && (
              <div className="space-y-1.5">
                <Label>{t.project}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder={t.selectProject} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.threshold1}</Label>
              <Input
                type="number"
                min={0}
                value={threshold1}
                onChange={(e) => setThreshold1(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.break1}</Label>
              <Input
                type="number"
                min={0}
                value={break1}
                onChange={(e) => setBreak1(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.threshold2}</Label>
              <Input
                type="number"
                min={0}
                value={threshold2}
                onChange={(e) =>
                  setThreshold2(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.break2}</Label>
              <Input
                type="number"
                min={0}
                value={break2}
                onChange={(e) =>
                  setBreak2(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoDeduct}
                onChange={(e) => setAutoDeduct(e.target.checked)}
                className="h-4 w-4"
              />
              {t.autoDeduct}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              {t.active}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={busy || !name.trim()}
            onClick={save}
          >
            {busy ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
