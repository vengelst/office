import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

export default function TimesheetsPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.timesheets.title} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {texts.timesheets.placeholder}
        </CardContent>
      </Card>
    </div>
  );
}
