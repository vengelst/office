import type { ReactNode } from 'react';

/**
 * Eigenständiges Layout der Monteur-App (Mobile-First, KEINE Sidebar/Header).
 * Zentriert den Inhalt in einer schmalen, touch-optimierten Spalte.
 */
export default function WorkerAppLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-sm">
        {children}
      </div>
    </div>
  );
}
