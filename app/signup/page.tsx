'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

// 비밀번호: 영문+숫자+특수문자 조합 8자 이상
function validatePassword(pwd: string): { valid: boolean; message?: string } {
  if (pwd.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
  if (!/[a-zA-Z]/.test(pwd)) return { valid: false, message: 'Password must include at least one letter.' };
  if (!/[0-9]/.test(pwd)) return { valid: false, message: 'Password must include at least one number.' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd)) return { valid: false, message: 'Password must include at least one special character.' };
  return { valid: true };
}

const CURRENT_YEAR = new Date().getFullYear();

export default function SignUpPage() {
  const router = useRouter();
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

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

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleSendVerificationCode = async () => {
    if (!formData.email?.trim()) {
      setErrors({ email: 'Please enter your email address.' });
      return;
    }
    setIsSendingCode(true);
    setErrors({});
    setError(null);
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ email: data.error || 'Failed to send verification code.' });
        setIsSendingCode(false);
        return;
      }
      setCountdown(60);
      setStep('verify');
    } catch (e: any) {
      setErrors({ email: e?.message || 'Failed to send verification code.' });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formData.verificationCode?.trim()) {
      setErrors({ verificationCode: 'Please enter the verification code.' });
      return;
    }
    setIsVerifying(true);
    setErrors({});
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim(), code: formData.verificationCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ verificationCode: data.error || 'Invalid verification code.' });
        setIsVerifying(false);
        return;
      }
      setEmailVerified(true);
      setStep('info');
    } catch (e: any) {
      setErrors({ verificationCode: e?.message || 'Failed to verify code.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    if (!formData.fullName?.trim()) {
      setErrors((prev) => ({ ...prev, fullName: 'Full name is required.' }));
      return;
    }
    const birthYearNum = formData.birthYear ? parseInt(formData.birthYear, 10) : NaN;
    if (!formData.birthYear || Number.isNaN(birthYearNum) || birthYearNum < 1900 || birthYearNum > CURRENT_YEAR) {
      setErrors((prev) => ({ ...prev, birthYear: `Please enter a valid birth year (1900–${CURRENT_YEAR}).` }));
      return;
    }
    if (!formData.nationality?.trim()) {
      setErrors((prev) => ({ ...prev, nationality: 'Nationality is required.' }));
      return;
    }

    const pwdCheck = validatePassword(formData.password);
    if (!pwdCheck.valid) {
      setErrors((prev) => ({ ...prev, password: pwdCheck.message! }));
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      if (!supabase) {
        throw new Error('Service unavailable. Please try again later.');
      }

      // 로그인 아이디 = 인증된 이메일 (별도 아이디 필드 없음). 비밀번호로 가입.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
          data: {
            full_name: formData.fullName.trim(),
            birth_year: birthYearNum,
            nationality: formData.nationality.trim(),
            phone: formData.phone?.trim() || null,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || '';
        if (/already registered|already exists|already been registered/i.test(msg)) {
          setError('This email is already registered. If you signed up with Google, please sign in with Google.');
        } else {
          setErrors((prev) => ({ ...prev, email: msg }));
        }
        setIsLoading(false);
        return;
      }

      if (!data?.user) {
        setError('Sign up did not return a user. Please try again.');
        setIsLoading(false);
        return;
      }

      const session = data.session ?? (await supabase.auth.getSession()).data?.session;
      const accessToken = session?.access_token ?? undefined;

      const profileRes = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          full_name: formData.fullName.trim(),
          phone: formData.phone?.trim() || undefined,
          birth_year: birthYearNum,
          nationality: formData.nationality.trim(),
          accessToken: accessToken ?? undefined,
        }),
      });
      const profileData = await profileRes.json().catch(() => ({}));

      if (!profileRes.ok) {
        if (profileRes.status === 409) {
          setError('This account already exists. Please sign in.');
          setIsLoading(false);
          return;
        }
        try {
          await fetch('/api/auth/delete-user-without-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId: data.user.id, accessToken: accessToken ?? undefined }),
          });
        } catch (_) {}
        setError(profileData.error || 'Failed to create profile. Please try again.');
        setIsLoading(false);
        return;
      }

      alert('Account created successfully. You can sign in with your email and password.');
      router.push('/signin');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'line') => {
    try {
      if (provider === 'line') {
        window.location.href = '/api/auth/line';
        return;
      }
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
      setError(e?.message ?? 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-neutral-50 to-slate-100 relative">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)' }} />
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
        <div className="max-w-md mx-auto">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-8 md:p-10 transition-all">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Sign Up</h1>
              <p className="text-gray-600 text-sm md:text-base">Create your AtoCKorea account (login with your email)</p>
              <div className="flex items-center justify-center mt-6 mb-4">
                {['email', 'verify', 'info'].map((s, i) => (
                  <div key={s} className="flex items-center">
                    {i > 0 && <div className={`w-12 h-0.5 mx-2 ${step === s || (step === 'info' && s === 'verify') ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
                    <div className={`flex items-center ${step === s ? 'text-indigo-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
                      <span className="ml-2 text-xs font-medium hidden sm:inline capitalize">{s}</span>
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
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email (Login ID) <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400"
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
                <button type="button" onClick={handleSendVerificationCode} disabled={isSendingCode || !formData.email?.trim()} className="w-full py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSendingCode ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="verificationCode" className="block text-sm font-semibold text-gray-700 mb-2">Verification Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="verificationCode"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                  {errors.verificationCode && <p className="mt-1 text-sm text-red-600">{errors.verificationCode}</p>}
                  <p className="mt-2 text-xs text-gray-500 text-center">Sent to <span className="font-semibold text-gray-700">{formData.email}</span></p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('email')} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Back</button>
                  <button type="button" onClick={handleVerifyCode} disabled={isVerifying || !formData.verificationCode?.trim()} className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{isVerifying ? 'Verifying...' : 'Verify'}</button>
                </div>
                {countdown > 0 ? <p className="text-center text-sm text-gray-500">Resend in <span className="font-semibold text-indigo-600">{countdown}s</span></p> : <button type="button" onClick={handleSendVerificationCode} className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium">Resend Verification Code</button>}
              </div>
            )}

            {step === 'info' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-xs text-gray-500 mb-2">Login ID: <span className="font-semibold text-gray-700">{formData.email}</span></p>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400" placeholder="John Doe" />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                </div>
                <div>
                  <label htmlFor="birthYear" className="block text-sm font-semibold text-gray-700 mb-2">Birth Year <span className="text-red-500">*</span></label>
                  <input type="number" id="birthYear" value={formData.birthYear} onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })} min={1900} max={CURRENT_YEAR} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400" placeholder={String(CURRENT_YEAR - 30)} />
                  {errors.birthYear && <p className="mt-1 text-sm text-red-600">{errors.birthYear}</p>}
                </div>
                <div>
                  <label htmlFor="nationality" className="block text-sm font-semibold text-gray-700 mb-2">Nationality <span className="text-red-500">*</span></label>
                  <input type="text" id="nationality" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400" placeholder="e.g. South Korea, USA" />
                  {errors.nationality && <p className="mt-1 text-sm text-red-600">{errors.nationality}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone (optional, for booking)</label>
                  <input type="tel" id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400" placeholder="+82 10 1234 5678" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password <span className="text-red-500">*</span></label>
                  <input type="password" id="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400 ${errors.password ? 'border-red-300' : 'border-gray-200'}`} placeholder="Letters, numbers, special chars, 8+ characters" />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                  <input type="password" id="confirmPassword" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 text-gray-900 placeholder:text-gray-400 ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'}`} placeholder="Re-enter password" />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
                <div className="flex items-start">
                  <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 bg-white border-gray-300" />
                  <label htmlFor="terms" className="ml-3 text-sm text-gray-700">I agree to the <Link href="/terms" className="text-indigo-600 hover:text-indigo-700 font-medium">Terms of Service</Link> and <Link href="/privacy" className="text-indigo-600 hover:text-indigo-700 font-medium">Privacy Policy</Link></label>
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {isLoading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>
            )}

            {step === 'email' && (
              <>
                <div className="relative my-6 md:my-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-4 bg-transparent text-gray-400 font-medium">or</span></div>
                </div>
                <div className="space-y-2.5 md:space-y-3">
                  <button onClick={() => handleSocialLogin('google')} className="w-full max-w-[360px] flex justify-center px-5 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md font-medium text-gray-700 shadow-sm">
                    <span className="grid grid-cols-[24px_auto] items-center gap-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                      <span className="text-sm md:text-base">Google</span>
                    </span>
                  </button>
                  <button onClick={() => handleSocialLogin('line')} className="w-full max-w-[360px] flex justify-center px-5 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md font-medium text-gray-700 shadow-sm">
                    <span className="grid grid-cols-[24px_auto] items-center gap-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#00C300"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771z" /></svg>
                      <span className="text-sm md:text-base">LINE</span>
                    </span>
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 md:mt-8 text-center">
              <p className="text-gray-600 text-sm">Already have an account? <Link href="/signin" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign In</Link></p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
