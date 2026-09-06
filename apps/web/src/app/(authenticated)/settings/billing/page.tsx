/**
 * Seite: settings / billing (Office-Web).
 * Verrechnung: Nummernkreise RE/GS, Zahlungsziele, Skonto, Leistungsort-MwSt.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import {
  settingsApi,
  type BillingSettingsData,
  type PerformanceCountry,
} from '@/lib/settings';
import { texts } from '@/lib/texts';

export default function BillingSettingsPage(): React.ReactNode {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = texts.settings.billing;
  const isSuperadmin = Boolean(user?.roles?.includes('SUPERADMIN'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rePrefix, setRePrefix] = useState('RE');
  const [reNext, setReNext] = useState(40000113);
  const [gsPrefix, setGsPrefix] = useState('GS');
  const [gsNext, setGsNext] = useState(40000001);
  const [settings, setSettings] = useState<BillingSettingsData | null>(null);
  const [optionsText, setOptionsText] = useState('7, 14, 30, 60');

  useEffect(() => {
    settingsApi
      .getBilling()
      .then((data) => {
        setRePrefix(data.series.re.prefix);
        setReNext(data.series.re.nextNumber);
        setGsPrefix(data.series.gs.prefix);
        setGsNext(data.series.gs.nextNumber);
        setSettings(data.settings);
        setOptionsText(data.settings.paymentTermOptions.join(', '));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const rePreview = `${rePrefix}-${reNext}`;
  const gsPreview = `${gsPrefix}-${gsNext}`;

  const handleSave = async (): Promise<void> => {
    if (!isSuperadmin || !settings) return;
    setSaving(true);
    const paymentTermOptions = optionsText
      .split(/[,;\s]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0);
    try {
      const saved = await settingsApi.saveBilling({
        series: {
          re: { prefix: rePrefix, nextNumber: Number(reNext) },
          gs: { prefix: gsPrefix, nextNumber: Number(gsNext) },
        },
        settings: {
          ...settings,
          paymentTermOptions,
        },
      });
      setRePrefix(saved.series.re.prefix);
      setReNext(saved.series.re.nextNumber);
      setGsPrefix(saved.series.gs.prefix);
      setGsNext(saved.series.gs.nextNumber);
      setSettings(saved.settings);
      setOptionsText(saved.settings.paymentTermOptions.join(', '));
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

  const updateCountry = (
    index: number,
    patch: Partial<PerformanceCountry>,
  ): void => {
    if (!settings) return;
    const next = settings.performanceCountries.map((c, i) =>
      i === index ? { ...c, ...patch } : c,
    );
    setSettings({ ...settings, performanceCountries: next });
  };

  const addCountry = (): void => {
    if (!settings) return;
    setSettings({
      ...settings,
      performanceCountries: [
        ...settings.performanceCountries,
        { countryCode: '', name: '', standardRate: 0, reducedRate: 0 },
      ],
    });
  };

  const removeCountry = (index: number): void => {
    if (!settings) return;
    setSettings({
      ...settings,
      performanceCountries: settings.performanceCountries.filter(
        (_, i) => i !== index,
      ),
    });
  };

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/settings"
        className="mb-1 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <PageHeader title={t.title} description={t.subtitle}>
        {isSuperadmin ? (
          <Button
            className="min-h-[44px]"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? t.saving : t.save}
          </Button>
        ) : null}
      </PageHeader>

      {!isSuperadmin && (
        <p className="text-sm text-muted-foreground">{t.readOnly}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.series.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <SeriesFields
            title={t.series.reTitle}
            prefix={rePrefix}
            next={reNext}
            preview={rePreview}
            disabled={!isSuperadmin}
            onPrefix={setRePrefix}
            onNext={setReNext}
            labels={t.series}
          />
          <SeriesFields
            title={t.series.gsTitle}
            prefix={gsPrefix}
            next={gsNext}
            preview={gsPreview}
            disabled={!isSuperadmin}
            onPrefix={setGsPrefix}
            onNext={setGsNext}
            labels={t.series}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.paymentTerms.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.paymentTerms.defaultDays}</Label>
            <Input
              type="number"
              min={0}
              className="min-h-[44px]"
              disabled={!isSuperadmin}
              value={settings.defaultPaymentTermDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultPaymentTermDays: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.paymentTerms.options}</Label>
            <Input
              className="min-h-[44px]"
              disabled={!isSuperadmin}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t.paymentTerms.optionsHint}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.skonto.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.skonto.percent}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                value={settings.skonto.percent ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    skonto: {
                      ...settings.skonto,
                      percent:
                        e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.skonto.days}</Label>
              <Input
                type="number"
                min={0}
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                value={settings.skonto.days ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    skonto: {
                      ...settings.skonto,
                      days:
                        e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.skonto.template}</Label>
            <Textarea
              rows={4}
              disabled={!isSuperadmin}
              value={settings.skonto.pdfHintTemplate ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  skonto: {
                    ...settings.skonto,
                    pdfHintTemplate: e.target.value || null,
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">{t.skonto.templateHint}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.countries.title}</CardTitle>
          {isSuperadmin && (
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={addCountry}
            >
              <Plus className="h-4 w-4" />
              {t.countries.add}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.performanceCountries.map((c, index) => (
            <div
              key={`${c.countryCode}-${index}`}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[80px_1fr_110px_110px_44px]"
            >
              <Input
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                placeholder={t.countries.code}
                value={c.countryCode}
                onChange={(e) =>
                  updateCountry(index, {
                    countryCode: e.target.value.toUpperCase(),
                  })
                }
              />
              <Input
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                placeholder={t.countries.name}
                value={c.name}
                onChange={(e) => updateCountry(index, { name: e.target.value })}
              />
              <Input
                type="number"
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                placeholder={t.countries.standardRate}
                value={c.standardRate}
                onChange={(e) =>
                  updateCountry(index, {
                    standardRate: Number(e.target.value),
                  })
                }
              />
              <Input
                type="number"
                className="min-h-[44px]"
                disabled={!isSuperadmin}
                placeholder={t.countries.reducedRate}
                value={c.reducedRate}
                onChange={(e) =>
                  updateCountry(index, { reducedRate: Number(e.target.value) })
                }
              />
              {isSuperadmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] text-destructive"
                  onClick={() => removeCountry(index)}
                  aria-label={t.countries.remove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SeriesFields({
  title,
  prefix,
  next,
  preview,
  disabled,
  onPrefix,
  onNext,
  labels,
}: {
  title: string;
  prefix: string;
  next: number;
  preview: string;
  disabled: boolean;
  onPrefix: (v: string) => void;
  onNext: (v: number) => void;
  labels: {
    prefix: string;
    nextNumber: string;
    preview: string;
    previewLabel: (v: string) => string;
  };
}): React.ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1.5">
        <Label>{labels.prefix}</Label>
        <Input
          className="min-h-[44px]"
          disabled={disabled}
          value={prefix}
          onChange={(e) => onPrefix(e.target.value.toUpperCase())}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{labels.nextNumber}</Label>
        <Input
          type="number"
          min={1}
          className="min-h-[44px]"
          disabled={disabled}
          value={next}
          onChange={(e) => onNext(Number(e.target.value))}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {labels.previewLabel(preview)}
      </p>
    </div>
  );
}
