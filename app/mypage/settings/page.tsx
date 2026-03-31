'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, locales, type Locale } from '@/lib/i18n';
import { validateAppPassword } from '@/lib/password-policy';

type NotificationsState = {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
};

function parseMypagePrefs(raw: unknown): {
  city: string;
  gender: string;
  currency: string;
  emergency: { name: string; phone: string; relation: string };
  notifications: NotificationsState;
} {
  const mp = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const em =
    mp.emergency_contact && typeof mp.emergency_contact === 'object' && !Array.isArray(mp.emergency_contact)
      ? (mp.emergency_contact as Record<string, unknown>)
      : {};
  const notif =
    mp.notifications && typeof mp.notifications === 'object' && !Array.isArray(mp.notifications)
      ? (mp.notifications as Record<string, unknown>)
      : {};
  return {
    city: typeof mp.city === 'string' ? mp.city : 'Seoul',
    gender: typeof mp.gender === 'string' ? mp.gender : '',
    currency: typeof mp.currency === 'string' ? mp.currency : 'USD',
    emergency: {
      name: typeof em.name === 'string' ? em.name : '',
      phone: typeof em.phone === 'string' ? em.phone : '',
      relation: typeof em.relation === 'string' ? em.relation : '',
    },
    notifications: {
      email: notif.email !== false,
      sms: notif.sms === true,
      push: notif.push !== false,
      marketing: notif.marketing === true,
    },
  };
}

