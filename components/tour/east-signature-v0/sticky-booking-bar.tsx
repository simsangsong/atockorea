"use client"

import { Home, Map, ShoppingCart, User } from "lucide-react"
import { Button } from "@/components/ui/button"

export function StickyBookingBar() {
  return (
    <>
      {/* Desktop Booking Bar - Premium finish */}
      <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide">From</p>
              <p className="text-2xl font-semibold text-foreground">
                78,300<span className="text-sm font-medium text-muted-foreground ml-0.5">KRW</span>
                <span className="text-sm font-normal text-muted-foreground"> / person</span>
              </p>
            </div>
            <Button 
              size="lg" 
              className="bg-foreground text-white hover:bg-foreground/90 px-10 font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Book Now
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Bar - Refined */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {/* Price & CTA */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide">From</p>
            <p className="text-lg font-semibold text-foreground">
              78,300<span className="text-xs font-medium text-muted-foreground ml-0.5">KRW</span>
              <span className="text-xs font-normal text-muted-foreground"> / person</span>
            </p>
          </div>
          <Button 
            className="bg-foreground text-white hover:bg-foreground/90 px-6 font-semibold shadow-md"
          >
            Book Now
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
    <button className="flex flex-col items-center gap-0.5 px-5 py-1.5 transition-colors">
      <Icon className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={active ? 2 : 1.5} />
      <span className={`text-[10px] ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{label}</span>
    </button>
  )
}
