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
import { PasswordToggle } from '@/components/auth/PasswordToggle';
import { GoogleLogo } from '@/components/auth/GoogleLogo';
import Logo from '@/components/Logo';
import {
  AUTH_CHECKBOX,
  AUTH_FIELD_LABEL,
  AUTH_FORM_CARD,
  AUTH_GOOGLE_PANEL,
  AUTH_INPUT,
  AUTH_INPUT_WITH_TOGGLE,
  AUTH_LEAD,
  AUTH_LINK,
  AUTH_OTP_INPUT,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
  AUTH_REVEAL_ALT_SIGNIN_BUTTON,
  AUTH_SUBTLE_LINK,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  /** 이메일 섹션 접기/펼치기 — 기본은 접힘, Google OAuth 가입을 기본 경로로 유도 */
  const [emailRevealed, setEmailRevealed] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const birthYearPickerRef = useRef<HTMLDivElement>(null);

  const getRedirectAfterAuth = (): string => {
    if (typeof window === 'undefined') return '/mypage';
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      !redirect.includes(':')
    ) {
      return redirect;
    }
    return '/mypage';
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
      if (birthYearPickerRef.current && !birthYearPickerRef.current.contains(e.target as Node)) {
        setBirthYearPickerOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setCountryDropdownOpen(false);
        setBirthYearPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
        return;
      }

      setError('');
      router.push(getRedirectAfterAuth());
    } catch (e: any) {
      setError(e?.message ?? t('signup.errorGeneric'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    try {
      if (provider === 'google' && supabase) {
        const next = getRedirectAfterAuth();
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
      <main
        className={cn(
          'relative z-10 container mx-auto px-4 py-12 sm:px-6 md:py-20 lg:px-8',
          AUTH_PAGE_BACKDROP,
        )}
      >
        <div className="mx-auto max-w-[420px]">
          <div className={cn(AUTH_FORM_CARD, 'px-6 py-8 sm:px-9 sm:py-10')}>
              <div className="text-center">
                <div className="flex justify-center">
                  <Link
                    href="/"
                    className="inline-flex !min-h-0 !min-w-0 items-center justify-center rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8eaef]"
                    aria-label={t('nav.home')}
                  >
                    <Logo markOnly className="justify-center" variant="default" />
                  </Link>
                </div>
                <h1 className={cn(AUTH_PAGE_TITLE, 'mt-7')}>{t('auth.signUp')}</h1>
                <p className={AUTH_LEAD}>{t('signup.subtitle')}</p>
              </div>

              <div className="mt-9 space-y-8">
            <p role="status" aria-live="polite" className="sr-only">
              {step === 'email'
                ? t('signup.stepEmailLabel')
                : step === 'verify'
                  ? t('signup.stepVerifyLabel')
                  : t('signup.stepInfoLabel')}
            </p>
            {error && (
              <div
                className="flex items-center gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-red-800 shadow-[0_8px_28px_-18px_rgba(220,38,38,0.2)]"
                role="alert"
                aria-live="polite"
              >
                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-[14px] font-medium leading-snug">{error}</span>
              </div>
            )}

            {step === 'email' && (
              <div className="space-y-6">
                <div className={AUTH_GOOGLE_PANEL}>
                  <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t('auth.signInWith')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    className="home-btn-secondary home-btn-secondary--auth-google w-full gap-3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <GoogleLogo className="h-5 w-5 shrink-0" />
                    <span>{t('signup.continueWithGoogle')}</span>
                  </button>
                  <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-500">
                    {t('signup.googleAccountHint')}
                  </p>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {emailRevealed ? (
                    <motion.div
                      key="email-methods"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-5"
                    >
                      <div className="relative py-0.5">
                        <div className="absolute inset-0 flex items-center" aria-hidden>
                          <div className="w-full border-t border-slate-200/70" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="rounded-full bg-gradient-to-b from-white to-slate-50/90 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200/60">
                            {t('auth.or')}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className={AUTH_FIELD_LABEL}>
                          {t('signup.emailLoginId')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          autoFocus
                          className={AUTH_INPUT}
                          placeholder={t('signup.emailPlaceholder')}
                        />
                        {errors.email && <p className="mt-1 text-[12px] text-red-600">{errors.email}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSendVerificationCode}
                          disabled={isSendingCode || !formData.email?.trim()}
                          className="home-btn-primary min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSendingCode ? t('signup.sending') : t('signup.sendCode')}
                        </button>
                        {countdown > 0 && (
                          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-[13px] shadow-sm">
                            <span className="text-slate-600">{t('signup.resendIn')}</span>
                            <span className="min-w-[2.75ch] text-right text-lg font-bold tabular-nums text-slate-900">{countdown}s</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="reveal-cta"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEmailRevealed(true);
                          setError(null);
                        }}
                        className={AUTH_REVEAL_ALT_SIGNIN_BUTTON}
                      >
                        {t('signup.signUpWithEmail')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="verificationCode" className={AUTH_FIELD_LABEL}>
                    {t('signup.verificationCode')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    maxLength={6}
                    className={AUTH_OTP_INPUT}
                    placeholder={t('signup.verificationPlaceholder')}
                  />
                  {errors.verificationCode && <p className="mt-1 text-[12px] text-red-600">{errors.verificationCode}</p>}
                  <p className="mt-2 text-center text-[12px] text-slate-500">
                    {t('signup.sentTo')} <span className="font-semibold text-slate-700">{formData.email}</span>
                  </p>
                  <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-left text-[12px] leading-relaxed text-slate-600">
                    {t('signup.verifyLinkFallback')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('email')} className="home-btn-secondary flex-1">
                    {t('signup.back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isVerifying || !formData.verificationCode?.trim()}
                    className="home-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifying ? t('signup.verifying') : t('signup.verify')}
                  </button>
                </div>
                {countdown > 0 ? (
                  <div className="flex items-center justify-center gap-2 text-[13px] text-slate-500">
                    <span>{t('signup.resendIn')}</span>
                    <span className="min-w-[3ch] text-lg font-bold tabular-nums text-slate-900">{countdown}s</span>
                  </div>
                ) : (
                  <button type="button" onClick={handleSendVerificationCode} className={cn(AUTH_SUBTLE_LINK, 'w-full text-[13px]')}>
                    {t('signup.resendCode')}
                  </button>
                )}
              </div>
            )}

            {step === 'info' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Account group */}
                <section>
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {t('signup.accountGroupTitle')}
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="signup-email-readonly" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                        {t('signup.emailLoginId')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        id="signup-email-readonly"
                        readOnly
                        disabled
                        value={formData.email}
                        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-600 outline-none"
                        aria-readonly="true"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">{t('signup.emailLockedHint')}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="password" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                          {t('signup.password')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            autoComplete="new-password"
                            className={AUTH_INPUT_WITH_TOGGLE}
                            placeholder={t('signup.passwordHint')}
                          />
                          <PasswordToggle
                            show={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                            showLabel={t('auth.showPassword')}
                            hideLabel={t('auth.hidePassword')}
                          />
                        </div>
                        <PasswordStrengthBar
                          tier={getPasswordStrengthTier(formData.password)}
                          weakLabel={t('signup.passwordStrengthWeak')}
                          strongLabel={t('signup.passwordStrengthStrong')}
                        />
                        {errors.password && <p className="mt-1 text-[12px] text-red-600">{errors.password}</p>}
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                          {t('signup.confirmPassword')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                            autoComplete="new-password"
                            className={AUTH_INPUT_WITH_TOGGLE}
                          />
                          <PasswordToggle
                            show={showConfirmPassword}
                            onToggle={() => setShowConfirmPassword((v) => !v)}
                            showLabel={t('auth.showPassword')}
                            hideLabel={t('auth.hidePassword')}
                          />
                        </div>
                        <PasswordStrengthBar
                          tier={getPasswordStrengthTier(formData.confirmPassword)}
                          weakLabel={t('signup.passwordStrengthWeak')}
                          strongLabel={t('signup.passwordStrengthStrong')}
                        />
                        {errors.confirmPassword && <p className="mt-1 text-[12px] text-red-600">{errors.confirmPassword}</p>}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Identity group */}
                <section>
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {t('signup.identityGroupTitle')}
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="fullName" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                        {t('signup.fullName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        className={AUTH_INPUT}
                        placeholder={t('signup.fullNamePlaceholder')}
                      />
                      {errors.fullName && <p className="mt-1 text-[12px] text-red-600">{errors.fullName}</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                  <div ref={birthYearPickerRef} className="relative">
                    <label htmlFor="birthYear" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                    {t('signup.birthYear')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    id="birthYear"
                    onClick={() => setBirthYearPickerOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={birthYearPickerOpen}
                    className={cn(
                      AUTH_INPUT,
                      'flex items-center justify-between text-left',
                    )}
                  >
                    <span className={formData.birthYear ? 'text-slate-900' : 'text-slate-400'}>
                      {formData.birthYear || t('signup.birthYearExample', { year: CURRENT_YEAR - 30 })}
                    </span>
                    <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {errors.birthYear && <p className="mt-1 text-[12px] text-red-600">{errors.birthYear}</p>}

                  {/* Desktop: anchored popover */}
                  <AnimatePresence>
                    {birthYearPickerOpen && (
                      <motion.div
                        key="birth-desktop"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] as const }}
                        role="listbox"
                        aria-label={t('signup.selectBirthYear')}
                        className="absolute z-20 mt-1 hidden max-h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.18)] md:block"
                      >
                        <div className="max-h-64 overflow-y-auto py-1">
                          {BIRTH_YEARS.map((year) => {
                            const isSelected = formData.birthYear === String(year);
                            return (
                              <button
                                key={year}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, birthYear: String(year) }));
                                  setBirthYearPickerOpen(false);
                                }}
                                className={cn(
                                  'w-full px-4 py-2.5 text-left text-[14px] transition-colors',
                                  isSelected ? 'bg-slate-900 font-semibold text-white' : 'text-slate-800 hover:bg-slate-50',
                                )}
                              >
                                {year}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mobile: full-width bottom sheet */}
                  <AnimatePresence>
                    {birthYearPickerOpen && (
                      <>
                        <motion.div
                          key="birth-mobile-backdrop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }}
                          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm md:hidden"
                          onClick={() => setBirthYearPickerOpen(false)}
                          aria-hidden
                        />
                        <motion.div
                          key="birth-mobile-sheet"
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 24 }}
                          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] as const }}
                          role="dialog"
                          aria-modal="true"
                          aria-label={t('signup.selectBirthYear')}
                          className="fixed bottom-4 left-4 right-4 z-[101] flex max-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl md:hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-700">{t('signup.selectBirthYear')}</span>
                            <button type="button" onClick={() => setBirthYearPickerOpen(false)} className="-m-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
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
                                  className={cn(
                                    'w-full px-4 py-3 text-left text-base transition-colors',
                                    isSelected ? 'bg-slate-900 font-semibold text-white' : 'text-slate-800 hover:bg-slate-50',
                                  )}
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
                    <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                    {t('signup.nationality')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={countryDropdownOpen}
                    className={cn(
                      AUTH_INPUT,
                      'flex items-center justify-between text-left',
                    )}
                  >
                    <span className={formData.nationality ? 'text-slate-900' : 'text-slate-400'}>
                      {formData.nationality || t('signup.selectCountry')}
                    </span>
                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {countryDropdownOpen && (
                    <div
                      role="listbox"
                      aria-label={t('signup.selectCountry')}
                      className="absolute z-20 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.18)]"
                    >
                      <div className="border-b border-slate-200 p-2">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder={t('signup.searchCountry')}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/12"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase().trim())).map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            role="option"
                            aria-selected={formData.nationality === c.name}
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, nationality: c.name, phone: c.dialCode + ' ' }));
                              setCountryDropdownOpen(false);
                              setCountrySearch('');
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                          >
                            <span>{c.name}</span>
                            <span className="font-medium text-slate-500">{c.dialCode}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {errors.nationality && <p className="mt-1 text-[12px] text-red-600">{errors.nationality}</p>}
                    </div>
                    </div>
                  </div>
                </section>

                {/* Contact & Consent group */}
                <section>
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {t('signup.contactGroupTitle')}
                  </h2>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                    {t('signup.phoneOptional')}
                  </label>
                  <input type="tel" id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={AUTH_INPUT} placeholder={t('signup.phonePlaceholder')} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{t('signup.otpHint')}</p>
                <div className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms-agree"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className={AUTH_CHECKBOX}
                  />
                  <label htmlFor="terms-agree" className="text-[13px] leading-relaxed text-slate-700">
                    <span className="text-red-500">*</span>{' '}
                    {t('signup.agreeTermsCheckbox')}{' '}
                    <Link href="/terms" className={AUTH_LINK} target="_blank" rel="noopener noreferrer">
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
                    className={AUTH_CHECKBOX}
                  />
                  <label htmlFor="privacy-agree" className="text-[13px] leading-relaxed text-slate-700">
                    <span className="text-red-500">*</span>{' '}
                    {t('signup.agreePrivacyCheckbox')}{' '}
                    <Link href="/privacy" className={AUTH_LINK} target="_blank" rel="noopener noreferrer">
                      {t('signup.privacyLink')}
                    </Link>
                  </label>
                </div>
                <button type="submit" disabled={isLoading} className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? t('signup.creatingAccount') : t('signup.signUpCta')}
                </button>
                </section>
              </form>
            )}
              </div>

            <div className="mt-10 border-t border-slate-200 pt-8 text-center">
              <p className="text-[14px] text-slate-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/signin" className={AUTH_LINK}>
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
