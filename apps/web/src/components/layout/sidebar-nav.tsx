'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { navGroups } from './nav-items';

interface SidebarNavProps {
  onNavigate?: () => void;
}

/** Gemeinsame Navigationsliste für Desktop-Sidebar und mobiles Sheet. */
export function SidebarNav({ onNavigate }: SidebarNavProps): React.ReactNode {
  const pathname = usePathname();

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
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
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
