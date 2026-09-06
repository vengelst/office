/**
 * Seite: app/(authenticated)/settings/company/page.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

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
import {
  companyLogoDarkUrl,
  companyLogoUrl,
  settingsApi,
} from '@/lib/settings';

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

const VAT_COUNTRY_FIELDS: readonly { code: string; label: string }[] = [
  { code: 'DE', label: 'USt-IdNr. Deutschland (DE)' },
  { code: 'LU', label: 'USt-IdNr. Luxemburg (LU)' },
  { code: 'NL', label: 'USt-IdNr. Niederlande (NL)' },
  { code: 'FR', label: 'USt-IdNr. Frankreich (FR)' },
];

export default function CompanySettingsPage(): React.ReactNode {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [vatByCountry, setVatByCountry] = useState<Record<string, string>>({});
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [logoTick, setLogoTick] = useState(0);
  const [logoBroken, setLogoBroken] = useState(false);
  const [logoDarkKey, setLogoDarkKey] = useState<string | null>(null);
  const [logoDarkTick, setLogoDarkTick] = useState(0);
  const [logoDarkBroken, setLogoDarkBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileDarkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      settingsApi.getCompanyInfo(),
      settingsApi.getCompanyLogoKey(),
      settingsApi.getCompanyLogoDarkKey(),
    ])
      .then(([info, logo, logoDark]) => {
        const raw = info as Record<string, unknown>;
        const nextData: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (k === 'vatIdsByCountry') continue;
          if (typeof v === 'string') nextData[k] = v;
        }
        const byCountry: Record<string, string> = {};
        const incoming = raw.vatIdsByCountry;
        if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
          for (const [code, id] of Object.entries(
            incoming as Record<string, unknown>,
          )) {
            if (typeof id === 'string' && id.trim()) {
              byCountry[code.toUpperCase()] = id.trim();
            }
          }
        }
        if (typeof raw.vatId === 'string' && raw.vatId.trim() && !byCountry.DE) {
          byCountry.DE = raw.vatId.trim();
        }
        setData(nextData);
        setVatByCountry(byCountry);
        setLogoKey(logo.logoKey);
        setLogoDarkKey(logoDark.logoKey);
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
      const vatIdsByCountry: Record<string, string> = {};
      for (const [code, id] of Object.entries(vatByCountry)) {
        const trimmed = id.trim();
        if (trimmed) vatIdsByCountry[code.toUpperCase()] = trimmed;
      }
      await settingsApi.saveCompanyInfo({
        ...data,
        vatId: vatIdsByCountry.DE ?? data.vatId ?? '',
        vatIdsByCountry,
      });
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

  const handleLogoDarkUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDark(true);
    try {
      const result = await settingsApi.uploadCompanyLogoDark(file);
      setLogoDarkKey(result.logoKey);
      setLogoDarkBroken(false);
      setLogoDarkTick(Date.now());
      toast({ description: 'Dark-Mode-Logo hochgeladen' });
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : 'Fehler beim Upload',
      });
    } finally {
      setUploadingDark(false);
      if (fileDarkRef.current) fileDarkRef.current.value = '';
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

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              USt-IdNr. je Leistungsort
            </h3>
            <p className="text-xs text-muted-foreground">
              Auf Rechnungen wird die USt-IdNr. des Leistungsorts verwendet
              (z.&nbsp;B. LU oder NL). Fehlt sie, gilt die deutsche Id.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VAT_COUNTRY_FIELDS.map((f) => (
                <div key={f.code} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    value={vatByCountry[f.code] ?? ''}
                    onChange={(e) =>
                      setVatByCountry((prev) => ({
                        ...prev,
                        [f.code]: e.target.value,
                      }))
                    }
                    className="min-h-[44px]"
                    placeholder={`${f.code}…`}
                  />
                </div>
              ))}
            </div>
          </div>

          {renderSection('Bankverbindung', FIELDS.bank)}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Logo
            </h3>
            <p className="text-xs text-muted-foreground">
              Erscheint in der App-Navigation (Hellmodus), beim Drucken und auf
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

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Logo Dark Mode
            </h3>
            <p className="text-xs text-muted-foreground">
              Helle Variante für die Navigation im Dark Mode. Fehlt sie, wird
              das Standard-Logo verwendet. Druck und PDFs nutzen weiterhin das
              Standard-Logo.
            </p>
            {logoDarkKey && !logoDarkBroken && (
              <div className="mb-2 inline-block rounded border bg-zinc-900 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={companyLogoDarkUrl(logoDarkTick || Date.now())}
                  alt="Firmenlogo Dark Mode"
                  className="h-20 max-w-[240px] object-contain"
                  onError={() => setLogoDarkBroken(true)}
                />
              </div>
            )}
            {logoDarkKey && logoDarkBroken && (
              <p className="text-sm text-amber-600">
                Dark-Mode-Logo ist hinterlegt, konnte aber nicht geladen werden.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                ref={fileDarkRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoDarkUpload}
                className="max-w-xs min-h-[44px]"
              />
              {uploadingDark && (
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
