/**
 * Host-Routing: work.vivahome.de ist die Kiosk-Domain.
 * Root und fremde Pfade → /kiosk; Setup braucht zusätzlich /login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const KIOSK_HOSTS = new Set(['work.vivahome.de']);

function isAssetPath(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api')) return true;
  // Dateien mit Extension (favicon, sw, apk, …)
  const last = pathname.split('/').pop() ?? '';
  return last.includes('.');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  if (!KIOSK_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/kiosk') || pathname === '/login') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/kiosk';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
