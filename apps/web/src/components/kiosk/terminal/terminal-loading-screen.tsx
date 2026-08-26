'use client';

interface TerminalLoadingScreenProps {
  onPointerDown: () => void;
}

export function TerminalLoadingScreen({ onPointerDown }: TerminalLoadingScreenProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400"
      onPointerDown={onPointerDown}
    >
      Laden …
    </div>
  );
}
