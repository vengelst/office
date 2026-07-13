'use client';

import { useEffect, useState } from 'react';

export default function DownloadPage() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const apkUrl = '/kiosk.apk';
  const qrContent = origin ? `${origin}${apkUrl}` : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-wider text-gray-50">
            VIVAHOME
          </h1>
          <p className="mt-1 text-sm text-gray-400">Monteur-Kiosk App</p>
        </div>

        {/* App Icon Placeholder */}
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-gray-800 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
        </div>

        {/* Download Button */}
        <a
          href={apkUrl}
          download="kiosk.apk"
          className="mx-auto flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          App herunterladen
        </a>

        <p className="text-xs text-gray-500">
          Version 1.0.0 &middot; Android
        </p>

        {/* QR Code */}
        {qrContent && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Oder QR-Code scannen:
            </p>
            <div className="mx-auto w-fit rounded-xl bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrContent)}&bgcolor=ffffff&color=030712`}
                alt="QR-Code zum Download"
                width={180}
                height={180}
                className="block"
              />
            </div>
          </div>
        )}

        {/* Installationsanleitung */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-left">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">
            Installationsanleitung
          </h2>
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-blue-400">
                1
              </span>
              <span>
                <strong className="text-gray-300">Herunterladen</strong> – Tippe
                auf den blauen Button oben
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-blue-400">
                2
              </span>
              <span>
                <strong className="text-gray-300">Erlauben</strong> – Falls
                gefragt: &quot;Installation aus unbekannten Quellen&quot;
                aktivieren
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-blue-400">
                3
              </span>
              <span>
                <strong className="text-gray-300">Installieren</strong> –
                Heruntergeladene Datei öffnen und &quot;Installieren&quot;
                tippen
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-blue-400">
                4
              </span>
              <span>
                <strong className="text-gray-300">Starten</strong> – App öffnen
                und mit deiner PIN anmelden
              </span>
            </li>
          </ol>
        </div>

        <p className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} VIVAHOME
        </p>
      </div>
    </div>
  );
}
