'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { kioskDebugLog } from '@/lib/kiosk-debug';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

export default function KioskPage() {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    kioskDebugLog('nav', '/kiosk Einstieg');
    const raw = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        if (config.projectId) {
          const target =
            config.mode === 'customer_pl' ? '/kiosk/pl' : '/kiosk/terminal';
          kioskDebugLog('nav', `replace → ${target}`, config.projectTitle);
          router.replace(target);
          return;
        }
      } catch {
        kioskDebugLog('warn', 'ungültige Kiosk-Config');
      }
    }
    kioskDebugLog('nav', 'replace → /kiosk/setup');
    router.replace('/kiosk/setup');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="animate-pulse text-2xl text-gray-400">Laden …</div>
    </div>
  );
}
