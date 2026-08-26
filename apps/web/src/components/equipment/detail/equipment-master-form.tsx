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
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_CONDITIONS,
  type EquipmentDetail,
} from '@/lib/equipment';
import { texts } from '@/lib/texts';

export function EquipmentMasterForm({
  equipment,
  saving,
  onSubmit,
}: {
  equipment: EquipmentDetail;
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}): React.ReactNode {
  const t = texts.equipment;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t.sections.base}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">{t.fields.name} *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={equipment.name}
                  required
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">{t.fields.description}</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={equipment.description ?? ''}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">{t.fields.category}</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={equipment.category ?? ''}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer">{t.fields.manufacturer}</Label>
                <Input
                  id="manufacturer"
                  name="manufacturer"
                  defaultValue={equipment.manufacturer ?? ''}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">{t.fields.model}</Label>
                <Input
                  id="model"
                  name="model"
                  defaultValue={equipment.model ?? ''}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serialNumber">{t.fields.serialNumber}</Label>
                <Input
                  id="serialNumber"
                  name="serialNumber"
                  defaultValue={equipment.serialNumber ?? ''}
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
                  defaultValue={equipment.inventoryNumber ?? ''}
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
                  defaultValue={
                    equipment.purchaseDate
                      ? equipment.purchaseDate.slice(0, 10)
                      : ''
                  }
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
                  defaultValue={equipment.purchasePrice ?? ''}
                  className="min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t.sections.state}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.fields.status}</Label>
                <Select name="status" defaultValue={equipment.status}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t.status[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.fields.condition}</Label>
                <Select name="condition" defaultValue={equipment.condition}>
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
            <h3 className="text-sm font-semibold">{t.sections.notes}</h3>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={equipment.notes ?? ''}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="min-h-[44px]" disabled={saving}>
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
