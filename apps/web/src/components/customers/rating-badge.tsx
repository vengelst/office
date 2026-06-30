import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Bewertungs-Badge: A=grün, B=blau, C=gelb, D=rot. */
export function RatingBadge({
  rating,
  className,
}: {
  rating?: string | null;
  className?: string;
}): React.ReactNode {
  if (!rating) {
    return <span className="text-muted-foreground">–</span>;
  }
  const styles: Record<string, string> = {
    A: 'bg-green-600 text-white hover:bg-green-600',
    B: 'bg-blue-600 text-white hover:bg-blue-600',
    C: 'bg-yellow-500 text-black hover:bg-yellow-500',
    D: 'bg-red-600 text-white hover:bg-red-600',
  };
  return (
    <Badge
      className={cn(
        'border-transparent',
        styles[rating.toUpperCase()] ?? 'bg-muted text-foreground',
        className,
      )}
    >
      {rating.toUpperCase()}
    </Badge>
  );
}
