import Link from 'next/link';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EquipmentDetail } from '@/lib/equipment';
import { texts } from '@/lib/texts';
import { statusColor } from './constants';

export function EquipmentDetailHeader({
  equipment,
  onDelete,
}: {
  equipment: EquipmentDetail;
  onDelete: () => void;
}): React.ReactNode {
  const t = texts.equipment;

  return (
    <>
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/equipment" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{equipment.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {equipment.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {equipment.category && (
              <Badge variant="outline">{equipment.category}</Badge>
            )}
            <Badge
              variant="secondary"
              className={statusColor[equipment.status] ?? ''}
            >
              {t.status[equipment.status]}
            </Badge>
            {equipment.inventoryNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {equipment.inventoryNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            {t.actions.delete}
          </Button>
        </div>
      </div>
    </>
  );
}
