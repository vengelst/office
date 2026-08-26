'use client';

interface PlConfirmationScreenProps {
  successTitle: string;
  confirmMessage: string;
  onPointerDown: () => void;
}

export function PlConfirmationScreen({
  successTitle,
  confirmMessage,
  onPointerDown,
}: PlConfirmationScreenProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      onPointerDown={onPointerDown}
    >
      <div className="text-8xl">✅</div>
      <p className="text-center text-3xl font-bold">{successTitle}</p>
      <p className="text-xl text-gray-400">{confirmMessage}</p>
    </div>
  );
}
