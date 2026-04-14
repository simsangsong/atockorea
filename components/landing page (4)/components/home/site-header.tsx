'use client'

import { Search, User, Globe, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-8 max-w-7xl mx-auto w-full">
        {/* Logo & Branding - Compact on mobile */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-base md:text-lg flex-shrink-0 shadow-md shadow-primary/20">
            A
          </div>
          <div className="flex flex-col min-w-0">
            <div className="font-semibold text-foreground text-sm whitespace-nowrap">
              AtoC Korea
            </div>
            {/* Hide tagline on mobile to save space */}
            <div className="hidden sm:block text-[11px] text-muted-foreground leading-tight">
              Curated Korea, Direct
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 md:gap-3">
          {/* Region & Currency - Hidden on mobile, shown in menu */}
          <div className="hidden md:flex items-center gap-1">
            {/* Region Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 px-2">
                  <Globe className="w-3.5 h-3.5" />
                  <span>US</span>
                  <span className="text-muted-foreground text-[10px]">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem>US - English</DropdownMenuItem>
                <DropdownMenuItem>KR - 한국어</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Currency Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 px-2">
                  <span>KRW</span>
                  <span className="text-muted-foreground text-[10px]">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem>KRW - 한국 원</DropdownMenuItem>
                <DropdownMenuItem>USD - US Dollar</DropdownMenuItem>
                <DropdownMenuItem>EUR - Euro</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search - Always visible */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Search className="w-[18px] h-[18px] text-slate-600" />
          </Button>

          {/* Account - Desktop */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="w-[18px] h-[18px] text-slate-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>My Bookings</DropdownMenuItem>
                <DropdownMenuItem>Account Settings</DropdownMenuItem>
                <DropdownMenuItem>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu - Contains region, currency, account */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="w-5 h-5 text-slate-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  My Bookings
                </DropdownMenuItem>
                <DropdownMenuItem>Account Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Region & Currency</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Globe className="w-4 h-4 mr-2" />
                  US - English
                </DropdownMenuItem>
                <DropdownMenuItem>KRW - 한국 원</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground">Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
