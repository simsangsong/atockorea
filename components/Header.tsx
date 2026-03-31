"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Logo from "./Logo";
import { SearchIcon, UserIcon } from "./Icons";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "@/lib/i18n";
import { useCurrency, CURRENCY_LIST, type CurrencyCode } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export type HeaderProps = {
  /** Join-tour premium detail: calmer bar aligned with `.tour-detail-premium` / hero tone. */
  premiumTourDetail?: boolean;
};

export default function Header({ premiumTourDetail = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const { currency, setCurrency } = useCurrency();
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setIsCurrencyOpen(false);
      }
    };
    if (isCurrencyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isCurrencyOpen]);

  const currencyLabel = CURRENCY_LIST.find((c) => c.code === currency)?.code ?? currency;
  const pt = premiumTourDetail && !isDarkPage;

  return (
    <header
      data-header-variant={pt ? "premium-tour" : undefined}
      className={cn(
        "sticky top-0 z-50",
        isDarkPage
          ? "border-b border-white/10 bg-gray-900/80 backdrop-blur-md shadow-sm"
          : pt
            ? "border-b border-stone-900/[0.06] bg-[#fdfdfc]/[0.82] backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_10px_40px_-24px_rgba(15,23,42,0.07)]"
            : "border-b border-gray-200/50 bg-white/80 shadow-sm backdrop-blur-md"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full min-w-0",
          pt ? "max-w-[1400px] px-5 md:px-8 lg:px-10" : "container mx-auto px-2 sm:px-3 md:px-4 lg:px-8"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-1 sm:gap-1.5 md:gap-2 lg:gap-3",
            pt ? "h-[3.25rem] sm:h-14 md:h-[3.75rem]" : "h-14 md:h-16"
          )}
        >
          {/* Logo - Responsive sizing with text always visible */}
          <Link href="/" className="flex items-center flex-shrink-0 min-w-0 max-w-[65%] sm:max-w-none">
            <Logo className={cn(pt ? "h-9 sm:h-10 md:h-11" : "h-10 sm:h-10 md:h-12")} />
          </Link>

          {/* Desktop Navigation Menu */}
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            <Link
              href="/"
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                pathname === "/"
                  ? pt
                    ? "bg-stone-200/35 text-stone-900"
                    : "bg-blue-50 text-blue-600"
                  : isDarkPage
                    ? "text-gray-300 hover:bg-white/5 hover:text-blue-400"
                    : pt
                      ? "text-stone-600 hover:bg-stone-100/55 hover:text-stone-900"
                      : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              )}
            >
              Home
            </Link>
            <Link
              href="/tours"
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                pathname === "/tours" || pathname.startsWith("/tours/")
                  ? pt
                    ? "bg-stone-200/35 text-stone-900"
                    : "bg-blue-50 text-blue-600"
                  : isDarkPage
                    ? "text-gray-300 hover:bg-white/5 hover:text-blue-400"
                    : pt
                      ? "text-stone-600 hover:bg-stone-100/55 hover:text-stone-900"
                      : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              )}
            >
              Tours
            </Link>
            <Link
              href="/cart"
              className={cn(
                "relative rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                pathname === "/cart"
                  ? pt
                    ? "bg-stone-200/35 text-stone-900"
                    : "bg-blue-50 text-blue-600"
                  : isDarkPage
                    ? "text-gray-300 hover:bg-white/5 hover:text-blue-400"
                    : pt
                      ? "text-stone-600 hover:bg-stone-100/55 hover:text-stone-900"
                      : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              )}
            >
              Cart
            </Link>
          </nav>

          {/* Right Side - Language, Currency, Search, Sign In */}
          <div
            className={cn(
              "flex flex-shrink-0 items-center",
              pt ? "gap-1 sm:gap-1.5 md:gap-2" : "gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2"
            )}
          >
            {/* Language Switcher - Optimized for mobile */}
            <div className="flex-shrink-0">
              <LanguageSwitcher premiumTourDetail={pt} />
            </div>

            {/* Currency selector - world major currencies */}
            <div className="relative flex-shrink-0" ref={currencyDropdownRef}>
              <button
                onClick={() => setIsCurrencyOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-0.5 whitespace-nowrap font-medium transition-colors",
                  pt
                    ? "rounded-[10px] px-2 py-1.5 text-[10px] text-stone-600 sm:text-[11px] md:px-2.5 md:text-xs hover:bg-stone-100/70 hover:text-stone-900"
                    : "px-1 py-1 text-[9px] sm:px-1.5 sm:py-1.5 sm:text-[10px] md:px-2 md:text-xs lg:px-3 lg:text-sm",
                  !pt &&
                    (isDarkPage
                      ? "text-gray-300 hover:text-blue-400"
                      : "text-gray-700 hover:text-blue-600")
                )}
                title={currencyLabel}
                aria-expanded={isCurrencyOpen}
                aria-haspopup="listbox"
              >
                {currencyLabel}
                <svg
                  className={cn("h-3 w-3 opacity-70", pt && "text-stone-500")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCurrencyOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
              </button>
              {isCurrencyOpen && (
                <div
                  className="absolute right-0 top-full mt-1 py-1 w-44 max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-[100]"
                  role="listbox"
                >
                  {CURRENCY_LIST.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={currency === c.code}
                      onClick={() => {
                        setCurrency(c.code as CurrencyCode);
                        setIsCurrencyOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 ${
                        currency === c.code
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{c.code}</span>
                      <span className="text-gray-500 text-xs">{c.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Icon - Optimized sizing */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={cn(
                "flex-shrink-0 transition-colors",
                pt
                  ? "rounded-[10px] p-2 text-stone-500 hover:bg-stone-100/80 hover:text-stone-800"
                  : "p-1 sm:p-1.5 md:p-2",
                !pt &&
                  (isDarkPage
                    ? "text-gray-300 hover:text-blue-400"
                    : "text-gray-600 hover:text-blue-600")
              )}
              aria-label="Search"
            >
              <SearchIcon
                className={cn(pt ? "h-[18px] w-[18px] sm:h-4 sm:w-4 md:h-[1.15rem] md:w-[1.15rem]" : "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5")}
              />
            </button>

            {/* User Menu or Sign In Button - Icon only on mobile */}
            {isLoading ? (
              <div
                className={cn(
                  "px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4",
                  isDarkPage ? "text-blue-300" : pt ? "text-stone-500" : "text-gray-600"
                )}
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            ) : user ? (
              <div className="relative group">
                <Link
                  href="/mypage"
                  className={cn(
                    "group flex flex-shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] px-2 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:py-2 sm:text-sm md:gap-2 md:px-4",
                    isDarkPage
                      ? "border border-blue-400/30 bg-blue-500/10 text-blue-300 hover:border-blue-400/50 hover:bg-blue-500/20"
                      : pt
                        ? "border border-stone-200/80 bg-white/55 text-stone-700 hover:border-stone-300/90 hover:bg-white/90"
                        : "border border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 hover:shadow-sm"
                  )}
                  title={user.full_name || 'My Account'}
                >
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name || 'User'} 
                      className="h-4 w-4 flex-shrink-0 rounded-full object-cover sm:h-5 sm:w-5"
                    />
                  ) : (
                    <UserIcon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5",
                        isDarkPage ? "text-blue-300" : pt ? "text-stone-600" : "text-gray-600 group-hover:scale-110"
                      )}
                    />
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
                className={cn(
                  "group flex flex-shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] px-2 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:py-2 sm:text-sm md:gap-2 md:px-4",
                  isDarkPage
                    ? "border border-blue-400/30 bg-blue-500/10 text-blue-300 hover:border-blue-400/50 hover:bg-blue-500/20"
                    : pt
                      ? "border border-stone-200/80 bg-white/55 text-stone-700 hover:border-stone-300/90 hover:bg-white/90"
                      : "border border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 hover:shadow-sm"
                )}
                title="Sign In"
              >
                <UserIcon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5",
                    isDarkPage ? "text-blue-300" : pt ? "text-stone-600" : "text-gray-600 group-hover:scale-110"
                  )}
                />
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


