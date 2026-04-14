"use client"

import { Home, Map, ShoppingCart, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "../../lib/utils"
import type { V0CoreStickyBarStrings } from "@/lib/tour-detail/east/adapters/to-v0-core-product-view"
import type { V0EastStickyLiveExtras } from "@/lib/tour-detail/east/adapters/v0-sticky-live-extras"

const DEFAULT_STICKY: V0CoreStickyBarStrings = {
  fromLabel: "From",
  amount: "78,300",
  currency: "KRW",
  unitSuffix: " / person",
  ctaLabel: "Book Now",
}

export function StickyBookingBar({
  sticky,
  stickyLive,
  onBookClick,
}: {
  sticky?: V0CoreStickyBarStrings | null
  stickyLive?: V0EastStickyLiveExtras | null
  onBookClick?: () => void
}) {
  const s = sticky ?? DEFAULT_STICKY
  const live = stickyLive

  const noticeClass =
    live?.noticeTone === "error"
      ? "text-destructive font-medium"
      : live?.noticeTone === "warning"
        ? "text-amber-700 font-medium"
        : live?.noticeTone === "success"
          ? "text-emerald-700 font-medium"
          : "text-muted-foreground"

  return (
    <>
      {/* Desktop Booking Bar - Premium finish */}
      <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-[60] bg-white/98 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0 pr-4">
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide">{s.fromLabel}</p>
              <p className="text-2xl font-semibold text-foreground">
                {s.amount}
                <span className="text-sm font-medium text-muted-foreground ml-0.5">{s.currency}</span>
                <span className="text-sm font-normal text-muted-foreground">{s.unitSuffix}</span>
              </p>
              {live?.totalLine ? (
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums leading-snug">{live.totalLine}</p>
              ) : null}
              {live?.noticeLine ? (
                <p className={cn("mt-1 text-xs leading-snug", noticeClass)}>{live.noticeLine}</p>
              ) : null}
            </div>
            <Button 
              size="lg" 
              type="button"
              className="bg-foreground text-white hover:bg-foreground/90 px-10 font-semibold shadow-lg hover:shadow-xl transition-all shrink-0"
              disabled={live?.ctaDisabled}
              onClick={() => onBookClick?.()}
            >
              {live?.ctaBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {s.ctaLabel}
                </span>
              ) : (
                s.ctaLabel
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Bar - Refined */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/98 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {/* Price & CTA */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide">{s.fromLabel}</p>
            <p className="text-lg font-semibold text-foreground">
              {s.amount}
              <span className="text-xs font-medium text-muted-foreground ml-0.5">{s.currency}</span>
              <span className="text-xs font-normal text-muted-foreground">{s.unitSuffix}</span>
            </p>
            {live?.totalLine ? (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums leading-snug">{live.totalLine}</p>
            ) : null}
            {live?.noticeLine ? (
              <p className={cn("mt-1 text-[11px] leading-snug", noticeClass)}>{live.noticeLine}</p>
            ) : null}
          </div>
          <Button 
            type="button"
            className="bg-foreground text-white hover:bg-foreground/90 px-6 font-semibold shadow-md shrink-0"
            disabled={live?.ctaDisabled}
            onClick={() => onBookClick?.()}
          >
            {live?.ctaBusy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {s.ctaLabel}
              </span>
            ) : (
              s.ctaLabel
            )}
          </Button>
        </div>
        
        {/* Nav Icons */}
        <div className="flex items-center justify-around py-2 bg-white/50">
          <NavItem icon={Home} label="Home" />
          <NavItem icon={Map} label="Tours" active />
          <NavItem icon={ShoppingCart} label="Cart" />
          <NavItem icon={User} label="My Page" />
        </div>
      </div>
      
      {/* Spacer */}
      <div className="h-32 sm:h-20" />
    </>
  )
}

function NavItem({ icon: Icon, label, active = false }: { icon: React.ElementType; label: string; active?: boolean }) {
  return (
    <button type="button" className="flex flex-col items-center gap-0.5 px-5 py-1.5 transition-colors">
      <Icon className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={active ? 2 : 1.5} />
      <span className={`text-[10px] ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{label}</span>
    </button>
  )
}
