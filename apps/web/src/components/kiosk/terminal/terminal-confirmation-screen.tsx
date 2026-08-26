'use client';

interface TerminalConfirmationScreenProps {
  confirmMessage: string;
  confirmSubtext: string;
  onPointerDown: () => void;
}

export function TerminalConfirmationScreen({
  confirmMessage,
  confirmSubtext,
  onPointerDown,
}: TerminalConfirmationScreenProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      onPointerDown={onPointerDown}
    >
      <div className="text-8xl">✅</div>
      <p className="text-center text-3xl font-bold">{confirmMessage}</p>
      <p className="text-xl text-gray-400">{confirmSubtext}</p>
    </div>
  );
}
