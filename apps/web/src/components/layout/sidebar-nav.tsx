/**
 * Navigationsliste der Sidebar.
 * Teil des App-Chrome unter components/layout.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { navGroupsForUser } from './nav-items';

interface SidebarNavProps {
  onNavigate?: () => void;
}

/**
 * Gemeinsame Navigationsliste für Desktop-Sidebar und mobiles Sheet.
 *
 * @param props - Komponenten-Props
 */

export function SidebarNav({ onNavigate }: SidebarNavProps): React.ReactNode {
  const pathname = usePathname();
  const { user } = useAuth();
  const navGroups = navGroupsForUser(user);

  // Genauester Treffer gewinnt, damit z. B. /pl/timesheets nicht zusätzlich
  // den Eintrag /pl markiert.
  const activeHref = navGroups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter(
      (href) => pathname === href || pathname.startsWith(`${href}/`),
    )
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navGroups.map((group, groupIndex) => (
        <div
          key={group.label ?? `group-${groupIndex}`}
          className={cn(groupIndex > 0 && 'mt-2')}
        >
          {group.label && (
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
