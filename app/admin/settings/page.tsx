'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Skeleton } from '@/components/admin/Skeleton';

type Settings = {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  contactEmail: string;
  supportEmail: string;
};

const DEFAULT_SETTINGS: Settings = {
  siteName: 'AtoC Korea',
  siteDescription: 'Licensed Korea-based tour booking platform',
  maintenanceMode: false,
  allowRegistrations: true,
  contactEmail: 'info@atockorea.com',
  supportEmail: 'support@atockorea.com',
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // baseline = last persisted snapshot; drives the dirty guard.
  const [baseline, setBaseline] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(settings) !== JSON.stringify(baseline);

  // Warn before leaving with unsaved changes (browser nav; matches the
  // merchants-create dirty guard).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    fetchSettings().finally(() => setLoading(false));
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { session } } =
        (await supabase?.auth.getSession()) || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin/settings');
        return;
      }

      const response = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      if (data.data) {
        setSettings(data.data);
        setBaseline(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      toast.error('설정을 불러오지 못했습니다');
    }
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    try {
      setSaving(true);
      const { data: { session } } =
        (await supabase?.auth.getSession()) || { data: { session: null } };

      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setBaseline(settings);
      toast.success('설정을 저장했습니다');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 rounded-design-md" />
          <Skeleton className="mt-2 h-4 w-64 rounded-design-md" />
        </div>
        <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-6 space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-design-md" />
          ))}
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full min-h-11 px-4 py-2 text-base text-slate-900 border border-admin-border rounded-lg bg-admin-surface focus:outline-none focus:ring-2 focus:ring-blue-500';
  const toggleTrack =
    "w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configure system-wide settings</p>
      </div>

      <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Site Name</label>
          <input
            type="text"
            value={settings.siteName}
            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Site Description</label>
          <textarea
            value={settings.siteDescription}
            onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Contact Email</label>
          <input
            type="email"
            value={settings.contactEmail}
            onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Support Email</label>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Mode</label>
            <p className="text-xs text-slate-500">Enable to put the site in maintenance mode</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="sr-only peer"
            />
            <div className={toggleTrack}></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Allow New Registrations</label>
            <p className="text-xs text-slate-500">Enable to allow new user registrations</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowRegistrations}
              onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
              className="sr-only peer"
            />
            <div className={toggleTrack}></div>
          </label>
        </div>

        <div className="pt-4 border-t border-admin-border flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="min-h-11 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중…' : 'Save Settings'}
          </button>
          {dirty && !saving ? (
            <span className="text-xs text-amber-700">저장되지 않은 변경사항이 있습니다</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
