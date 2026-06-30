import {
  LayoutDashboard,
  Users,
  FolderKanban,
  HardHat,
  UsersRound,
  Building2,
  Truck,
  Clock,
  ClipboardList,
  Receipt,
  Coffee,
  FolderArchive,
  Settings,
  Mail,
  HardDrive,
  type LucideIcon,
} from 'lucide-react';
import { texts } from '@/lib/texts';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

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
      { href: '/customers', label: texts.nav.customers, icon: Users },
      { href: '/projects', label: texts.nav.projects, icon: FolderKanban },
      { href: '/workers', label: texts.nav.workers, icon: HardHat },
      { href: '/teams', label: texts.nav.teams, icon: UsersRound },
      {
        href: '/subcontractors',
        label: texts.nav.subcontractors,
        icon: Building2,
      },
      { href: '/vehicles', label: texts.nav.vehicles, icon: Truck },
      { href: '/time-clock', label: texts.nav.timeClock, icon: Clock },
      { href: '/timesheets', label: texts.nav.timesheets, icon: ClipboardList },
      { href: '/documents', label: texts.documents.nav, icon: FolderArchive },
    ],
  },
  {
    label: texts.nav.sections.finance,
    items: [{ href: '/invoices', label: texts.nav.invoices, icon: Receipt }],
  },
  {
    items: [
      {
        href: '/settings/break-rules',
        label: texts.nav.breakRules,
        icon: Coffee,
      },
      {
        href: '/settings/email',
        label: texts.settings.nav.email,
        icon: Mail,
      },
      {
        href: '/settings/storage',
        label: texts.settings.nav.storage,
        icon: HardDrive,
      },
      { href: '/settings', label: texts.nav.settings, icon: Settings },
    ],
  },
];

/** Flache Liste aller Nav-Items (z. B. für Active-State-Lookups). */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
