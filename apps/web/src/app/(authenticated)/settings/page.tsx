import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

export default function SettingsPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.settings.title} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {texts.settings.placeholder}
        </CardContent>
      </Card>
    </div>
  );
}
