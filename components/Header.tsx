"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { SearchIcon, MapIcon } from "./Icons";

// Sample tours data (should be fetched from API in production)
const allTours = [
  {
    id: 1,
    title: "Gamcheon Culture Village + Haeundae",
    location: "Busan",
    type: "Small-group",
    duration: "Full day",
    price: 79,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Popular",
  },
  {
    id: 2,
    title: "East Jeju UNESCO Highlights",
    location: "Jeju",
    type: "Private van",
    duration: "Full day",
    price: 290,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Private",
  },
  {
    id: 3,
    title: "Gwangalli Night View & Local Food",
    location: "Busan",
    type: "Foodie style",
    duration: "3-4 hours",
    price: 65,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Night Tour",
  },
  {
    id: 4,
    title: "Seoul Palace & Market Tour",
    location: "Seoul",
    type: "Small-group",
    duration: "Half day",
    price: 69,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80",
    badge: "Cultural",
  },
  {
    id: 5,
    title: "Jeju Island Nature Adventure",
    location: "Jeju",
    type: "Private",
    duration: "Full day",
    price: 320,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Adventure",
  },
  {
    id: 6,
    title: "Busan Coastal Scenic Drive",
    location: "Busan",
    type: "Private car",
    duration: "Half day",
    price: 180,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Scenic",
  },
];

export default function Header() {
  const [language, setLanguage] = useState<"EN" | "中文">("EN");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Advanced fuzzy search algorithm
  const fuzzySearch = (query: string, text: string): number => {
    if (!query) return 0;
    
    const queryLower = query.toLowerCase().trim();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === queryLower) return 100;
    if (textLower.startsWith(queryLower)) return 90;
    if (textLower.includes(queryLower)) return 80;
    
    // Fuzzy matching - check if all characters exist in order
    let queryIndex = 0;
    let score = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        score += 10;
        queryIndex++;
      }
    }
    
    if (queryIndex === queryLower.length) {
      return 50 + score;
    }
    
    // Partial word matching
    const words = textLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    let wordMatchScore = 0;
    
    queryWords.forEach((qWord) => {
      words.forEach((word) => {
        if (word.startsWith(qWord)) wordMatchScore += 20;
        else if (word.includes(qWord)) wordMatchScore += 10;
      });
    });
    
    return wordMatchScore;
  };

  // Search function
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = allTours
      .map((tour) => {
        const titleScore = fuzzySearch(query, tour.title);
        const locationScore = fuzzySearch(query, tour.location) * 0.8;
        const typeScore = fuzzySearch(query, tour.type) * 0.6;
        const badgeScore = tour.badge ? fuzzySearch(query, tour.badge) * 0.5 : 0;
        
        const totalScore = titleScore + locationScore + typeScore + badgeScore;
        
        return {
          ...tour,
          score: totalScore,
        };
      })
      .filter((tour) => tour.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // Limit to 6 results

    setSearchResults(results);
  };

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-gray-900 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Listen for openSearch event from HeroSection
  useEffect(() => {
    const handleOpenSearch = () => {
      setIsSearchOpen(true);
    };

    window.addEventListener('openSearch', handleOpenSearch);
    return () => {
      window.removeEventListener('openSearch', handleOpenSearch);
    };
  }, []);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-white/40 shadow-lg">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Logo />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === "EN" ? "中文" : "EN")}
              className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md"
              aria-label="Change language"
            >
              EN / 中文
            </button>

            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 sm:p-2 text-gray-700 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md"
              aria-label="Search"
            >
              <SearchIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Sign In Button */}
            <Link
              href="/signin"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          </div>
        </div>

        {/* Search Bar with Results (when open) */}
        {isSearchOpen && (
          <div ref={searchRef} className="pb-4">
            <div className="relative mb-4">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Find My Day Tour - Search destinations, tours, activities..."
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none shadow-md text-base"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-h-[500px] overflow-y-auto">
                {searchResults.length > 0 ? (
                  <>
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                      <p className="text-sm text-gray-600">
                        Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                      </p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {searchResults.map((tour) => (
                        <a
                          key={tour.id}
                          href={`/tour/${tour.id}`}
                          className="block p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex gap-4">
                            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                              <img
                                src={tour.image}
                                alt={tour.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <h3 className="font-semibold text-gray-900 text-base line-clamp-1">
                                  {highlightText(tour.title, searchQuery)}
                                </h3>
                                {tour.badge && (
                                  <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                                    {tour.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                                <MapIcon className="w-4 h-4" />
                                {highlightText(tour.location, searchQuery)}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>{tour.type}</span>
                                  <span>•</span>
                                  <span>{tour.duration}</span>
                                </div>
                                <span className="text-base font-bold text-indigo-600">
                                  from ${tour.price}/{tour.priceType}
                                </span>
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                        <a
                          href={`/tours?q=${encodeURIComponent(searchQuery)}`}
                          className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
                        >
                          View All {searchResults.length} Results →
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-12 text-center">
                    <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No tours found</h3>
                    <p className="text-sm text-gray-500">Try different keywords</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

