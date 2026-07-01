'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { texts } from '@/lib/texts';
import { apiClient } from '@/lib/api-client';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

interface Project {
  id: string;
  projectNumber: string;
  title: string;
  customer: { companyName: string } | null;
}

export interface KioskConfig {
  projectId: string;
  projectTitle: string;
  autoLogoutSeconds: number;
  cameraEnabled: boolean;
  fullscreen: boolean;
  adminPin: string;
}

export default function KioskSetupPage() {
  const router = useRouter();
  const t = texts.kiosk.setup;

  const [authenticated, setAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectId, setProjectId] = useState('');
  const [autoLogout, setAutoLogout] = useState(15);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('office_token');
    if (!token) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    setAuthenticated(true);
    apiClient
      .get<{ data: Project[] }>('/projects?status=ACTIVE&limit=100')
      .then((res) => {
        setProjects(res.data ?? []);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    if (!projectId || adminPin.length < 4) return;
    const project = projects.find((p) => p.id === projectId);
    const config: KioskConfig = {
      projectId,
      projectTitle: project?.title ?? 'Projekt',
      autoLogoutSeconds: autoLogout,
      cameraEnabled,
      fullscreen,
      adminPin,
    };
    localStorage.setItem(KIOSK_CONFIG_KEY, JSON.stringify(config));
    router.push('/kiosk/terminal');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl text-gray-400">{texts.common.loading}</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="text-lg text-gray-400">{t.loginRequired}</p>
        <a
          href="/login"
          className="rounded-xl bg-blue-600 px-8 py-4 text-xl font-semibold text-white transition hover:bg-blue-500"
        >
          Admin-Login
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8 rounded-2xl bg-gray-900 p-8">
        <div>
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-gray-400">{t.subtitle}</p>
        </div>

        {/* Projekt */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            {t.project}
          </label>
          {projects.length === 0 ? (
            <p className="text-gray-500">{t.noProjects}</p>
          ) : (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-lg text-white"
            >
              <option value="">{t.projectPlaceholder}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectNumber} – {p.title}
                  {p.customer ? ` (${p.customer.companyName})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Auto-Logout Slider */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            {t.autoLogout}: {autoLogout}s
          </label>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={autoLogout}
            onChange={(e) => setAutoLogout(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={cameraEnabled}
              onChange={(e) => setCameraEnabled(e.target.checked)}
              className="h-5 w-5 rounded accent-blue-500"
            />
            <span>{t.cameraEnabled}</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={fullscreen}
              onChange={(e) => setFullscreen(e.target.checked)}
              className="h-5 w-5 rounded accent-blue-500"
            />
            <span>{t.fullscreen}</span>
          </label>
        </div>

        {/* Admin-PIN */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            {t.adminPin}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white"
          />
          <p className="text-xs text-gray-500">{t.adminPinHint}</p>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!projectId || adminPin.length < 4}
          className="w-full rounded-xl bg-green-600 px-6 py-4 text-xl font-bold text-white transition hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}
