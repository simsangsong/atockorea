// app/auth/signin/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // TODO: 调用 /api/auth/login 或 NextAuth signIn
    setLoading(false);
  }

  const snsButtons = [
    {
      key: "google",
      label: "Google",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      ),
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
        </svg>
      ),
    },
    {
      key: "kakao",
      label: "Kakao",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="12" fill="#FEE500" />
          <path d="M12 8C9.243 8 7 9.79 7 12c0 1.4.7 2.66 1.8 3.5L8 17l2.2-1.2c.3.05.6.1.8.1 2.757 0 5-1.79 5-4s-2.243-4-5-4z" fill="#000000" />
        </svg>
      ),
    },
    {
      key: "line",
      label: "LINE",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="12" fill="#06C755" />
          <path d="M12 7.5C9.515 7.5 7.5 9.515 7.5 12c0 2.485 2.015 4.5 4.5 4.5s4.5-2.015 4.5-4.5S14.485 7.5 12 7.5z" fill="white" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-6">
      <h1 className="mb-2 text-[20px] font-semibold">Sign in</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        Log in to manage your bookings and saved tours.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
      >
        <div>
          <label className="mb-1 block text-[12px] text-gray-700">
            Email
          </label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#0c66ff]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] text-gray-700">
            Password
          </label>
          <input
            type="password"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#0c66ff]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-full bg-[#0c66ff] py-2.5 text-[13px] font-semibold text-white hover:bg-[#0050d0] disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-3 text-center text-[12px] text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-[#0c66ff] font-semibold">
          Sign up
        </Link>
      </p>

      {/* SNS Login Buttons - Icons aligned vertically on same X-axis */}
      <div className="mt-8 flex flex-col items-start gap-3">
        {snsButtons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            className="w-full max-w-[360px] grid grid-cols-[24px_auto] items-center gap-3 px-5 py-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 cursor-pointer text-left"
            aria-label={`${btn.label} Login`}
          >
            <span className="flex h-6 w-6 items-center justify-center flex-shrink-0">
              {btn.icon}
            </span>
            <span className="text-sm font-medium text-gray-800">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
