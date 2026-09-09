/**
 * Seite: settings / users – Benutzerliste und Rollen-Matrix.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Shield, UserCog } from 'lucide-react';
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
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { hasPermission, useAuth } from '@/lib/auth-context';
import { texts } from '@/lib/texts';
import {
  usersApi,
  type OfficeUser,
  type PermissionItem,
  type RoleWithPermissions,
} from '@/lib/users';

const ROLE_CODES = [
  'SUPERADMIN',
  'OFFICE',
  'PROJECT_MANAGER',
  'WORKER',
  'CUSTOMER_PL',
] as const;

type Tab = 'users' | 'roles';

export default function UsersSettingsPage(): React.ReactNode {
  const t = texts.settings.users;
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'users.manage');

  const [tab, setTab] = useState<Tab>('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeUser | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    roles: [] as string[],
    notes: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [u, r, p] = await Promise.all([
        usersApi.list(),
        usersApi.listRoles(),
        usersApi.listPermissions(),
      ]);
      setUsers(u);
      setRoles(r);
      setPermissions(p);
      const next: Record<string, Set<string>> = {};
      for (const role of r) {
        next[role.code] = new Set(role.permissions);
      }
      setMatrix(next);
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, t.toast.error, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (): void => {
    setEditing(null);
    setForm({
      displayName: '',
      email: '',
      password: '',
      roles: ['OFFICE'],
      notes: '',
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (u: OfficeUser): void => {
    setEditing(u);
    setForm({
      displayName: u.displayName,
      email: u.email,
      password: '',
      roles: u.roles.map((r) => r.role.code),
      notes: u.notes ?? '',
      isActive: u.isActive,
    });
    setDialogOpen(true);
  };

  const toggleFormRole = (code: string): void => {
    setForm((prev) => {
      const has = prev.roles.includes(code);
      return {
        ...prev,
        roles: has
          ? prev.roles.filter((c) => c !== code)
          : [...prev.roles, code],
      };
    });
  };

  const saveUser = async (): Promise<void> => {
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, {
          displayName: form.displayName,
          email: form.email,
          roles: form.roles,
          notes: form.notes || undefined,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        toast({ description: t.toast.saved });
      } else {
        await usersApi.create({
          displayName: form.displayName,
          email: form.email,
          password: form.password,
          roles: form.roles,
          notes: form.notes || undefined,
        });
        toast({ description: t.toast.created });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (u: OfficeUser): Promise<void> => {
    try {
      await usersApi.deactivate(u.id);
      toast({ description: t.toast.deactivated });
      await load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  const toggleMatrix = (roleCode: string, perm: string): void => {
    setMatrix((prev) => {
      const next = { ...prev };
      const set = new Set(next[roleCode] ?? []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      next[roleCode] = set;
      return next;
    });
  };

  const saveRole = async (roleCode: string): Promise<void> => {
    setSavingRole(roleCode);
    try {
      const perms = [...(matrix[roleCode] ?? [])];
      await usersApi.setRolePermissions(roleCode, perms);
      toast({ description: t.toast.roleSaved });
      await load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSavingRole(null);
    }
  };

  const roleColumns = useMemo(
    () =>
      roles.length > 0
        ? roles
        : ROLE_CODES.map((code) => ({
            id: code,
            code,
            name: code,
            description: null,
            permissions: [] as string[],
          })),
    [roles],
  );

  if (!canManage) {
    return (
      <div className="space-y-4">
        <PageHeader title={t.title} />
        <p className="text-sm text-muted-foreground">{t.toast.noPermission}</p>
        <Button variant="outline" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.back}
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.back}
            </Link>
          </Button>
          <PageHeader title={t.title} />
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {tab === 'users' && (
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            {t.add}
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={tab === 'users' ? 'default' : 'ghost'}
          onClick={() => setTab('users')}
          className="min-h-[44px]"
        >
          <UserCog className="mr-2 h-4 w-4" />
          {t.tabUsers}
        </Button>
        <Button
          variant={tab === 'roles' ? 'default' : 'ghost'}
          onClick={() => setTab('roles')}
          className="min-h-[44px]"
        >
          <Shield className="mr-2 h-4 w-4" />
          {t.tabRoles}
        </Button>
      </div>

      {tab === 'users' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {users.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">{t.columns.name}</th>
                    <th className="p-3 font-medium">{t.columns.email}</th>
                    <th className="p-3 font-medium">{t.columns.roles}</th>
                    <th className="p-3 font-medium">{t.columns.status}</th>
                    <th className="p-3 font-medium">{t.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{u.displayName}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">
                        {u.roles.map((r) => r.role.code).join(', ') || '—'}
                      </td>
                      <td className="p-3">
                        {u.isActive ? t.active : t.inactive}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(u)}
                          >
                            {t.edit}
                          </Button>
                          {u.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void deactivate(u)}
                            >
                              {t.deactivate}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'roles' && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <div>
              <h3 className="font-medium">{t.matrix.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t.matrix.hint}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 sticky left-0 bg-background">
                      {t.matrix.permission}
                    </th>
                    {roleColumns.map((r) => (
                      <th key={r.code} className="p-2 text-center min-w-[7rem]">
                        <div>{r.name}</div>
                        <Button
                          size="sm"
                          className="mt-2"
                          disabled={savingRole === r.code}
                          onClick={() => void saveRole(r.code)}
                        >
                          {savingRole === r.code
                            ? t.matrix.saving
                            : t.matrix.saveRole}
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.code} className="border-b last:border-0">
                      <td className="p-2 sticky left-0 bg-background">
                        <div className="font-mono">{p.code}</div>
                        {p.description && (
                          <div className="text-muted-foreground">
                            {p.description}
                          </div>
                        )}
                      </td>
                      {roleColumns.map((r) => (
                        <td key={r.code} className="p-2 text-center">
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={matrix[r.code]?.has(p.code) ?? false}
                            onChange={() => toggleMatrix(r.code, p.code)}
                            aria-label={`${r.code} ${p.code}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.form.editTitle : t.form.createTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.form.displayName}</Label>
              <Input
                className="mt-1 min-h-[44px]"
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{t.form.email}</Label>
              <Input
                className="mt-1 min-h-[44px]"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>
                {editing ? t.form.passwordOptional : t.form.password}
              </Label>
              <Input
                className="mt-1 min-h-[44px]"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{t.form.roles}</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {ROLE_CODES.map((code) => (
                  <label
                    key={code}
                    className="flex min-h-[44px] items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={form.roles.includes(code)}
                      onChange={() => toggleFormRole(code)}
                    />
                    <span className="text-sm">{code}</span>
                  </label>
                ))}
              </div>
            </div>
            {editing && (
              <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                <span className="text-sm">{t.active}</span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.form.cancel}
            </Button>
            <Button
              disabled={
                saving ||
                !form.displayName ||
                !form.email ||
                (!editing && form.password.length < 6) ||
                form.roles.length === 0
              }
              onClick={() => void saveUser()}
            >
              {saving ? t.form.saving : t.form.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
