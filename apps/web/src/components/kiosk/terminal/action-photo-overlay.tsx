'use client';

import { PhotoCommentComposer } from '@/components/kiosk/photo-comment-composer';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { TerminalTranslate } from './types';

interface ActionPhotoOverlayProps {
  photoPending: File;
  photoComment: string;
  processing: boolean;
  t: TerminalTranslate;
  onCommentChange: (value: string) => void;
  onSave: (p: { comment: string; xNorm?: number | null; yNorm?: number | null }) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function ActionPhotoOverlay({
  photoPending,
  photoComment,
  processing,
  t,
  onCommentChange,
  onSave,
  onSkip,
  onCancel,
}: ActionPhotoOverlayProps) {
  return (
    <PhotoCommentComposer
      file={photoPending}
      comment={photoComment}
      onCommentChange={onCommentChange}
      title={t(KT.photoCommentTitle)}
      hint={t(KT.photoCommentHint)}
      placeButton={t(KT.photoCommentPlace)}
      placeHint={t(KT.photoCommentPlaceHint)}
      placeDone={t(KT.photoCommentPlaceDone)}
      clearPlace={t(KT.photoCommentClearPlace)}
      saveLabel={
        processing ? t(KT.photoUploading) : t(KT.photoCommentSave)
      }
      skipLabel={t(KT.photoCommentSkip)}
      cancelLabel={t(KT.back)}
      uploading={processing}
      dark
      onSave={onSave}
      onSkip={onSkip}
      onCancel={onCancel}
    />
  );
}
