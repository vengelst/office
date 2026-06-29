import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

export default function CustomersPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.customers.title} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {texts.customers.placeholder}
        </CardContent>
      </Card>
    </div>
  );
}
