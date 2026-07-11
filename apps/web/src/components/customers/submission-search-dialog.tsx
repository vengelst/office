'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  researchApi,
  type ResearchSubmission,
} from '@/lib/research';
import { submissionsApi } from '@/lib/submissions';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

/**
 * Dialog zur Recherche und zum Import von Ausschreibungen.
 * Gibt eine URL ein, lässt den Research-Microservice nach Ausschreibungen suchen,
 * zeigt eine Vorschau und importiert ausgewählte Treffer als Submissions.
 */
export function SubmissionSearchDialog({
  open,
  onOpenChange,
  customerId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onImported: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers.submissions.search;

  const [url, setUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ResearchSubmission[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const reset = (): void => {
    setUrl('');
    setResults([]);
    setSelected(new Set());
    setConfidence(0);
    setHasSearched(false);
  };

  const handleSearch = (): void => {
    if (!url.trim()) return;
    setSearching(true);
    setResults([]);
    setHasSearched(false);

    researchApi
      .lookupSubmissions(url.trim())
      .then((res) => {
        setResults(res.submissions);
        setConfidence(res.confidence);
        setSelected(new Set(res.submissions.map((_, i) => i)));
        setHasSearched(true);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : t.noResults,
        }),
      )
      .finally(() => setSearching(false));
  };

  const toggleSelect = (idx: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = (): void =>
    setSelected(new Set(results.map((_, i) => i)));

  const selectNone = (): void => setSelected(new Set());

  const handleImport = async (): Promise<void> => {
    const toImport = results.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;

    setImporting(true);
    let imported = 0;

    for (const sub of toImport) {
      try {
        await submissionsApi.create({
          customerId,
          title: sub.title ?? 'Ohne Titel',
          description: sub.description ?? undefined,
          reference: sub.reference ?? undefined,
          source: sub.source ?? url,
          deadline: sub.deadline ?? undefined,
          startDate: sub.startDate ?? undefined,
          endDate: sub.endDate ?? undefined,
          value: sub.value ? Number(sub.value) || undefined : undefined,
          contactName: sub.contactName ?? undefined,
          contactEmail: sub.contactEmail ?? undefined,
          contactPhone: sub.contactPhone ?? undefined,
          requirements: sub.requirements ?? undefined,
        });
        imported++;
      } catch {
        // Einzelne Fehler nicht unterbrechen
      }
    }

    setImporting(false);
    toast({ description: t.imported(imported) });
    onOpenChange(false);
    reset();
    onImported();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder={t.urlPlaceholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="min-h-[44px]"
            disabled={searching}
          />
          <Button
            onClick={handleSearch}
            disabled={searching || !url.trim()}
            className="min-h-[44px]"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {searching && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.searching}</p>
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t.noResults}
          </p>
        )}

        {results.length > 0 && !searching && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t.found(results.length)}
                <span className="ml-2 text-muted-foreground">
                  ({t.confidence}: {Math.round(confidence * 100)}%)
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {t.selectAll}
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  {t.selectNone}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {results.map((sub, idx) => (
                <Card
                  key={idx}
                  className={`cursor-pointer transition-colors ${
                    selected.has(idx)
                      ? 'border-primary bg-primary/5'
                      : 'opacity-60'
                  }`}
                  onClick={() => toggleSelect(idx)}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(idx)}
                            onChange={() => toggleSelect(idx)}
                            className="h-4 w-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <p className="font-medium">
                            {sub.title ?? 'Ohne Titel'}
                          </p>
                        </div>
                        {sub.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {sub.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {sub.reference && (
                        <Badge variant="outline">Ref: {sub.reference}</Badge>
                      )}
                      {sub.deadline && (
                        <Badge variant="outline">
                          Frist: {sub.deadline}
                        </Badge>
                      )}
                      {sub.value && (
                        <Badge variant="outline">Wert: {sub.value}</Badge>
                      )}
                      {sub.contactName && (
                        <Badge variant="outline">{sub.contactName}</Badge>
                      )}
                      {sub.contactEmail && (
                        <Badge variant="outline">{sub.contactEmail}</Badge>
                      )}
                    </div>

                    {sub.requirements && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        Anforderungen: {sub.requirements}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {results.length > 0 && !searching && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
              className="min-h-[44px]"
            >
              {texts.customers.actions.cancel}
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="min-h-[44px]"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.importing}
                </>
              ) : (
                `${t.import} (${selected.size})`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
