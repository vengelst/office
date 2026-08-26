/**
 * Seite: todos (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { texts } from '@/lib/texts';
import {
  todosApi,
  type Todo,
  type TodoStatus,
  type TodoPriority,
  type TodoEntityType,
  type TodoUser,
} from '@/lib/todos';
import { TodoTitleHover } from '@/components/todos/todo-title-hover';

const t = texts.todos;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  DONE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

type StatusTab = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'ALL';

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate) return false;
  if (todo.status === 'DONE' || todo.status === 'CANCELLED') return false;
  return new Date(todo.dueDate) < new Date();
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * UI-Komponente `TodosPage`.
 */
export default function TodosPage(): React.ReactNode {
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TodoUser[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('OPEN');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusTab !== 'ALL') params.status = statusTab;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      const res = await todosApi.list(params as any);
      setTodos(res.data);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusTab, priorityFilter]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    todosApi.getUsers().then(setUsers).catch(() => {});
  }, []);

  const toggleStatus = async (todo: Todo) => {
    const newStatus: TodoStatus = todo.status === 'DONE' ? 'OPEN' : 'DONE';
    try {
      await todosApi.updateStatus(todo.id, newStatus);
      toast({
        title: newStatus === 'DONE' ? t.toast.completed : t.toast.updated,
      });
      loadTodos();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await todosApi.remove(id);
      toast({ title: t.toast.deleted });
      loadTodos();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const openCreate = () => {
    setEditingTodo(null);
    setDialogOpen(true);
  };

  const openEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditingTodo(null);
    loadTodos();
  };

  const getUserName = (id: string | null) => {
    if (!id) return '–';
    const u = users.find((u) => u.id === id);
    return u?.displayName ?? '–';
  };

  const bulk = useBulkSelection(todos.map((todo) => todo.id));
  const handleBulkDelete = async (): Promise<void> => {
    try {
      const res = await todosApi.bulkRemove(bulk.selectedIds);
      toast({
        description: `${res.deleted} gelöscht${res.failed ? `, ${res.failed} fehlgeschlagen` : ''}.`,
      });
      bulk.clear();
      loadTodos();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : 'Fehler',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t.title}>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t.new}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as StatusTab)}
        >
          <TabsList>
            <TabsTrigger value="OPEN">{t.filter.open}</TabsTrigger>
            <TabsTrigger value="IN_PROGRESS">{t.filter.inProgress}</TabsTrigger>
            <TabsTrigger value="DONE">{t.filter.done}</TabsTrigger>
            <TabsTrigger value="ALL">{t.filter.all}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t.fields.priority} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.filter.all}</SelectItem>
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {t.priority[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkActionBar count={bulk.count} onDelete={() => setBulkOpen(true)} deleteLabel="Löschen" />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">
              {texts.common.loading}
            </p>
          ) : todos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="w-10 p-3">
                      <input
                        type="checkbox"
                        checked={bulk.allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = bulk.someSelected && !bulk.allSelected;
                        }}
                        onChange={bulk.toggleAll}
                        className="h-4 w-4"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th className="w-10 p-3" />
                    <th className="p-3">{t.fields.title}</th>
                    <th className="p-3">{t.fields.priority}</th>
                    <th className="p-3">{t.fields.dueDate}</th>
                    <th className="p-3">{t.fields.assignedTo}</th>
                    <th className="p-3">{t.fields.linkedEntity}</th>
                    <th className="p-3">{t.fields.status}</th>
                    <th className="w-10 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {todos.map((todo) => {
                    const overdue = isOverdue(todo);
                    return (
                      <tr
                        key={todo.id}
                        className={`border-b transition-colors hover:bg-accent/50 cursor-pointer ${
                          overdue ? 'bg-red-50 dark:bg-red-950/20' : ''
                        }`}
                        onClick={() => openEdit(todo)}
                      >
                        <td
                          className="p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={bulk.isSelected(todo.id)}
                            onChange={() => bulk.toggle(todo.id)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td
                          className="p-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(todo);
                          }}
                        >
                          {todo.status === 'DONE' ? (
                            <CheckSquare className="h-5 w-5 text-green-600 cursor-pointer" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground" />
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          <TodoTitleHover
                            todo={todo}
                            meta={
                              <>
                                <span>
                                  {t.fields.priority}:{' '}
                                  {t.priority[todo.priority]}
                                </span>
                                <span>
                                  {t.fields.dueDate}: {formatDate(todo.dueDate)}
                                </span>
                                <span>
                                  {t.fields.status}: {t.status[todo.status]}
                                </span>
                                {todo.assignedToId ? (
                                  <span>
                                    {t.fields.assignedTo}:{' '}
                                    {getUserName(todo.assignedToId)}
                                  </span>
                                ) : null}
                              </>
                            }
                          >
                            <span className="truncate underline-offset-2 hover:underline">
                              {todo.title}
                            </span>
                            {overdue && (
                              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                            )}
                          </TodoTitleHover>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`border-0 ${PRIORITY_COLORS[todo.priority]}`}
                          >
                            {t.priority[todo.priority]}
                          </Badge>
                        </td>
                        <td
                          className={`p-3 ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}
                        >
                          {formatDate(todo.dueDate)}
                        </td>
                        <td className="p-3">
                          {getUserName(todo.assignedToId)}
                        </td>
                        <td className="p-3">
                          {todo.linkedEntityName ? (
                            <span className="flex items-center gap-1 text-xs">
                              <ExternalLink className="h-3 w-3" />
                              {todo.linkedEntityName}
                            </span>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`border-0 ${STATUS_COLORS[todo.status]}`}
                          >
                            {t.status[todo.status]}
                          </Badge>
                        </td>
                        <td
                          className="p-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(todo.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500 cursor-pointer" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'Aufgabe' : 'Aufgaben'}
        </p>
      )}

      <TodoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        todo={editingTodo}
        users={users}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`${bulk.count} Einträge löschen?`}
        description={t.deleteConfirm}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

function TodoDialog({
  open,
  onOpenChange,
  todo,
  users,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo | null;
  users: TodoUser[];
  onSaved: () => void;
}): React.ReactNode {
  const { toast } = useToast();
  const isEdit = !!todo;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');
  const [status, setStatus] = useState<TodoStatus>('OPEN');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityName, setEntityName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (todo) {
        setTitle(todo.title);
        setDescription(todo.description ?? '');
        setPriority(todo.priority);
        setStatus(todo.status);
        setDueDate(todo.dueDate ? todo.dueDate.split('T')[0] : '');
        setAssignedToId(todo.assignedToId ?? '');
        setEntityType(todo.linkedEntityType ?? '');
        setEntityName(todo.linkedEntityName ?? '');
      } else {
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setStatus('OPEN');
        setDueDate('');
        setAssignedToId('');
        setEntityType('');
        setEntityName('');
      }
    }
  }, [open, todo]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined,
        linkedEntityType: (entityType as TodoEntityType) || undefined,
        linkedEntityName: entityName.trim() || undefined,
      };

      if (isEdit) {
        await todosApi.update(todo.id, data as any);
        toast({ title: t.toast.updated });
      } else {
        await todosApi.create(data as any);
        toast({ title: t.toast.created });
      }
      onSaved();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.edit : t.new}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t.fields.title} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.fields.title}
            />
          </div>

          <div>
            <Label>{t.fields.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t.fields.description}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.fields.priority}</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TodoPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                    <SelectItem key={p} value={p}>
                      {t.priority[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t.fields.status}</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TodoStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t.status[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.fields.dueDate}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div>
              <Label>{t.fields.assignedTo}</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">–</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.fields.linkedEntity}</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">–</SelectItem>
                  {(
                    [
                      'CUSTOMER',
                      'PROJECT',
                      'WORKER',
                      'SUBCONTRACTOR',
                      'EQUIPMENT',
                    ] as const
                  ).map((et) => (
                    <SelectItem key={et} value={et}>
                      {t.entityType[et]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entityType && (
              <div>
                <Label>Name</Label>
                <Input
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder={`${t.entityType[entityType]}: Name`}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
              {saving ? 'Wird gespeichert …' : 'Speichern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
