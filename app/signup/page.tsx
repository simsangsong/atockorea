'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'verify' | 'info'>('email');
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: '',
    fullName: '',
    age: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  // 检查 URL 参数中的错误
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

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendVerificationCode = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email address' });
      return;
    }

    setIsSendingCode(true);
    setErrors({});

    try {
      // 调用自定义验证码 API
      const response = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ email: data.error || 'Failed to send verification code' });
        setIsSendingCode(false);
        return;
      }

      setCountdown(60);
      setStep('verify');
    } catch (error: any) {
      setErrors({ email: error.message || 'Failed to send verification code' });
    } finally {
      setIsSendingCode(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!formData.verificationCode) {
      setErrors({ verificationCode: 'Please enter the verification code' });
      return;
    }

    setIsVerifying(true);
    setErrors({});

    try {
      // 调用自定义验证码验证 API
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: formData.verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ verificationCode: data.error || 'Invalid verification code' });
        setIsVerifying(false);
        return;
      }

      setEmailVerified(true);
      setStep('info');
    } catch (error: any) {
      setErrors({ verificationCode: error.message || 'Failed to verify code' });
    } finally {
      setIsVerifying(false);
    }
  };

  // 提交注册
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.fullName.trim()) {
      setErrors({ fullName: 'Full name is required' });
      return;
    }

    if (!formData.age || parseInt(formData.age) < 1 || parseInt(formData.age) > 120) {
      setErrors({ age: 'Please enter a valid age' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setIsLoading(true);

    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // 由于邮箱已验证，直接使用密码注册
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: formData.fullName,
            age: parseInt(formData.age),
          },
        },
      });

      if (error) {
        setErrors({ email: error.message });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 创建用户资料
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          full_name: formData.fullName,
        });

        alert('Account created successfully! Please check your email to verify your account.');
        router.push('/signin');
      }
    } catch (error: any) {
      setErrors({ email: error.message });
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'kakao' | 'line') => {
    try {
      // LINE OAuth 使用自定义实现
      if (provider === 'line') {
        window.location.href = '/api/auth/line';
        return;
      }

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/mypage`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-neutral-50 to-slate-100 relative">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)`
      }}></div>
      
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
        <div className="max-w-md mx-auto">
          {/* Sign Up Card - Premium Style */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-8 md:p-10 transition-all">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Sign Up
              </h1>
              <p className="text-gray-600 text-sm md:text-base">Create your AtoCKorea account</p>
              
              {/* Progress Steps */}
              <div className="flex items-center justify-center mt-6 mb-4">
                <div className={`flex items-center ${step === 'email' ? 'text-indigo-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === 'email' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    1
                  </div>
                  <span className="ml-2 text-xs font-medium hidden sm:inline">Email</span>
                </div>
                <div className={`w-12 h-0.5 mx-2 ${step === 'verify' || step === 'info' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                <div className={`flex items-center ${step === 'verify' ? 'text-indigo-600' : step === 'info' ? 'text-indigo-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === 'verify' || step === 'info' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    2
                  </div>
                  <span className="ml-2 text-xs font-medium hidden sm:inline">Verify</span>
                </div>
                <div className={`w-12 h-0.5 mx-2 ${step === 'info' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                <div className={`flex items-center ${step === 'info' ? 'text-indigo-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === 'info' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <span className="ml-2 text-xs font-medium hidden sm:inline">Info</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm" role="alert">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Step 1: Email */}
            {step === 'email' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSendVerificationCode}
                  disabled={isSendingCode || !formData.email}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSendingCode ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            )}

            {/* Step 2: Verify Code */}
            {step === 'verify' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="verificationCode" className="block text-sm font-semibold text-gray-700 mb-2">
                    Verification Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value })}
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                  {errors.verificationCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.verificationCode}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    We sent a verification code to <span className="font-semibold text-gray-700">{formData.email}</span>
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isVerifying || !formData.verificationCode}
                    className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>

                {countdown > 0 ? (
                  <p className="text-center text-sm text-gray-500">
                    Resend code in <span className="font-semibold text-indigo-600">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Resend Verification Code
                  </button>
                )}
              </div>
            )}

            {/* Step 3: User Info */}
            {step === 'info' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white"
                    placeholder="John Doe"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="age" className="block text-sm font-semibold text-gray-700 mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="age"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    required
                    min="1"
                    max="120"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white"
                    placeholder="25"
                  />
                  {errors.age && (
                    <p className="mt-1 text-sm text-red-600">{errors.age}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white ${
                      errors.password ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="At least 8 characters"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Confirm your password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 bg-white border-gray-300"
                  />
                  <label htmlFor="terms" className="ml-3 text-sm text-gray-700">
                    I agree to the{' '}
                    <Link href="/terms" className="text-indigo-600 hover:text-indigo-700 font-medium">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-indigo-600 hover:text-indigo-700 font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>
            )}

            {/* Divider - Only show on email step */}
            {step === 'email' && (
              <>
                <div className="relative my-6 md:my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-transparent text-gray-400 font-medium">or</span>
                  </div>
                </div>

                {/* Social Login Buttons - Premium Style */}
                <div className="space-y-2.5 md:space-y-3">
                  <button
                    onClick={() => handleSocialLogin('google')}
                    className="w-full py-2.5 md:py-3 px-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-center gap-3 font-medium text-gray-700 shadow-sm hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-sm md:text-base">Google</span>
                  </button>

                  <button
                    onClick={() => handleSocialLogin('facebook')}
                    className="w-full py-2.5 md:py-3 px-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-center gap-3 font-medium text-gray-700 shadow-sm hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span className="text-sm md:text-base">Facebook</span>
                  </button>

                  <button
                    onClick={() => handleSocialLogin('kakao')}
                    className="w-full py-2.5 md:py-3 px-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-center gap-3 font-medium text-gray-700 shadow-sm hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/KakaoTalk_logo.svg/500px-KakaoTalk_logo.svg.png" 
                      alt="KakaoTalk" 
                      className="w-5 h-5 object-contain"
                    />
                    <span className="text-sm md:text-base">Kakao</span>
                  </button>

                  <button
                    onClick={() => handleSocialLogin('line')}
                    className="w-full py-2.5 md:py-3 px-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-center gap-3 font-medium text-gray-700 shadow-sm hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#00C300">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.058 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                    <span className="text-sm md:text-base">LINE</span>
                  </button>
                </div>
              </>
            )}

            {/* Sign In Link */}
            <div className="mt-6 md:mt-8 text-center">
              <p className="text-gray-600 text-sm">
                Already have an account?{' '}
                <Link href="/signin" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                  Sign In
                </Link>
              </p>
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
