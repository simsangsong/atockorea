"use client"

import { Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/98 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-xl px-4 sm:px-5">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-[10px] font-bold shadow-sm">
              AtoC
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">AtoC Korea</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Agency to Customer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-2 hidden sm:inline font-medium">US · KRW</span>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <User className="h-4 w-4" />
              <span className="sr-only">Account</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
