// app/auth/signup/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // TODO: 调用 /api/auth/register 创建用户
    setLoading(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-6">
      <h1 className="mb-2 text-[20px] font-semibold">Sign up</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        Create your AtoC Korea account to book and manage tours easily.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
      >
        <div>
          <label className="mb-1 block text-[12px] text-gray-700">
            Name
          </label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#0c66ff]"
          />
        </div>

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
          {loading ? "Signing up..." : "Create account"}
        </button>
      </form>

      <p className="mt-3 text-center text-[12px] text-gray-600">
        Already have an account?{" "}
        <Link href="/auth/signin" className="text-[#0c66ff] font-semibold">
          Sign in
        </Link>
      </p>

      {/* SNS Login Buttons - Using Flexbox for perfect icon alignment */}
      <div className="flex flex-col items-center gap-4 mt-8">
        {/* Google Button */}
        <button
          type="button"
          className="relative w-[280px] flex items-center px-4 py-3 bg-white rounded-lg border border-gray-200 cursor-pointer"
          aria-label="Google Login"
        >
          <div className="absolute left-4 w-6 h-6 flex-shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          </div>
          <span className="ml-12 text-sm font-medium text-gray-800">Google</span>
        </button>

        {/* Facebook Button */}
        <button
          type="button"
          className="relative w-[280px] flex items-center px-4 py-3 bg-white rounded-lg border border-gray-200 cursor-pointer"
          aria-label="Facebook Login"
        >
          <div className="absolute left-4 w-6 h-6 flex-shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                fill="#1877F2"
              />
            </svg>
          </div>
          <span className="ml-12 text-sm font-medium text-gray-800">Facebook</span>
        </button>

        {/* Kakao Button */}
        <button
          type="button"
          className="relative w-[280px] flex items-center px-4 py-3 bg-white rounded-lg border border-gray-200 cursor-pointer"
          aria-label="Kakao Login"
        >
          <div className="absolute left-4 w-6 h-6 flex-shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="24" height="24" rx="12" fill="#FEE500" />
              <path
                d="M12 8C9.243 8 7 9.79 7 12c0 1.4.7 2.66 1.8 3.5L8 17l2.2-1.2c.3.05.6.1.8.1 2.757 0 5-1.79 5-4s-2.243-4-5-4z"
                fill="#000000"
              />
            </svg>
          </div>
          <span className="ml-12 text-sm font-medium text-gray-800">Kakao</span>
        </button>

        {/* LINE Button */}
        <button
          type="button"
          className="relative w-[280px] flex items-center px-4 py-3 bg-white rounded-lg border border-gray-200 cursor-pointer"
          aria-label="LINE Login"
        >
          <div className="absolute left-4 w-6 h-6 flex-shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="24" height="24" rx="12" fill="#06C755" />
              <path
                d="M12 7.5C9.515 7.5 7.5 9.515 7.5 12c0 2.485 2.015 4.5 4.5 4.5s4.5-2.015 4.5-4.5S14.485 7.5 12 7.5z"
                fill="white"
              />
            </svg>
          </div>
          <span className="ml-12 text-sm font-medium text-gray-800">LINE</span>
        </button>
      </div>
    </div>
  );
}
