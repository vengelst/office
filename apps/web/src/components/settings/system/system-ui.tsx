/**
 * Kleine UI-Helfer für die System-Status-Seite.
 */

export function ProgressBar({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const color =
    value > 80
      ? 'bg-red-500'
      : value > 50
        ? 'bg-yellow-500'
        : 'bg-green-500';

  return (
    <div className={`h-2 w-full rounded-full bg-muted ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
    />
  );
}

