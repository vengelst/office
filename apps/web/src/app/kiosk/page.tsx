'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

export default function KioskPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        if (config.projectId) {
          router.replace('/kiosk/terminal');
          return;
        }
      } catch {
        // invalid config
      }
    }
    router.replace('/kiosk/setup');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-2xl text-gray-400">Laden …</div>
    </div>
  );
}
