'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  equipmentApi,
  EQUIPMENT_CONDITIONS,
} from '@/lib/equipment';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const NONE = '__none__';

export default function NewEquipmentPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.equipment;
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      name: fd.get('name') as string,
      description: (fd.get('description') as string) || undefined,
      category: (fd.get('category') as string) || undefined,
      manufacturer: (fd.get('manufacturer') as string) || undefined,
      model: (fd.get('model') as string) || undefined,
      serialNumber: (fd.get('serialNumber') as string) || undefined,
      inventoryNumber: (fd.get('inventoryNumber') as string) || undefined,
      purchaseDate: (fd.get('purchaseDate') as string) || undefined,
      purchasePrice: fd.get('purchasePrice')
        ? Number(fd.get('purchasePrice'))
        : undefined,
      condition:
        (fd.get('condition') as string) !== NONE
          ? (fd.get('condition') as string)
          : undefined,
      notes: (fd.get('notes') as string) || undefined,
    };

    setSubmitting(true);
    try {
      const created = await equipmentApi.create(payload);

      if (imageFile) {
        try {
          await equipmentApi.uploadImage(created.id, imageFile);
        } catch {
          // Image upload is non-critical
        }
      }

      toast({ description: t.toast.created });
      router.push(`/equipment/${created.id}`);
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
      setSubmitting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/equipment"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToList}
      </Link>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t.sections.base}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">{t.fields.name} *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="description">{t.fields.description}</Label>
                  <Textarea id="description" name="description" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">{t.fields.category}</Label>
                  <Input
                    id="category"
                    name="category"
                    placeholder="z.B. Werkzeug, Messgerät, Maschine"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manufacturer">{t.fields.manufacturer}</Label>
                  <Input
                    id="manufacturer"
                    name="manufacturer"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model">{t.fields.model}</Label>
                  <Input
                    id="model"
                    name="model"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="serialNumber">{t.fields.serialNumber}</Label>
                  <Input
                    id="serialNumber"
                    name="serialNumber"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inventoryNumber">
                    {t.fields.inventoryNumber}
                  </Label>
                  <Input
                    id="inventoryNumber"
                    name="inventoryNumber"
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t.sections.purchase}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="purchaseDate">{t.fields.purchaseDate}</Label>
                  <Input
                    id="purchaseDate"
                    name="purchaseDate"
                    type="date"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purchasePrice">
                    {t.fields.purchasePrice} (€)
                  </Label>
                  <Input
                    id="purchasePrice"
                    name="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t.sections.state}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.fields.condition}</Label>
                  <Select name="condition" defaultValue="GOOD">
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_CONDITIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t.condition[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t.fields.image}</h3>
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Vorschau"
                    className="h-24 w-24 rounded-lg border object-cover"
                  />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {imageFile ? t.actions.changeImage : t.actions.uploadImage}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t.sections.notes}</h3>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="min-h-[44px]"
                disabled={submitting}
              >
                {submitting ? t.actions.saving : t.actions.save}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => router.push('/equipment')}
              >
                {t.actions.cancel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
