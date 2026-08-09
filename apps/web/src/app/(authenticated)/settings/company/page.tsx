'use client';

import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { companyLogoUrl, settingsApi } from '@/lib/settings';

const FIELDS = {
  firma: [
    { key: 'name', label: 'Firmenname' },
    { key: 'legalForm', label: 'Rechtsform' },
  ],
  adresse: [
    { key: 'addressLine1', label: 'Adresszeile 1' },
    { key: 'addressLine2', label: 'Adresszeile 2' },
    { key: 'postalCode', label: 'PLZ' },
    { key: 'city', label: 'Stadt' },
    { key: 'country', label: 'Land' },
  ],
  kontakt: [
    { key: 'phone', label: 'Telefon' },
    { key: 'fax', label: 'Fax' },
    { key: 'email', label: 'E-Mail' },
    { key: 'website', label: 'Website' },
  ],
  rechtliches: [
    { key: 'taxNumber', label: 'Steuernummer' },
    { key: 'vatId', label: 'USt-IdNr.' },
    { key: 'registerCourt', label: 'Registergericht' },
    { key: 'registerNumber', label: 'Registernummer' },
    { key: 'managingDirector', label: 'Geschäftsführer' },
  ],
  bank: [
    { key: 'bankName', label: 'Bank' },
    { key: 'bankIban', label: 'IBAN' },
    { key: 'bankBic', label: 'BIC' },
  ],
} as const;

export default function CompanySettingsPage(): React.ReactNode {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [logoTick, setLogoTick] = useState(0);
  const [logoBroken, setLogoBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([settingsApi.getCompanyInfo(), settingsApi.getCompanyLogoKey()])
      .then(([info, logo]) => {
        setData(info);
        setLogoKey(logo.logoKey);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.saveCompanyInfo(data);
      toast({ description: 'Firmeninformationen gespeichert' });
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Fehler beim Speichern',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await settingsApi.uploadCompanyLogo(file);
      setLogoKey(result.logoKey);
      setLogoBroken(false);
      setLogoTick(Date.now());
      toast({ description: 'Logo hochgeladen' });
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Fehler beim Upload',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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

  const renderSection = (
    title: string,
    fields: readonly { key: string; label: string }[],
  ) => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input
              value={data[f.key] ?? ''}
              onChange={(e) => handleChange(f.key, e.target.value)}
              className="min-h-[44px]"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Firmeninformationen"
        description="Stammdaten der Firma für Dokumente und Rechnungen"
      />

      <Card>
        <CardContent className="space-y-8 pt-6">
          {renderSection('Firma', FIELDS.firma)}
          {renderSection('Adresse', FIELDS.adresse)}
          {renderSection('Kontakt', FIELDS.kontakt)}
          {renderSection('Rechtliches', FIELDS.rechtliches)}
          {renderSection('Bankverbindung', FIELDS.bank)}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Logo
            </h3>
            <p className="text-xs text-muted-foreground">
              Erscheint in der App-Navigation, beim Drucken und auf
              Rechnungs-PDFs. Empfohlen: PNG oder JPEG.
            </p>
            {logoKey && !logoBroken && (
              <div className="mb-2 inline-block rounded border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={companyLogoUrl(logoTick || Date.now())}
                  alt="Firmenlogo"
                  className="h-20 max-w-[240px] object-contain"
                  onError={() => setLogoBroken(true)}
                />
              </div>
            )}
            {logoKey && logoBroken && (
              <p className="text-sm text-amber-600">
                Logo ist hinterlegt, konnte aber nicht geladen werden.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="max-w-xs min-h-[44px]"
              />
              {uploading && (
                <span className="text-sm text-muted-foreground">
                  Wird hochgeladen…
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="min-h-[44px]"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Speichert…' : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
