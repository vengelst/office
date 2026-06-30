'use client';

import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Hilfreicher Leerzustand mit optionaler Aktion. */
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}): ReactNode {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {actionLabel && onAction && (
          <Button variant="link" onClick={onAction} className="min-h-[44px]">
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
