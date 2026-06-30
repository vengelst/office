import Link from 'next/link';
import { Mail, HardDrive, Coffee } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';

const settingsLinks = [
  {
    href: '/settings/email',
    label: texts.settings.nav.email,
    description: texts.settings.email.subtitle,
    icon: Mail,
  },
  {
    href: '/settings/storage',
    label: texts.settings.nav.storage,
    description: texts.settings.storage.subtitle,
    icon: HardDrive,
  },
  {
    href: '/settings/break-rules',
    label: texts.settings.nav.breakRules,
    description: 'Automatische Pausenregelungen verwalten',
    icon: Coffee,
  },
];

export default function SettingsPage(): React.ReactNode {
  return (
    <div>
      <PageHeader title={texts.settings.title} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-start gap-3 py-5">
                <item.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
