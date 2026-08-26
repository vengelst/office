import { Skeleton } from '@/components/ui/skeleton';

export function EquipmentDetailLoading(): React.ReactNode {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
