import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

export default function ProjectsPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.projects.title} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {texts.projects.placeholder}
        </CardContent>
      </Card>
    </div>
  );
}
