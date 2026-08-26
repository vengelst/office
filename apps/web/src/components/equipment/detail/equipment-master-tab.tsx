import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import type { EquipmentDetail } from '@/lib/equipment';
import { EquipmentImage } from './equipment-image';
import { EquipmentMasterForm } from './equipment-master-form';

export function EquipmentMasterTab({
  equipment,
  saving,
  onSave,
  onImageUpload,
  onLightbox,
}: {
  equipment: EquipmentDetail;
  saving: boolean;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  onImageUpload: (file: File) => void;
  onLightbox: (src: string) => void;
}): React.ReactNode {
  return (
    <TabsContent value="master" className="mt-4 space-y-4">
      <Card>
        <CardContent className="pt-6">
          <EquipmentImage
            equipmentId={equipment.id}
            hasImage={!!equipment.imageKey}
            onUpload={onImageUpload}
            onLightbox={onLightbox}
          />
        </CardContent>
      </Card>

      <EquipmentMasterForm
        equipment={equipment}
        saving={saving}
        onSubmit={onSave}
      />
    </TabsContent>
  );
}
