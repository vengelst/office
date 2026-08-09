import { SidebarNav } from './sidebar-nav';
import { AppBrand } from './app-brand';

/** Feste Desktop-Sidebar (ab md sichtbar). */
export function Sidebar(): React.ReactNode {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 shrink-0 items-center overflow-hidden border-b px-4">
        <AppBrand />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  );
}
