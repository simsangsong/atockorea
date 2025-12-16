"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Logo from "./Logo";
import { SearchIcon, UserIcon } from "./Icons";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const [currency, setCurrency] = useState<"USD" | "KRW">("USD");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Detect current path to determine if on dark background page
  const isDarkPage = pathname === '/signin' || pathname === '/signup';

  // Load user session and profile
  useEffect(() => {
    const loadUser = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession() || { data: { session: null }, error: null };
        
        if (sessionError || !session?.user) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url, role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          // If profile doesn't exist, create it
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || 
                         session.user.email?.split('@')[0] || 
                         'User',
              role: 'customer',
            })
            .select()
            .single();

          if (newProfile) {
            setUser(newProfile);
          } else {
            setUser(null);
          }
        } else {
          setUser(profile);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    // Listen for auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    if (supabase) {
      const authStateChangeResult = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          loadUser();
        } else {
          setUser(null);
        }
      });
      subscription = authStateChangeResult?.data?.subscription || null;
    }

    // Listen for search open event
    const handleOpenSearch = () => {
      setIsSearchOpen(true);
    };
    window.addEventListener("openSearch", handleOpenSearch);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("openSearch", handleOpenSearch);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tours?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const toggleCurrency = () => {
    setCurrency(currency === "USD" ? "KRW" : "USD");
  };

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm ${
      isDarkPage 
        ? 'bg-gray-900/80 border-white/10' 
        : 'bg-white/80 border-gray-200/50'
    }`}>
      <div className="container mx-auto px-2 sm:px-3 md:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3">
          {/* Logo - Responsive sizing with text always visible */}
          <Link href="/" className="flex items-center flex-shrink-0 min-w-0 max-w-[65%] sm:max-w-none">
            <Logo className="h-10 sm:h-10 md:h-12" />
          </Link>

          {/* Desktop Navigation Menu */}
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-blue-50 text-blue-600'
                  : isDarkPage
                  ? 'text-gray-300 hover:text-blue-400 hover:bg-white/5'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Home
            </Link>
            <Link
              href="/tours"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/tours' || pathname.startsWith('/tours/')
                  ? 'bg-blue-50 text-blue-600'
                  : isDarkPage
                  ? 'text-gray-300 hover:text-blue-400 hover:bg-white/5'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Tours
            </Link>
            <Link
              href="/cart"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                pathname === '/cart'
                  ? 'bg-blue-50 text-blue-600'
                  : isDarkPage
                  ? 'text-gray-300 hover:text-blue-400 hover:bg-white/5'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Cart
            </Link>
          </nav>

          {/* Right Side - Language, Currency, Search, Sign In */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2 flex-shrink-0">
            {/* Language Switcher - Optimized for mobile */}
            <div className="flex-shrink-0">
              <LanguageSwitcher />
            </div>

            {/* Currency Toggle - Compact on mobile */}
            <button
              onClick={toggleCurrency}
              className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                isDarkPage 
                  ? 'text-gray-300 hover:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600'
              }`}
              title={currency === "USD" ? "USD" : "KRW"}
            >
              {currency === "USD" ? "USD" : "KRW"}
            </button>

            {/* Search Icon - Optimized sizing */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`p-1 sm:p-1.5 md:p-2 transition-colors flex-shrink-0 ${
                isDarkPage 
                  ? 'text-gray-300 hover:text-blue-400' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
              aria-label="Search"
            >
              <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </button>

            {/* User Menu or Sign In Button - Icon only on mobile */}
            {isLoading ? (
              <div className={`px-2 sm:px-2.5 md:px-4 py-1.5 sm:py-2 ${
                isDarkPage ? 'text-blue-300' : 'text-gray-600'
              }`}>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </div>
            ) : user ? (
              <div className="relative group">
                <Link
                  href="/mypage"
                  className={`group flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    isDarkPage 
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-400/30 hover:bg-blue-500/20 hover:border-blue-400/50' 
                      : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  title={user.full_name || 'My Account'}
                >
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name || 'User'} 
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <UserIcon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 flex-shrink-0 ${
                      isDarkPage ? 'text-blue-300' : 'text-gray-600'
                    }`} />
                  )}
                  <span className="hidden md:inline max-w-[100px] truncate">
                    {user.full_name || t('nav.mypage')}
                  </span>
                </Link>
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-2">
                    <Link
                      href="/mypage"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('nav.mypage')}
                    </Link>
                    {user.role === 'merchant' && (
                      <Link
                        href="/merchant"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Merchant Dashboard
                      </Link>
                    )}
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    <div className="border-t border-gray-200 my-1" />
                    <button
                      onClick={async () => {
                        if (supabase) {
                          await supabase.auth.signOut();
                          setUser(null);
                          router.push('/');
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('nav.signout') || 'Sign Out'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/signin"
                className={`group flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  isDarkPage 
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-400/30 hover:bg-blue-500/20 hover:border-blue-400/50' 
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm'
                }`}
                title="Sign In"
              >
                <UserIcon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 flex-shrink-0 ${
                  isDarkPage ? 'text-blue-300' : 'text-gray-600'
                }`} />
                <span className="hidden md:inline">{t('nav.signin')}</span>
              </Link>
            )}
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
                  placeholder={t('tour.search')}
                  className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm sm:text-base"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm sm:text-base"
              >
                {t('common.search')}
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="px-4 py-3 sm:py-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base"
              >
                {t('common.cancel')}
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}


