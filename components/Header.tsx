// components/Header.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CityFilter = "All" | "Seoul" | "Busan" | "Jeju";

export default function Header() {
  const router = useRouter();

  const [openSearch, setOpenSearch] = useState(false);
  const [city, setCity] = useState<CityFilter>("All");
  const [keyword, setKeyword] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (city && city !== "All") params.set("city", city);
    if (keyword.trim()) params.set("q", keyword.trim());

    const url = params.toString()
      ? `/search?${params.toString()}`
      : "/search";

    router.push(url);
    setOpenSearch(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* Left: Logo */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0c66ff] to-[#0050d0] text-[11px] font-semibold text-white">
              A2C
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold">AtoC Korea</span>
              <span className="text-[10px] text-gray-500">
                Agency-to-Customer Tours
              </span>
            </div>
          </button>

          {/* Center: (기존 Seoul / Busan / Jeju 텍스트 제거, 빈 공간만 유지) */}
          <div className="hidden sm:block" />

          {/* Right: search + sign in */}
          <div className="flex items-center gap-3">
            {/* Search icon button */}
            <button
              aria-label="Search tours"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              onClick={() => setOpenSearch(true)}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L19 20.49 20.49 19 15.5 14zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z"
                  fill="currentColor"
                />
              </svg>
            </button>

            {/* Sign in */}
            <Link
              href="/auth/signin"
              className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-700 hover:border-[#0c66ff] hover:text-[#0c66ff]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Search Overlay ===== */}
      {openSearch && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 backdrop-blur-sm">
          <div className="mt-24 w-[90%] max-w-md rounded-3xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#111]">
                Search tours
              </h2>
              <button
                onClick={() => setOpenSearch(false)}
                className="rounded-full px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              {/* City select */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Destination
                </label>
                <select
                  value={city}
                  onChange={(e) =>
                    setCity(e.target.value as CityFilter)
                  }
                  className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-[13px]"
                >
                  <option value="All">All</option>
                  <option value="Seoul">Seoul</option>
                  <option value="Busan">Busan</option>
                  <option value="Jeju">Jeju</option>
                </select>
              </div>

              {/* Keyword input */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Keyword
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="night view, UNESCO, food tour..."
                  className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-[13px]"
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenSearch(false)}
                  className="rounded-2xl border border-gray-300 px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-[#0c66ff] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0050d0]"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
