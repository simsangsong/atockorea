"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Logo from "./Logo";
import { SearchIcon, UserIcon } from "./Icons";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 检测当前路径，判断是否在深色背景页面
  const isDarkPage = pathname === '/signin' || pathname === '/signup';

  // Listen for search open event
  useEffect(() => {
    const handleOpenSearch = () => {
      setIsSearchOpen(true);
    };
    window.addEventListener("openSearch", handleOpenSearch);
    return () => window.removeEventListener("openSearch", handleOpenSearch);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tours?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm ${
      isDarkPage 
        ? 'bg-gray-900/80 border-white/10' 
        : 'bg-white/80 border-gray-200/50'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Logo className="h-8 sm:h-10 md:h-12" />
          </Link>

          {/* Right Side - Language, Search, Sign In */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                isDarkPage 
                  ? 'text-gray-300 hover:text-indigo-400' 
                  : 'text-gray-700 hover:text-indigo-600'
              }`}
            >
              {language === "en" ? "EN" : "中文"}
            </button>

            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`p-2 transition-colors ${
                isDarkPage 
                  ? 'text-gray-300 hover:text-indigo-400' 
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
              aria-label="Search"
            >
              <SearchIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Sign In - Premium Button Style */}
            <Link
              href="/signin"
              className={`group flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                isDarkPage 
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-400/30 hover:bg-indigo-500/20 hover:border-indigo-400/50' 
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm'
              }`}
              title="Sign In"
            >
              <UserIcon className={`w-4 h-4 sm:w-4 sm:h-4 transition-transform group-hover:scale-110 flex-shrink-0 ${
                isDarkPage ? 'text-indigo-300' : 'text-gray-600'
              }`} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 sm:pt-32 px-4"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="flex gap-2 sm:gap-3">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for tours, destinations..."
                  className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm sm:text-base"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 sm:px-6 py-3 sm:py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-sm sm:text-base"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="px-4 py-3 sm:py-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}

