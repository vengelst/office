/**
 * Frontend-Modul `nav-items.ts` der Office-Web-App.
 */

import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CalendarDays,
  MessageSquare,
  HardHat,
  UsersRound,
  Building2,
  Truck,
  Wrench,
  Clock,
  ClipboardList,
  ClipboardCheck,
  Receipt,
  FolderArchive,
  CheckSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { AuthUser } from '@office/types';
import { hasPermission, isCustomerPlOnly } from '@/lib/roles';
import { texts } from '@/lib/texts';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Wenn gesetzt: Eintrag nur bei vorhandener Permission */
  permission?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: texts.nav.dashboard, icon: LayoutDashboard },
      {
        href: '/todos',
        label: texts.todos.title,
        icon: CheckSquare,
        permission: 'todos.view',
      },
      {
        href: '/customers',
        label: texts.nav.customers,
        icon: Users,
        permission: 'customers.view',
      },
      {
        href: '/projects',
        label: texts.nav.projects,
        icon: FolderKanban,
        permission: 'projects.view',
      },
      {
        href: '/calendar',
        label: texts.nav.calendar,
        icon: CalendarDays,
        permission: 'calendar.view',
      },
      {
        href: '/communication',
        label: texts.nav.communication,
        icon: MessageSquare,
        permission: 'communication.view',
      },
      {
        href: '/workers',
        label: texts.nav.workers,
        icon: HardHat,
        permission: 'workers.view',
      },
      {
        href: '/teams',
        label: texts.nav.teams,
        icon: UsersRound,
        permission: 'teams.view',
      },
      {
        href: '/subcontractors',
        label: texts.nav.subcontractors,
        icon: Building2,
        permission: 'subcontractors.view',
      },
      {
        href: '/vehicles',
        label: texts.nav.vehicles,
        icon: Truck,
        permission: 'vehicles.view',
      },
      {
        href: '/equipment',
        label: texts.equipment.title,
        icon: Wrench,
        permission: 'equipment.view',
      },
      {
        href: '/time-clock',
        label: texts.nav.timeClock,
        icon: Clock,
        permission: 'timeclock.view',
      },
      {
        href: '/timesheets',
        label: texts.nav.timesheets,
        icon: ClipboardList,
        permission: 'timesheets.view',
      },
      {
        href: '/documents',
        label: texts.documents.nav,
        icon: FolderArchive,
        permission: 'documents.view',
      },
    ],
  },
  {
    label: texts.nav.sections.finance,
    items: [
      {
        href: '/invoices',
        label: texts.nav.invoices,
        icon: Receipt,
        permission: 'invoices.view',
      },
    ],
  },
  {
    label: texts.nav.sections.settings,
    items: [
      {
        href: '/settings',
        label: texts.nav.settings,
        icon: Settings,
        permission: 'settings.manage',
      },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const customerPlNavGroups: NavGroup[] = [
  {
    items: [
      {
        href: '/pl',
        label: texts.customerPl.nav.projects,
        icon: FolderKanban,
      },
      {
        href: '/pl/timesheets',
        label: texts.customerPl.nav.timesheets,
        icon: ClipboardCheck,
      },
    ],
  },
];

export function navGroupsForUser(user: AuthUser | null | undefined): NavGroup[] {
  if (isCustomerPlOnly(user)) return customerPlNavGroups;
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true;
        // Ohne geladene Permissions (altes Token): interne Rollen sehen alles
        if (!user?.permissions?.length && user?.roles?.length) {
          return true;
        }
        return hasPermission(user, item.permission);
      }),
    }))
    .filter((g) => g.items.length > 0);
}
