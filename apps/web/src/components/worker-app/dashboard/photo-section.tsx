import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoCommentComposer } from '@/components/kiosk/photo-comment-composer';

interface PhotoSectionProps {
  photoOpen: boolean;
  photoFile: File | null;
  photoComment: string;
  photoBusy: boolean;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onFileSelect: (file: File | null) => void;
  onCommentChange: (comment: string) => void;
  onSave: (payload: {
    comment: string;
    xNorm?: number | null;
    yNorm?: number | null;
  }) => void;
  onSkip: () => void;
  labels: {
    addPhoto: string;
    photoCancel: string;
    photoCommentHint: string;
    photoPlace: string;
    photoPlaceHint: string;
    photoPlaceDone: string;
    photoClearPlace: string;
    photoUploading: string;
    photoUpload: string;
    photoSkip: string;
  };
}

export function PhotoSection({
  photoOpen,
  photoFile,
  photoComment,
  photoBusy,
  photoInputRef,
  onOpen,
  onClose,
  onFileSelect,
  onCommentChange,
  onSave,
  onSkip,
  labels,
}: PhotoSectionProps) {
  return (
    <section>
      {!photoOpen ? (
        <Button
          variant="outline"
          className="min-h-[56px] w-full text-base"
          onClick={onOpen}
        >
          <Camera className="h-5 w-5" />
          {labels.addPhoto}
        </Button>
      ) : !photoFile ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              onFileSelect(f);
            }}
          />
          <Button
            variant="secondary"
            className="min-h-[56px] w-full text-base"
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            {labels.addPhoto}
          </Button>
          <Button
            variant="ghost"
            className="min-h-[48px] w-full"
            onClick={onClose}
          >
            {labels.photoCancel}
          </Button>
        </div>
      ) : (
        <PhotoCommentComposer
          file={photoFile}
          comment={photoComment}
          onCommentChange={onCommentChange}
          title={labels.addPhoto}
          hint={labels.photoCommentHint}
          placeButton={labels.photoPlace}
          placeHint={labels.photoPlaceHint}
          placeDone={labels.photoPlaceDone}
          clearPlace={labels.photoClearPlace}
          saveLabel={photoBusy ? labels.photoUploading : labels.photoUpload}
          skipLabel={labels.photoSkip}
          cancelLabel={labels.photoCancel}
          uploading={photoBusy}
          onSave={(p) =>
            onSave({
              comment: p.comment,
              xNorm: p.xNorm,
              yNorm: p.yNorm,
            })
          }
          onSkip={onSkip}
          onCancel={onClose}
        />
      )}
    </section>
  );
}
