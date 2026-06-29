'use client';

import { Users, FolderKanban, HardHat, Clock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/lib/auth-context';
import { texts } from '@/lib/texts';

const cards = [
  { key: 'customers', label: texts.dashboard.cards.customers, icon: Users },
  { key: 'projects', label: texts.dashboard.cards.projects, icon: FolderKanban },
  { key: 'workers', label: texts.dashboard.cards.workers, icon: HardHat },
  { key: 'hours', label: texts.dashboard.cards.hours, icon: Clock },
] as const;

export default function DashboardPage(): React.ReactNode {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title={texts.dashboard.title}
        description={`${texts.dashboard.welcome}${
          user?.displayName ? `, ${user.displayName}` : ''
        }.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">—</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {texts.dashboard.placeholder}
      </p>
    </div>
  );
}
