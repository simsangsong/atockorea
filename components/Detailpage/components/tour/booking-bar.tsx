'use client'

import { useState } from 'react'
import { Calendar, Users, ChevronDown, Shield, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BookingBar() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      {/* Mobile sticky bar - quieter, more premium */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="bg-card/95 backdrop-blur-2xl border-t border-white/50 px-5 py-4 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.08)]">
          {/* Collapsed view */}
          <div className="flex items-center justify-between gap-5">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-muted-foreground tracking-wide">From</span>
                <span className="text-xl font-medium text-foreground tracking-tight">$189</span>
                <span className="text-[13px] text-muted-foreground">/ guest</span>
              </div>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[12px] text-foreground/60 flex items-center gap-1 mt-1 hover:text-foreground/80 transition-colors"
              >
                {isExpanded ? 'Hide details' : 'Select date'}
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <Button 
              size="lg" 
              className="px-7 rounded-xl h-11 text-[13px] font-medium tracking-wide shadow-none bg-foreground text-background hover:bg-foreground/90"
            >
              Reserve
            </Button>
          </div>
          
          {/* Expanded details - refined */}
          {isExpanded && (
            <div className="mt-5 pt-5 border-t border-border/40 space-y-3">
              <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 text-left transition-colors hover:bg-secondary/70">
                <Calendar className="h-4 w-4 text-foreground/50" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">Select Date</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Next available: Tomorrow</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 text-left transition-colors hover:bg-secondary/70">
                <Users className="h-4 w-4 text-foreground/50" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">Guests</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">2 adults</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>Free cancellation up to 48 hours before</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Desktop booking card - elegant, trustworthy */}
      <div className="hidden lg:block">
        <div className="sticky top-8">
          <div className="glass-card-elevated rounded-3xl p-7">
            {/* Price - refined typography */}
            <div className="mb-7">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-2">Price per guest</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-medium text-foreground tracking-tight">$189</span>
              </div>
            </div>
            
            {/* Date/Guest selectors - refined */}
            <div className="space-y-3 mb-6">
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 hover:border-foreground/20 transition-all duration-200 text-left bg-secondary/30 hover:bg-secondary/50">
                <Calendar className="h-4 w-4 text-foreground/50" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">Select Date</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Next available: Tomorrow</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 hover:border-foreground/20 transition-all duration-200 text-left bg-secondary/30 hover:bg-secondary/50">
                <Users className="h-4 w-4 text-foreground/50" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">Guests</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">2 adults</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Book button - premium, quiet */}
            <Button 
              size="lg" 
              className="w-full mb-6 rounded-2xl h-12 text-[13px] font-medium tracking-wide shadow-none bg-foreground text-background hover:bg-foreground/90"
            >
              Reserve This Experience
            </Button>
            
            {/* Trust points - subtle, elegant */}
            <div className="space-y-3 text-[12px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center">
                  <Check className="h-3 w-3 text-foreground/60" />
                </div>
                <span>Free cancellation up to 48 hours</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center">
                  <Check className="h-3 w-3 text-foreground/60" />
                </div>
                <span>Secure instant booking</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center">
                  <Check className="h-3 w-3 text-foreground/60" />
                </div>
                <span>128 verified guest reviews</span>
              </div>
            </div>
            
            {/* Price breakdown - elegant */}
            <div className="mt-7 pt-6 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-4">Price breakdown</p>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">$189 x 2 guests</span>
                  <span className="text-foreground">$378</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="text-foreground">$22</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border/40">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-medium text-foreground">$400</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spacer for mobile fixed bar */}
      <div className="h-24 lg:hidden" />
    </>
  )
}