export default function AccountSettingsPage() {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    name: 'Guest',
    email: '',
    phone: '',
    birthday: '',
    gender: '',
    country: 'South Korea',
    city: 'Seoul',
    language: 'en' as string,
    currency: 'USD',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsState>({
    email: true,
    sms: false,
    push: true,
    marketing: false,
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [savePersonalLoading, setSavePersonalLoading] = useState(false);
  const [saveLocationLoading, setSaveLocationLoading] = useState(false);
  const [savePrefsLoading, setSavePrefsLoading] = useState(false);
  const [saveEmergencyLoading, setSaveEmergencyLoading] = useState(false);
  const [saveNotifLoading, setSaveNotifLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, phone, birth_year, nationality, language_preference, mypage_preferences')
          .eq('id', session.user.id)
          .single();

        const prefs = parseMypagePrefs(profile?.mypage_preferences);
        const langRaw = profile?.language_preference;
        const lang =
          typeof langRaw === 'string' && locales.includes(langRaw as Locale) ? langRaw : 'en';

        setFormData((prev) => ({
          ...prev,
          name: profile?.full_name?.trim() || session.user.email?.split('@')[0] || 'Guest',
          email: session.user.email ?? '',
          phone: profile?.phone?.trim() ?? '',
          birthday: profile?.birth_year ? `${profile.birth_year}-01-01` : '',
          country: profile?.nationality?.trim() || 'South Korea',
          city: prefs.city,
          gender: prefs.gender,
          language: lang,
          currency: prefs.currency,
          emergencyContactName: prefs.emergency.name,
          emergencyContactPhone: prefs.emergency.phone,
          emergencyContactRelation: prefs.emergency.relation,
        }));
        setNotifications(prefs.notifications);
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[mypage/settings] Load failed:', e);
        }
      }
      setProfileLoading(false);
    };
    void loadProfile();
  }, []);

  const handleSavePersonalInfo = async () => {
    if (!formData.name?.trim()) {
      alert(t('settingsPage.alertNameRequired'));
      return;
    }
    setSavePersonalLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const birthYear = formData.birthday ? new Date(formData.birthday).getFullYear() : undefined;
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: formData.name.trim(),
          phone: formData.phone?.trim() || null,
          birth_year: birthYear,
          mypage_preferences: {
            gender: formData.gender?.trim() || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertSaveSuccess'));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setSavePersonalLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    setSaveLocationLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nationality: formData.country?.trim() || null,
          mypage_preferences: {
            city: formData.city?.trim() || '',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertSaveSuccess'));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setSaveLocationLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavePrefsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          language_preference: formData.language,
          mypage_preferences: {
            currency: formData.currency,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertSaveSuccess'));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setSavePrefsLoading(false);
    }
  };

  const handleSaveEmergency = async () => {
    setSaveEmergencyLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mypage_preferences: {
            emergency_contact: {
              name: formData.emergencyContactName?.trim() || '',
              phone: formData.emergencyContactPhone?.trim() || '',
              relation: formData.emergencyContactRelation?.trim() || '',
            },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertSaveSuccess'));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setSaveEmergencyLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaveNotifLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mypage_preferences: {
            notifications: {
              email: notifications.email,
              sms: notifications.sms,
              push: notifications.push,
              marketing: notifications.marketing,
            },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertNotificationsSaved'));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setSaveNotifLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert(t('settingsPage.alertPasswordFields'));
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert(t('settingsPage.alertPasswordMismatch'));
      return;
    }
    const pwdPolicy = validateAppPassword(passwordData.newPassword);
    if (!pwdPolicy.valid) {
      alert(pwdPolicy.message ?? t('settingsPage.alertPasswordShort'));
      return;
    }
    setPasswordLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : t('settingsPage.alertSaveFailed'));
        return;
      }
      alert(t('settingsPage.alertPasswordSuccess'));
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordChange(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('settingsPage.alertSaveFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-slate-900">{t('settingsPage.title')}</h1>
        <p className="text-slate-600">{t('settingsPage.description')}</p>
      </div>

      {/* Personal Information */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          {t('settingsPage.personalInfo')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t('settingsPage.fullName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t('settingsPage.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              readOnly
              value={formData.email}
              className="w-full cursor-not-allowed px-4 py-3 rounded-xl border border-slate-200/80 bg-slate-100/80 text-slate-600 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">{t('settingsPage.emailReadonlyHint')}</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t('settingsPage.phone')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.dateOfBirth')}</label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.gender')}</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            >
              <option value="">{t('settingsPage.select')}</option>
              <option value="male">{t('settingsPage.genderMale')}</option>
              <option value="female">{t('settingsPage.genderFemale')}</option>
              <option value="other">{t('settingsPage.genderOther')}</option>
              <option value="prefer-not-to-say">{t('settingsPage.genderPreferNot')}</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSavePersonalInfo()}
          disabled={profileLoading || savePersonalLoading}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {savePersonalLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </div>

      {/* Address Information */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {t('settingsPage.location')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.country')}</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            >
              <option value="South Korea">South Korea</option>
              <option value="United States">United States</option>
              <option value="China">China</option>
              <option value="Japan">Japan</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.city')}</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveLocation()}
          disabled={profileLoading || saveLocationLoading}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saveLocationLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </div>

      {/* Preferences */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {t('settingsPage.preferences')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.language')}</label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="zh">中文 (简体)</option>
              <option value="zh-TW">中文 (繁體)</option>
              <option value="ja">日本語</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.currency')}</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            >
              <option value="USD">USD ($)</option>
              <option value="KRW">KRW (₩)</option>
              <option value="CNY">CNY (¥)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSavePreferences()}
          disabled={profileLoading || savePrefsLoading}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {savePrefsLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </div>

      {/* Emergency Contact */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          {t('settingsPage.emergencyContactTitle')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.contactName')}</label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.contactPhone')}</label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.relationship')}</label>
            <select
              value={formData.emergencyContactRelation}
              onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
            >
              <option value="">{t('settingsPage.relationshipPlaceholder')}</option>
              <option value="family">{t('settingsPage.relFamily')}</option>
              <option value="friend">{t('settingsPage.relFriend')}</option>
              <option value="colleague">{t('settingsPage.relColleague')}</option>
              <option value="other">{t('settingsPage.relOther')}</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveEmergency()}
          disabled={profileLoading || saveEmergencyLoading}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saveEmergencyLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </div>

      {/* Change Password - Collapsible */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            {t('settingsPage.passwordTitle')}
          </h2>
          <button
            type="button"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:border-blue-700 hover:text-blue-700"
          >
            {showPasswordChange ? t('common.cancel') : t('settingsPage.changePassword')}
          </button>
        </div>

        {showPasswordChange && (
          <div className="space-y-4 pt-4 border-t border-white/20">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.currentPassword')}</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.newPassword')}</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
              />
              <p className="mt-1 text-xs text-slate-500">{t('settingsPage.passwordHint')}</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('settingsPage.confirmPassword')}</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-white/60 focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleUpdatePassword()}
              disabled={passwordLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {passwordLoading ? t('settingsPage.saving') : t('settingsPage.updatePasswordBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          {t('settingsPage.notificationPrefsTitle')}
        </h2>
        <div className="space-y-4">
          {(
            [
              { key: 'email' as const, label: t('settingsPage.emailNotif'), description: t('settingsPage.emailNotifDesc') },
              { key: 'sms' as const, label: t('settingsPage.smsNotif'), description: t('settingsPage.smsNotifDesc') },
              { key: 'push' as const, label: t('settingsPage.pushNotif'), description: t('settingsPage.pushNotifDesc') },
              { key: 'marketing' as const, label: t('settingsPage.marketingNotif'), description: t('settingsPage.marketingNotifDesc') },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl border border-slate-200/80 p-4 transition-colors hover:border-slate-300/80">
              <div>
                <label className="text-sm font-medium text-slate-900 cursor-pointer">{item.label}</label>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(e) =>
                    setNotifications({ ...notifications, [item.key]: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void handleSaveNotifications()}
            disabled={profileLoading || saveNotifLoading}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveNotifLoading ? t('settingsPage.saving') : t('settingsPage.savePreferences')}
          </button>
        </div>
      </div>
    </div>
  );
}
