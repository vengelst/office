'use client';

import { useLayoutEffect } from 'react';

/**
 * Erzwingt dunklen html/body-Hintergrund für den Kiosk, sobald das Layout
 * mounted – ergänzt das Boot-Script gegen Weiß-Flash (Root-Theme).
 */
export function KioskDarkBoot(): null {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('dark');
    html.style.colorScheme = 'dark';
    body.style.backgroundColor = '#030712';
    body.style.color = '#f3f4f6';
  }, []);
  return null;
}
