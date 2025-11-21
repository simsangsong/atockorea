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
    </div>
  );
}
