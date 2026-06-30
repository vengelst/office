'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { settingsApi, type SmtpConfig } from '@/lib/settings';
import { texts } from '@/lib/texts';

export default function EmailSettingsPage(): React.ReactNode {
  const t = texts.settings.email;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTo, setTestTo] = useState('');

  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [secure, setSecure] = useState(false);

  useEffect(() => {
    settingsApi
      .getEmailConfig()
      .then((cfg) => {
        setHost(cfg.host);
        setPort(cfg.port);
        setUser(cfg.user);
        setPass(cfg.pass);
        setFromName(cfg.fromName);
        setFromEmail(cfg.fromEmail);
        setSecure(cfg.secure);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveEmailConfig({
        host,
        port,
        user,
        pass,
        fromName,
        fromEmail,
        secure,
      });
      toast({ description: t.toast.saved });
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    if (!testTo.trim()) return;
    setSendingTest(true);
    try {
      const result = await settingsApi.sendTestEmail(testTo.trim());
      if (result.success) {
        toast({ description: t.toast.testSuccess });
      } else {
        toast({
          variant: 'destructive',
          description: result.error ?? t.toast.testFailed,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.host}</Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.example.com"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.port}</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.user}</Label>
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.pass}</Label>
              <Input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.fromName}</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Office"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.fromEmail}</Label>
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@example.com"
                className="min-h-[44px]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="h-4 w-4"
            />
            {t.secure}
          </label>

          <div className="flex justify-end">
            <Button
              className="min-h-[44px]"
              disabled={saving || !host.trim()}
              onClick={handleSave}
            >
              {saving ? t.saving : t.save}
            </Button>
          </div>

          <hr className="border-border" />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t.testEmail}</h3>
            <div className="flex gap-2">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={t.testEmailPlaceholder}
                className="min-h-[44px] max-w-sm"
              />
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={sendingTest || !testTo.trim()}
                onClick={handleTest}
              >
                {sendingTest ? t.sending : t.testEmail}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
