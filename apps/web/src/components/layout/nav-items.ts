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
import { hasPermission } from '@/lib/auth-context';
import { isCustomerPlOnly } from '@/lib/roles';
import { texts } from '@/lib/texts';

/**
 * Typ/Interface `NavItem` für die Web-App.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optionale Permission – Eintrag nur sichtbar wenn vorhanden (oder SUPERADMIN). */
  permission?: string;
}

/**
 * Typ/Interface `NavGroup` für die Web-App.
 */
export interface NavGroup {
  /** Optionaler Abschnittstitel; ohne Titel wird keine Überschrift gerendert. */
  label?: string;
  items: NavItem[];
}

/** Hauptnavigation, in Abschnitte gruppiert – Reihenfolge entspricht der Sidebar. */
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
      { href: '/settings', label: texts.nav.settings, icon: Settings },
    ],
  },
];

/** Flache Liste aller Nav-Items (z. B. für Active-State-Lookups). */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

/**
 * Navigation des Kunden-PLs – bewusst nur Item-Prüfung und Stundenzettel.
 */
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

/**
 * Navigationsgruppen passend zu den Rollen des angemeldeten Benutzers.
 */
export function navGroupsForUser(user: AuthUser | null | undefined): NavGroup[] {
  return isCustomerPlOnly(user) ? customerPlNavGroups : navGroups;
}

/**
 * Filtert Nav-Items nach Feature-Flags und Permissions.
 */
export function filterNavGroups(
  groups: NavGroup[],
  user: AuthUser | null | undefined,
  flagAllows: (href: string) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!flagAllows(item.href)) return false;
        if (item.permission && !hasPermission(user, item.permission)) {
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}
