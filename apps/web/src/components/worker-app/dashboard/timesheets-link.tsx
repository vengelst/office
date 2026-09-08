import { ChevronRight, FileSignature } from 'lucide-react';
import { texts } from '@/lib/texts';

interface TimesheetsLinkProps {
  onNavigate: () => void;
}

export function TimesheetsLink({ onNavigate }: TimesheetsLinkProps) {
  const t = texts.workerApp.dashboard;
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <FileSignature className="h-6 w-6 text-primary" />
      </span>
      <span className="flex-1">
        <span className="block text-base font-semibold">{t.timesheetsLink}</span>
        <span className="block text-sm text-muted-foreground">
          {t.timesheetsLinkHint}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
