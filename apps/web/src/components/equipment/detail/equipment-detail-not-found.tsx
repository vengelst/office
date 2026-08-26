import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { texts } from '@/lib/texts';

export function EquipmentDetailNotFound(): React.ReactNode {
  const t = texts.equipment;

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{t.noResults}</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/equipment">{t.backToList}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
