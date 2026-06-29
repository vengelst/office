import {
  LayoutDashboard,
  Users,
  FolderKanban,
  HardHat,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { texts } from '@/lib/texts';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Hauptnavigation – Reihenfolge entspricht der Sidebar. */
export const navItems: NavItem[] = [
  { href: '/dashboard', label: texts.nav.dashboard, icon: LayoutDashboard },
  { href: '/customers', label: texts.nav.customers, icon: Users },
  { href: '/projects', label: texts.nav.projects, icon: FolderKanban },
  { href: '/workers', label: texts.nav.workers, icon: HardHat },
  { href: '/timesheets', label: texts.nav.timesheets, icon: ClipboardList },
  { href: '/settings', label: texts.nav.settings, icon: Settings },
];
