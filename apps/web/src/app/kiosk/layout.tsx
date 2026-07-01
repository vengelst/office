import type { ReactNode } from 'react';

export const metadata = {
  title: 'Kiosk-Terminal',
};

export default function KioskLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 antialiased">
      {children}
    </div>
  );
}
