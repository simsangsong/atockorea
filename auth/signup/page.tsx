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
    </div>
  );
}
