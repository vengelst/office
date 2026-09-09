/**
 * Benutzerverwaltung – Anlegen, Rollen, Deaktivieren + Rollenrechte-Matrix.
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
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { hasPermission } from '@/lib/roles';
import {
  usersApi,
  type CreateUserInput,
  type OfficeUser,
  type PermissionRow,
  type RoleCode,
  type RoleWithPermissions,
} from '@/lib/users';

const ALL_ROLES: RoleCode[] = [
  'SUPERADMIN',
  'OFFICE',
  'PROJECT_MANAGER',
  'WORKER',
  'CUSTOMER_PL',
];

type Tab = 'users' | 'roles';

export default function UsersSettingsPage(): React.ReactNode {
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'users.manage');
  const [tab, setTab] = useState<Tab>('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [editing, setEditing] = useState<OfficeUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    notes: '',
    isActive: true,
    roles: ['OFFICE'] as RoleCode[],
  });
  const [matrixRole, setMatrixRole] = useState<RoleCode>('OFFICE');
  const [matrixPerms, setMatrixPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
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
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Laden fehlgeschlagen',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canManage) void load();
    else setLoading(false);
  }, [canManage, load]);

  useEffect(() => {
    const role = roles.find((r) => r.code === matrixRole);
    setMatrixPerms(new Set(role?.permissions ?? []));
  }, [roles, matrixRole]);

  const resetForm = () => {
    setEditing(null);
    setCreating(false);
    setForm({
      email: '',
      displayName: '',
      password: '',
      notes: '',
      isActive: true,
      roles: ['OFFICE'],
    });
  };

  const openCreate = () => {
    resetForm();
    setCreating(true);
  };

  const openEdit = (u: OfficeUser) => {
    setCreating(false);
    setEditing(u);
    setForm({
      email: u.email,
      displayName: u.displayName,
      password: '',
      notes: u.notes ?? '',
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role.code),
    });
  };

  const toggleRole = (code: RoleCode) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(code)
        ? prev.roles.filter((c) => c !== code)
        : [...prev.roles, code],
    }));
  };

  const saveUser = async () => {
    if (!form.email.trim() || !form.displayName.trim()) {
      toast({ variant: 'destructive', description: 'E-Mail und Name sind Pflicht' });
      return;
    }
    if (!form.roles.length) {
      toast({ variant: 'destructive', description: 'Mindestens eine Rolle wählen' });
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        if (form.password.length < 6) {
          toast({
            variant: 'destructive',
            description: 'Passwort mindestens 6 Zeichen',
          });
          return;
        }
        const body: CreateUserInput = {
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          notes: form.notes.trim() || undefined,
          roles: form.roles,
        };
        await usersApi.create(body);
        toast({ description: 'Benutzer angelegt' });
      } else if (editing) {
        await usersApi.update(editing.id, {
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          notes: form.notes.trim() || undefined,
          isActive: form.isActive,
          roles: form.roles,
          ...(form.password ? { password: form.password } : {}),
        });
        toast({ description: 'Benutzer gespeichert' });
      }
      resetForm();
      await load();
      await refreshMe();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen',
      });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (u: OfficeUser) => {
    if (!confirm(`${u.displayName} deaktivieren?`)) return;
    try {
      await usersApi.deactivate(u.id);
      toast({ description: 'Benutzer deaktiviert' });
      await load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Deaktivieren fehlgeschlagen',
      });
    }
  };

  const saveMatrix = async () => {
    setSaving(true);
    try {
      await usersApi.setRolePermissions(matrixRole, [...matrixPerms]);
      toast({ description: 'Rollenrechte gespeichert' });
      await load();
      await refreshMe();
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen',
      });
    } finally {
      setSaving(false);
    }
  };

  const permGroups = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      const prefix = p.code.split('.')[0] ?? p.code;
      const list = groups.get(prefix) ?? [];
      list.push(p);
      groups.set(prefix, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  if (!canManage) {
    return (
      <div className="space-y-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <p className="text-sm text-muted-foreground">
          Keine Berechtigung für die Benutzerverwaltung.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/settings"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Einstellungen
          </Link>
          <PageHeader
            title="Benutzerverwaltung"
            description="Benutzer anlegen und Rechte über Rollen steuern"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'users' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('users')}
          >
            <UserCog className="mr-1 h-4 w-4" /> Benutzer
          </Button>
          <Button
            variant={tab === 'roles' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('roles')}
          >
            <Shield className="mr-1 h-4 w-4" /> Rollenrechte
          </Button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Benutzer</h2>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" /> Neu
                </Button>
              </div>
              <ul className="divide-y">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openEdit(u)}
                    >
                      <p className="truncate text-sm font-medium">
                        {u.displayName}
                        {!u.isActive && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (inaktiv)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email} · {u.roles.map((r) => r.role.code).join(', ')}
                      </p>
                    </button>
                    {u.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void deactivate(u)}
                      >
                        Deaktivieren
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {(creating || editing) && (
            <Card>
              <CardContent className="space-y-3 py-5">
                <h2 className="text-sm font-semibold">
                  {creating ? 'Neuer Benutzer' : 'Benutzer bearbeiten'}
                </h2>
                <div className="space-y-2">
                  <Label>Anzeigename</Label>
                  <Input
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, displayName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Passwort{editing ? ' (leer = unverändert)' : ''}
                  </Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notizen</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
                {editing && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, isActive: e.target.checked }))
                      }
                    />
                    Aktiv
                  </label>
                )}
                <div className="space-y-2">
                  <Label>Rollen</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((code) => (
                      <label
                        key={code}
                        className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={form.roles.includes(code)}
                          onChange={() => toggleRole(code)}
                        />
                        {code}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => void saveUser()} disabled={saving}>
                    Speichern
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Rolle</Label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={matrixRole}
                  onChange={(e) => setMatrixRole(e.target.value as RoleCode)}
                >
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={() => void saveMatrix()} disabled={saving}>
                Rechte speichern
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Beispiel: Bei OFFICE die Rechte invoices.* entfernen, dann sehen
              Büro-Benutzer keine Rechnungen mehr.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {permGroups.map(([group, rows]) => (
                <div key={group} className="rounded border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <ul className="space-y-1">
                    {rows.map((p) => (
                      <li key={p.code}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={matrixPerms.has(p.code)}
                            disabled={matrixRole === 'SUPERADMIN'}
                            onChange={() => {
                              setMatrixPerms((prev) => {
                                const next = new Set(prev);
                                if (next.has(p.code)) next.delete(p.code);
                                else next.add(p.code);
                                return next;
                              });
                            }}
                          />
                          {p.code}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
