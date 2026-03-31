'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import { getPasswordStrengthTier, validateAppPassword } from '@/lib/password-policy';
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar';

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEAR_START = 1900;
const BIRTH_YEARS = Array.from(
  { length: CURRENT_YEAR - BIRTH_YEAR_START + 1 },
  (_, i) => CURRENT_YEAR - i
);

// 국가 목록 (이름 + 국가번호) - 검색·선택용
const COUNTRY_LIST: { name: string; dialCode: string }[] = [
  { name: 'South Korea', dialCode: '+82' }, { name: 'United States', dialCode: '+1' }, { name: 'Japan', dialCode: '+81' },
  { name: 'China', dialCode: '+86' }, { name: 'Taiwan', dialCode: '+886' }, { name: 'Hong Kong', dialCode: '+852' },
  { name: 'Thailand', dialCode: '+66' }, { name: 'Vietnam', dialCode: '+84' }, { name: 'Singapore', dialCode: '+65' },
  { name: 'Malaysia', dialCode: '+60' }, { name: 'Indonesia', dialCode: '+62' }, { name: 'Philippines', dialCode: '+63' },
  { name: 'India', dialCode: '+91' }, { name: 'United Kingdom', dialCode: '+44' }, { name: 'Germany', dialCode: '+49' },
  { name: 'France', dialCode: '+33' }, { name: 'Italy', dialCode: '+39' }, { name: 'Spain', dialCode: '+34' },
  { name: 'Australia', dialCode: '+61' }, { name: 'Canada', dialCode: '+1' }, { name: 'Mexico', dialCode: '+52' },
  { name: 'Brazil', dialCode: '+55' }, { name: 'Russia', dialCode: '+7' }, { name: 'Netherlands', dialCode: '+31' },
  { name: 'Switzerland', dialCode: '+41' }, { name: 'Sweden', dialCode: '+46' }, { name: 'Poland', dialCode: '+48' },
  { name: 'Turkey', dialCode: '+90' }, { name: 'Saudi Arabia', dialCode: '+966' }, { name: 'UAE', dialCode: '+971' },
  { name: 'Israel', dialCode: '+972' }, { name: 'South Africa', dialCode: '+27' }, { name: 'Egypt', dialCode: '+20' },
  { name: 'Nigeria', dialCode: '+234' }, { name: 'Kenya', dialCode: '+254' }, { name: 'New Zealand', dialCode: '+64' },
  { name: 'Argentina', dialCode: '+54' }, { name: 'Chile', dialCode: '+56' }, { name: 'Colombia', dialCode: '+57' },
  { name: 'Belgium', dialCode: '+32' }, { name: 'Austria', dialCode: '+43' }, { name: 'Portugal', dialCode: '+351' },
  { name: 'Greece', dialCode: '+30' }, { name: 'Czech Republic', dialCode: '+420' }, { name: 'Romania', dialCode: '+40' },
  { name: 'Hungary', dialCode: '+36' }, { name: 'Ireland', dialCode: '+353' }, { name: 'Denmark', dialCode: '+45' },
  { name: 'Norway', dialCode: '+47' }, { name: 'Finland', dialCode: '+358' }, { name: 'Pakistan', dialCode: '+92' },
  { name: 'Bangladesh', dialCode: '+880' }, { name: 'Sri Lanka', dialCode: '+94' }, { name: 'Nepal', dialCode: '+977' },
  { name: 'Myanmar', dialCode: '+95' }, { name: 'Cambodia', dialCode: '+855' }, { name: 'Mongolia', dialCode: '+976' },
  { name: 'Kazakhstan', dialCode: '+7' }, { name: 'Ukraine', dialCode: '+380' }, { name: 'Belarus', dialCode: '+375' },
  { name: 'Croatia', dialCode: '+385' }, { name: 'Serbia', dialCode: '+381' }, { name: 'Bulgaria', dialCode: '+359' },
  { name: 'Morocco', dialCode: '+212' }, { name: 'Tunisia', dialCode: '+216' }, { name: 'Ghana', dialCode: '+233' },
  { name: 'Ethiopia', dialCode: '+251' }, { name: 'Tanzania', dialCode: '+255' }, { name: 'Uganda', dialCode: '+256' },
  { name: 'Peru', dialCode: '+51' }, { name: 'Ecuador', dialCode: '+593' }, { name: 'Venezuela', dialCode: '+58' },
  { name: 'Costa Rica', dialCode: '+506' }, { name: 'Panama', dialCode: '+507' }, { name: 'Cuba', dialCode: '+53' },
  { name: 'Dominican Republic', dialCode: '+1' }, { name: 'Jamaica', dialCode: '+1' }, { name: 'Puerto Rico', dialCode: '+1' },
  { name: 'Iceland', dialCode: '+354' }, { name: 'Luxembourg', dialCode: '+352' }, { name: 'Slovakia', dialCode: '+421' },
  { name: 'Slovenia', dialCode: '+386' }, { name: 'Lithuania', dialCode: '+370' }, { name: 'Latvia', dialCode: '+371' },
  { name: 'Estonia', dialCode: '+372' }, { name: 'Iran', dialCode: '+98' }, { name: 'Iraq', dialCode: '+964' },
  { name: 'Kuwait', dialCode: '+965' }, { name: 'Qatar', dialCode: '+974' }, { name: 'Bahrain', dialCode: '+973' },
  { name: 'Oman', dialCode: '+968' }, { name: 'Jordan', dialCode: '+962' }, { name: 'Lebanon', dialCode: '+961' },
  { name: 'Syria', dialCode: '+963' }, { name: 'Yemen', dialCode: '+967' }, { name: 'Afghanistan', dialCode: '+93' },
  { name: 'Albania', dialCode: '+355' }, { name: 'Armenia', dialCode: '+374' }, { name: 'Azerbaijan', dialCode: '+994' },
  { name: 'Georgia', dialCode: '+995' }, { name: 'Cyprus', dialCode: '+357' }, { name: 'Malta', dialCode: '+356' },
  { name: 'Macau', dialCode: '+853' }, { name: 'Brunei', dialCode: '+673' },
].sort((a, b) => a.name.localeCompare(b.name));

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations();
  const [step, setStep] = useState<'email' | 'verify' | 'info'>('email');
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: '',
    fullName: '',
    birthYear: '',
    nationality: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [birthYearPickerOpen, setBirthYearPickerOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const birthYearPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
      if (birthYearPickerRef.current && !birthYearPickerRef.current.contains(e.target as Node)) {
        setBirthYearPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // 콜백에서 링크 처리 후 ?step=verify&email= 로 보냄 — 코드 입력 단계로 (세션은 콜백에서 이미 종료됨)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('step') !== 'verify') return;
    const em = params.get('email');
    if (em) {
      const decoded = decodeURIComponent(em);
      setFormData((prev) => ({ ...prev, email: decoded }));
      setStep('verify');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // Supabase가 인증 번호를 만들고 SMTP(Resend)로 발송. 우리가 만든 번호로 verifyOtp 호출하면 인증 실패함.
  const handleSendVerificationCode = async () => {
    if (!formData.email?.trim()) {
      setErrors({ email: t('signup.errorEmailRequired') });
      return;
    }
    if (!supabase) {
      setErrors({ email: t('signup.errorServiceUnavailable') });
      return;
    }
    setIsSendingCode(true);
    setErrors({});
    setError(null);
    try {
      // auth.users 기준 중복: 이미 있으면 OTP 발송하지 않음
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase() }),
      });
      const checkData = await checkRes.json().catch(() => ({} as { exists?: boolean; checkFailed?: boolean }));

      if (!checkRes.ok) {
        setErrors({ email: t('signup.errorEmailCheckFailed') });
        setIsSendingCode(false);
        return;
      }

      if (checkData.checkFailed === true) {
        setErrors({ email: t('signup.errorEmailCheckFailed') });
        setIsSendingCode(false);
        return;
      }

      if (checkData.exists === true) {
        setErrors({
          email: t('signup.errorEmailExists'),
        });
        setIsSendingCode(false);
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      // 콜백 URL에 next=/signup 을 넣어 이메일 링크를 눌렀을 때 가입 플로우로만 처리(세션 후 즉시 로그아웃·인증 단계로 보냄). 본문은 OTP 템플릿으로 링크 없음.
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formData.email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback?next=/signup`,
        },
      });
      if (otpError) {
        setErrors({ email: otpError.message || t('signup.errorSendCodeFailed') });
        setIsSendingCode(false);
        return;
      }
      setCountdown(60);
      setStep('verify');
    } catch (e: any) {
      setErrors({ email: e?.message || t('signup.errorSendCodeFailed') });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formData.verificationCode?.trim()) {
      setErrors({ verificationCode: t('signup.errorVerificationRequired') });
      return;
    }
    if (!supabase) {
      setErrors({ verificationCode: t('signup.errorServiceUnavailableShort') });
      return;
    }
    setIsVerifying(true);
    setErrors({});
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email.trim(),
        token: formData.verificationCode.trim(),
        type: 'email',
      });
      if (verifyError) {
        setErrors({ verificationCode: verifyError.message || t('signup.errorInvalidVerificationCode') });
        setIsVerifying(false);
        return;
      }
      setEmailVerified(true);
      setStep('info');
    } catch (e: any) {
      setErrors({ verificationCode: e?.message || t('signup.errorVerifyFailed') });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    if (!formData.fullName?.trim()) {
      setErrors((prev) => ({ ...prev, fullName: t('signup.errorFullNameRequired') }));
      return;
    }
    const birthYearNum = formData.birthYear ? parseInt(formData.birthYear, 10) : NaN;
    if (!formData.birthYear || Number.isNaN(birthYearNum) || birthYearNum < 1900 || birthYearNum > CURRENT_YEAR) {
      setErrors((prev) => ({
        ...prev,
        birthYear: t('signup.errorBirthYearInvalid', { maxYear: CURRENT_YEAR }),
      }));
      return;
    }
    if (!formData.nationality?.trim()) {
      setErrors((prev) => ({ ...prev, nationality: t('signup.errorNationalityRequired') }));
      return;
    }

    if (!agreedToTerms || !agreedToPrivacy) {
      setError(t('signup.errorTerms'));
      return;
    }

    const pwd = formData.password?.trim() ?? '';
    const pwdConfirm = formData.confirmPassword?.trim() ?? '';
    if (!pwd) {
      setErrors((prev) => ({ ...prev, password: t('signup.errorPasswordRequired') }));
      return;
    }
    const pwdCheck = validateAppPassword(pwd);
    if (!pwdCheck.valid) {
      setErrors((prev) => ({
        ...prev,
        password: pwdCheck.message ?? t('signup.errorPasswordInvalid'),
      }));
      return;
    }
    if (pwd !== pwdConfirm) {
      setErrors((prev) => ({ ...prev, confirmPassword: t('signup.errorPasswordMismatch') }));
      return;
    }

    setIsLoading(true);
    try {
      if (!supabase) {
        throw new Error(t('signup.errorServiceUnavailable'));
      }

      // OTP 인증 후 세션 있음. 트리거가 user_profiles 행을 이미 만들었을 수 있음 → create-profile이 upsert 처리
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session?.user) {
        setError(t('signup.errorSessionExpired'));
        setIsLoading(false);
        return;
      }

      const { error: pwdErr } = await supabase.auth.updateUser({ password: pwd });
      if (pwdErr) {
        setError(pwdErr.message || t('signup.errorPasswordInvalid'));
        setIsLoading(false);
        return;
      }

      const createProfilePayload = {
        userId: session.user.id,
        full_name: formData.fullName.trim(),
        phone: formData.phone?.trim() || undefined,
        birth_year: birthYearNum,
        nationality: formData.nationality.trim(),
        accessToken: session.access_token ?? undefined,
      };

      let profileRes = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createProfilePayload),
      });
      let profileData = await profileRes.json().catch(() => ({}));

      if (!profileRes.ok && profileRes.status === 404) {
        await new Promise((r) => setTimeout(r, 2000));
        profileRes = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createProfilePayload),
        });
        profileData = await profileRes.json().catch(() => ({}));
      }

      if (!profileRes.ok) {
        setError(profileData.error || t('signup.errorProfileSave'));
        setIsLoading(false);
        return;
      }

      setError('');
      router.push('/');
    } catch (e: any) {
      setError(e?.message ?? t('signup.errorGeneric'));
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    try {
      if (provider === 'google' && supabase) {
        const redirectTo = `${window.location.origin}/auth/callback?next=/mypage`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (data?.url) window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e?.message ?? t('signup.errorLoginFailed'));
    }
  };

  return (
    <SitePageShell>
      <main className="relative z-10 container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-8 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all md:p-10">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">{t('auth.signUp')}</h1>
              <p className="text-sm text-slate-600 md:text-base">{t('signup.subtitle')}</p>
              <div className="mb-4 mt-6 flex items-center justify-center">
                {(
                  [
                    { id: 'email' as const, label: t('signup.stepEmail') },
                    { id: 'verify' as const, label: t('signup.stepVerify') },
                    { id: 'info' as const, label: t('signup.stepInfo') },
                  ]
                ).map((stepItem, i) => (
                  <div key={stepItem.id} className="flex items-center">
                    {i > 0 && (
                      <div
                        className={`mx-2 h-0.5 w-12 ${
                          step === stepItem.id || (step === 'info' && stepItem.id === 'verify')
                            ? 'bg-slate-900'
                            : 'bg-slate-200'
                        }`}
                      />
                    )}
                    <div className={`flex items-center ${step === stepItem.id ? 'text-blue-600' : 'text-slate-400'}`}>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          step === stepItem.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <span className="ml-2 hidden text-xs font-medium sm:inline">{stepItem.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {step === 'email' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.emailLoginId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 placeholder:text-slate-400"
                    placeholder={t('signup.emailPlaceholder')}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode || !formData.email?.trim()}
                    className="min-w-0 flex-1 rounded-xl bg-slate-900 py-3.5 font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSendingCode ? t('signup.sending') : t('signup.sendCode')}
                  </button>
                  {countdown > 0 && (
                    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-sm shadow-sm">
                      <span className="text-slate-600">{t('signup.resendIn')}</span>
                      <span className="min-w-[2.75ch] text-right text-lg font-bold tabular-nums text-blue-700">{countdown}s</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="verificationCode" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.verificationCode')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 text-center text-2xl tracking-widest"
                    placeholder={t('signup.verificationPlaceholder')}
                  />
                  {errors.verificationCode && <p className="mt-1 text-sm text-red-600">{errors.verificationCode}</p>}
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {t('signup.sentTo')} <span className="font-semibold text-slate-700">{formData.email}</span>
                  </p>
                  <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 text-left text-xs leading-relaxed text-slate-600">
                    {t('signup.verifyLinkFallback')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('email')} className="flex-1 rounded-xl border border-slate-200/80 py-3 font-medium text-slate-700 hover:bg-white/60">
                    {t('signup.back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isVerifying || !formData.verificationCode?.trim()}
                    className="flex-1 rounded-xl bg-slate-900 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isVerifying ? t('signup.verifying') : t('signup.verify')}
                  </button>
                </div>
                {countdown > 0 ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <span>{t('signup.resendIn')}</span>
                    <span className="min-w-[3ch] text-lg font-bold tabular-nums text-blue-600">{countdown}s</span>
                  </div>
                ) : (
                  <button type="button" onClick={handleSendVerificationCode} className="w-full text-sm font-medium text-blue-600 hover:text-blue-700">
                    {t('signup.resendCode')}
                  </button>
                )}
              </div>
            )}

            {step === 'info' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="signup-email-readonly" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.emailLoginId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="signup-email-readonly"
                    readOnly
                    disabled
                    value={formData.email}
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200/80 bg-slate-100/90 px-4 py-3 text-slate-600 outline-none"
                    aria-readonly="true"
                  />
                  <p className="mt-1 text-xs text-slate-500">{t('signup.emailLockedHint')}</p>
                </div>
                <div>
                  <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.fullName')} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 placeholder:text-slate-400" placeholder={t('signup.fullNamePlaceholder')} />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.password')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 placeholder:text-slate-400"
                    placeholder={t('signup.passwordHint')}
                  />
                  <PasswordStrengthBar
                    tier={getPasswordStrengthTier(formData.password)}
                    weakLabel={t('signup.passwordStrengthWeak')}
                    strongLabel={t('signup.passwordStrengthStrong')}
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.confirmPassword')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 placeholder:text-slate-400"
                  />
                  <PasswordStrengthBar
                    tier={getPasswordStrengthTier(formData.confirmPassword)}
                    weakLabel={t('signup.passwordStrengthWeak')}
                    strongLabel={t('signup.passwordStrengthStrong')}
                  />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
                <div ref={birthYearPickerRef}>
                  <label htmlFor="birthYear" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.birthYear')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    id="birthYear"
                    onClick={() => setBirthYearPickerOpen(true)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-left text-slate-900 flex items-center justify-between"
                  >
                    <span className={formData.birthYear ? 'text-slate-900' : 'text-slate-400'}>
                      {formData.birthYear || t('signup.birthYearExample', { year: CURRENT_YEAR - 30 })}
                    </span>
                    <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {errors.birthYear && <p className="mt-1 text-sm text-red-600">{errors.birthYear}</p>}

                  <AnimatePresence>
                    {birthYearPickerOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }}
                          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                          onClick={() => setBirthYearPickerOpen(false)}
                          aria-hidden
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 24 }}
                          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] as const }}
                          className="fixed bottom-4 left-4 right-4 z-[101] flex max-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-white/25 bg-white/95 shadow-xl backdrop-blur-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex shrink-0 items-center justify-between border-b border-white/20 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-700">{t('signup.selectBirthYear')}</span>
                            <button type="button" onClick={() => setBirthYearPickerOpen(false)} className="p-2 -m-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label={t('common.close')}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 py-2">
                            {BIRTH_YEARS.map((year) => {
                              const isSelected = formData.birthYear === String(year);
                              return (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, birthYear: String(year) }));
                                    setBirthYearPickerOpen(false);
                                  }}
                                  className={`w-full px-4 py-3 text-left text-base transition-colors ${isSelected ? 'bg-blue-50/90 font-semibold text-blue-800' : 'text-slate-800 hover:bg-slate-50'}`}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <div ref={countryDropdownRef} className="relative">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.nationality')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen((o) => !o)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-left text-slate-900 flex items-center justify-between"
                  >
                    <span className={formData.nationality ? 'text-slate-900' : 'text-slate-400'}>
                      {formData.nationality || t('signup.selectCountry')}
                    </span>
                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {countryDropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-white/25 bg-white/95 shadow-lg backdrop-blur-xl">
                      <div className="border-b border-white/20 p-2">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder={t('signup.searchCountry')}
                          className="w-full rounded-lg border border-slate-200/80 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-52">
                        {COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase().trim())).map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, nationality: c.name, phone: c.dialCode + ' ' }));
                              setCountryDropdownOpen(false);
                              setCountrySearch('');
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-blue-50/80"
                          >
                            <span>{c.name}</span>
                            <span className="font-medium text-slate-500">{c.dialCode}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {errors.nationality && <p className="mt-1 text-sm text-red-600">{errors.nationality}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('signup.phoneOptional')}
                  </label>
                  <input type="tel" id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none bg-white/80 text-slate-900 placeholder:text-slate-400" placeholder={t('signup.phonePlaceholder')} />
                </div>
                <p className="text-xs text-slate-500">{t('signup.otpHint')}</p>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms-agree"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-blue-600 focus:ring-2 focus:ring-blue-500/30"
                  />
                  <label htmlFor="terms-agree" className="text-sm text-slate-700 leading-relaxed">
                    <span className="text-red-500">*</span>{' '}
                    {t('signup.agreeTermsCheckbox')}{' '}
                    <Link href="/terms" className="font-medium text-blue-600 hover:text-blue-700" target="_blank" rel="noopener noreferrer">
                      {t('signup.termsLink')}
                    </Link>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="privacy-agree"
                    checked={agreedToPrivacy}
                    onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-blue-600 focus:ring-2 focus:ring-blue-500/30"
                  />
                  <label htmlFor="privacy-agree" className="text-sm text-slate-700 leading-relaxed">
                    <span className="text-red-500">*</span>{' '}
                    {t('signup.agreePrivacyCheckbox')}{' '}
                    <Link href="/privacy" className="font-medium text-blue-600 hover:text-blue-700" target="_blank" rel="noopener noreferrer">
                      {t('signup.privacyLink')}
                    </Link>
                  </label>
                </div>
                <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-900 py-3.5 font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? t('signup.creatingAccount') : t('signup.signUpCta')}
                </button>
              </form>
            )}

            {step === 'email' && (
              <>
                <div className="relative my-6 md:my-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/25" /></div>
                  <div className="relative flex justify-center text-sm"><span className="bg-transparent px-4 font-medium text-slate-400">{t('auth.or')}</span></div>
                </div>
                <div className="space-y-2.5 md:space-y-3">
                  <button onClick={() => handleSocialLogin('google')} className="flex w-full max-w-[360px] justify-center rounded-xl border border-white/25 bg-white/80 px-5 py-3 font-medium text-slate-700 shadow-sm transition-all hover:border-slate-200/60 hover:shadow-md">
                    <span className="grid grid-cols-[24px_auto] items-center gap-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                      <span className="text-sm md:text-base">{t('auth.google')}</span>
                    </span>
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 text-center md:mt-8">
              <p className="text-sm text-slate-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
                  {t('auth.signIn')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
