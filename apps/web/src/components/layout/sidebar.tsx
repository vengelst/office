import { Building2 } from 'lucide-react';
import { texts } from '@/lib/texts';
import { SidebarNav } from './sidebar-nav';

/** Feste Desktop-Sidebar (ab md sichtbar). */
export function Sidebar(): React.ReactNode {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Building2 className="h-6 w-6 text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">
            {texts.app.name}
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground">
            {texts.app.tagline}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  );
}
