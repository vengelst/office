import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

export default function WorkersPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.workers.title} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {texts.workers.placeholder}
        </CardContent>
      </Card>
    </div>
  );
}
