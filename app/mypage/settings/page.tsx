'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslations, locales, type Locale } from '@/lib/i18n';
import { validateAppPassword } from '@/lib/password-policy';
import { MyPageSection } from '@/components/mypage/MyPageSection';
import { MYPAGE_SURFACE_PAGE, MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

type NotificationsState = {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
};

type SectionKey = 'personal' | 'location' | 'preferences' | 'emergency' | 'notifications';

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

const inputClass = cn(
  'w-full rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3 text-[14px] text-slate-900 outline-none transition-all',
  'focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/20',
  'placeholder:text-slate-400',
);

const savedBtnClass = cn(
  'inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-[13px] font-semibold text-white',
  'transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60',
  MYPAGE_FOCUS_RING,
);

export default function AccountSettingsPage() {
  const t = useTranslations();
  const { user, profile, getAccessToken } = useMyPageSession();
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [identities, setIdentities] = useState<Array<{ provider: string; email?: string | null }>>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savePersonalLoading, setSavePersonalLoading] = useState(false);
  const [saveLocationLoading, setSaveLocationLoading] = useState(false);
  const [savePrefsLoading, setSavePrefsLoading] = useState(false);
  const [saveEmergencyLoading, setSaveEmergencyLoading] = useState(false);
  const [saveNotifLoading, setSaveNotifLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [savedFlags, setSavedFlags] = useState<Record<SectionKey, boolean>>({
    personal: false,
    location: false,
    preferences: false,
    emergency: false,
    notifications: false,
  });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const flagSaved = useCallback((section: SectionKey) => {
    setSavedFlags((prev) => ({ ...prev, [section]: true }));
    window.setTimeout(() => {
      setSavedFlags((prev) => ({ ...prev, [section]: false }));
    }, 2200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        if (!user || cancelled) return;
        setUserId(user.id);
        setIdentities(
          ((user.identities || []) as Array<{ provider: string; identity_data?: { email?: string } }>).map(
            (i) => ({ provider: i.provider, email: i.identity_data?.email ?? null }),
          ),
        );

        if (cancelled) return;

        const prefs = parseMypagePrefs(profile?.mypage_preferences);
        const langRaw = profile?.language_preference;
        const lang =
          typeof langRaw === 'string' && locales.includes(langRaw as Locale) ? langRaw : 'en';

        setAvatarUrl(profile?.avatar_url ?? null);
        setFormData((prev) => ({
          ...prev,
          name: profile?.full_name?.trim() || user.email?.split('@')[0] || 'Guest',
          email: user.email ?? '',
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
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profile, user]);

  const handleSavePersonalInfo = async () => {
    if (!formData.name?.trim()) {
      toast.error(t('settingsPage.alertNameRequired'));
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
          mypage_preferences: { gender: formData.gender?.trim() || null },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('mypage.common.toast.saved'));
      flagSaved('personal');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
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
          mypage_preferences: { city: formData.city?.trim() || '' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('mypage.common.toast.saved'));
      flagSaved('location');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
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
          mypage_preferences: { currency: formData.currency },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('mypage.common.toast.saved'));
      flagSaved('preferences');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
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
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('mypage.common.toast.saved'));
      flagSaved('emergency');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
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
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('mypage.common.toast.saved'));
      flagSaved('notifications');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
    } finally {
      setSaveNotifLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error(t('settingsPage.alertPasswordFields'));
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('settingsPage.alertPasswordMismatch'));
      return;
    }
    const pwdPolicy = validateAppPassword(passwordData.newPassword);
    if (!pwdPolicy.valid) {
      toast.error(pwdPolicy.message ?? t('settingsPage.alertPasswordShort'));
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
        toast.error(typeof data.error === 'string' ? data.error : t('mypage.common.toast.saveFailed'));
        return;
      }
      toast.success(t('settingsPage.alertPasswordSuccess'));
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('mypage.common.toast.saveFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;
    if (!userId) {
      toast.error(t('mypage.common.toast.signInRequired'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('mypage.common.toast.avatarUploadFailed'));
      return;
    }
    setAvatarUploading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) throw new Error('supabase unavailable');
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = publicUrl?.publicUrl;
      if (!url) throw new Error('no-url');

      const token = await getAccessToken();
      if (!token) throw new Error(t('settingsPage.alertSignInAgain'));
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: url }),
      });
      if (!res.ok) throw new Error('update-failed');

      setAvatarUrl(url);
      toast.success(t('mypage.common.toast.avatarUpdated'));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('userDataUpdated'));
    } catch (e) {
      console.error('[mypage/settings] avatar upload failed:', e);
      toast.error(t('mypage.common.toast.avatarUploadFailed'));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const SavedBadge = ({ visible }: { visible: boolean }) =>
    visible ? (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
        role="status"
        aria-live="polite"
      >
        {t('mypage.settings.savedBadge')}
      </span>
    ) : null;

  const initials = (formData.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[18px] font-semibold text-slate-700">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={t('mypage.settings.avatarUploadLabel')}
              className={cn(
                'absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60',
                MYPAGE_FOCUS_RING,
              )}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatarUpload(file);
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.25rem] font-semibold tracking-tight text-slate-900">
              {t('settingsPage.title')}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-slate-600">{t('settingsPage.description')}</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <MyPageSection
        title={t('settingsPage.personalInfo')}
        trailing={<SavedBadge visible={savedFlags.personal} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">
              {t('settingsPage.fullName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">
              {t('settingsPage.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              readOnly
              value={formData.email}
              className={cn(inputClass, 'cursor-not-allowed bg-slate-100/80 text-slate-600')}
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('settingsPage.emailReadonlyHint')}</p>
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">
              {t('settingsPage.phone')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.dateOfBirth')}</label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.gender')}</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className={inputClass}
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
          className={cn(savedBtnClass, 'mt-5')}
        >
          {savePersonalLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </MyPageSection>

      {/* Address Information */}
      <MyPageSection
        title={t('settingsPage.location')}
        trailing={<SavedBadge visible={savedFlags.location} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.country')}</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className={inputClass}
            >
              <option value="South Korea">South Korea</option>
              <option value="United States">United States</option>
              <option value="China">China</option>
              <option value="Japan">Japan</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.city')}</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveLocation()}
          disabled={profileLoading || saveLocationLoading}
          className={cn(savedBtnClass, 'mt-5')}
        >
          {saveLocationLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </MyPageSection>

      {/* Preferences */}
      <MyPageSection
        title={t('settingsPage.preferences')}
        trailing={<SavedBadge visible={savedFlags.preferences} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.language')}</label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className={inputClass}
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
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.currency')}</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className={inputClass}
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
          className={cn(savedBtnClass, 'mt-5')}
        >
          {savePrefsLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </MyPageSection>

      {/* Emergency Contact */}
      <MyPageSection
        title={t('settingsPage.emergencyContactTitle')}
        trailing={<SavedBadge visible={savedFlags.emergency} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.contactName')}</label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.contactPhone')}</label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.relationship')}</label>
            <select
              value={formData.emergencyContactRelation}
              onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
              className={inputClass}
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
          className={cn(savedBtnClass, 'mt-5')}
        >
          {saveEmergencyLoading ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
        </button>
      </MyPageSection>

      {/* Change Password */}
      <MyPageSection
        title={t('settingsPage.passwordTitle')}
        trailing={
          <button
            type="button"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
              MYPAGE_FOCUS_RING,
            )}
          >
            {showPasswordChange ? t('common.cancel') : t('settingsPage.changePassword')}
          </button>
        }
      >
        {showPasswordChange && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.currentPassword')}</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.newPassword')}</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-slate-500">{t('settingsPage.passwordHint')}</p>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700">{t('settingsPage.confirmPassword')}</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleUpdatePassword()}
              disabled={passwordLoading}
              className={savedBtnClass}
            >
              {passwordLoading ? t('settingsPage.saving') : t('settingsPage.updatePasswordBtn')}
            </button>
          </div>
        )}
      </MyPageSection>

      {/* Notifications */}
      <MyPageSection
        title={t('settingsPage.notificationPrefsTitle')}
        trailing={<SavedBadge visible={savedFlags.notifications} />}
      >
        <div className="space-y-3">
          {(
            [
              { key: 'email' as const, label: t('settingsPage.emailNotif'), description: t('settingsPage.emailNotifDesc') },
              { key: 'sms' as const, label: t('settingsPage.smsNotif'), description: t('settingsPage.smsNotifDesc') },
              { key: 'push' as const, label: t('settingsPage.pushNotif'), description: t('settingsPage.pushNotifDesc') },
              { key: 'marketing' as const, label: t('settingsPage.marketingNotif'), description: t('settingsPage.marketingNotifDesc') },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 p-4 transition-colors hover:border-slate-300"
            >
              <div className="min-w-0">
                <label className="text-[13px] font-semibold text-slate-900">{item.label}</label>
                <p className="mt-0.5 text-[12px] text-slate-500">{item.description}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-slate-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-900/20" />
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void handleSaveNotifications()}
            disabled={profileLoading || saveNotifLoading}
            className={cn(savedBtnClass, 'mt-3')}
          >
            {saveNotifLoading ? t('settingsPage.saving') : t('settingsPage.savePreferences')}
          </button>
        </div>
      </MyPageSection>

      {/* Connected Accounts */}
      <MyPageSection title={t('mypage.settings.connectedAccountsTitle')}>
        {identities.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {identities.map((id, idx) => (
              <li key={`${id.provider}-${idx}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold capitalize text-slate-900">{id.provider}</p>
                  {id.email ? <p className="truncate text-[12px] text-slate-500">{id.email}</p> : null}
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {t('mypage.common.toast.saved').replace('.', '')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-slate-500">{t('mypage.settings.connectedAccountsEmpty')}</p>
        )}
      </MyPageSection>

      {/* Danger Zone */}
      <MyPageSection
        title={t('mypage.settings.dangerZoneTitle')}
        description={t('mypage.settings.dangerZoneDescription')}
        className="border-rose-200/60"
      >
        <button
          type="button"
          onClick={() => toast.message(t('mypage.common.toast.comingSoon'))}
          className={cn(
            'inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-white px-5 text-[13px] font-semibold text-rose-700 transition-colors hover:bg-rose-50',
            MYPAGE_FOCUS_RING,
          )}
        >
          {t('mypage.settings.deleteAccount')}
        </button>
      </MyPageSection>
    </div>
  );
}
