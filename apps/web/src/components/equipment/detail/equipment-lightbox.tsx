import { X } from 'lucide-react';

export function EquipmentLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}): React.ReactNode {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 text-white"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt="Gerätebild"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
