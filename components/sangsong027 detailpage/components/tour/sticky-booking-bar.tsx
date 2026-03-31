"use client"

import { Button } from "@/components/ui/button"
import { Calendar, Users, ChevronRight, Shield } from "lucide-react"

interface StickyBookingBarProps {
  price: string
  priceNote: string
}

export function StickyBookingBar({ price, priceNote }: StickyBookingBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Subtle gradient fade for elegance */}
      <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      
      <div className="bg-white border-t border-neutral-100 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-neutral-900 tracking-tight">{price}</span>
              <span className="text-[13px] text-neutral-500">{priceNote}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield className="h-3 w-3 text-neutral-400" />
              <span className="text-[11px] text-neutral-400">Free cancellation 48h</span>
            </div>
          </div>
          <Button 
            className="h-12 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-[15px] gap-1.5 shadow-lg shadow-neutral-900/20 active:scale-[0.98] transition-transform"
          >
            Check dates
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DesktopBookingCard({ price, priceNote }: StickyBookingBarProps) {
  return (
    <div className="hidden lg:block sticky top-8">
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-2xl shadow-black/5 p-7">
        {/* Price */}
        <div className="mb-7">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-neutral-900 tracking-tight">{price}</span>
            <span className="text-sm text-neutral-500">{priceNote}</span>
          </div>
        </div>

        {/* Booking inputs */}
        <div className="space-y-3 mb-6">
          <button className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all text-left group">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200/70 transition-colors">
                <Calendar className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Date</p>
                <p className="text-sm font-medium text-neutral-900">Select date</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          </button>

          <button className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all text-left group">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200/70 transition-colors">
                <Users className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Guests</p>
                <p className="text-sm font-medium text-neutral-900">Add guests</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          </button>
        </div>

        {/* CTA */}
        <Button className="w-full h-14 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-base shadow-lg shadow-neutral-900/20">
          Check Availability
        </Button>

        {/* Trust indicators */}
        <div className="mt-5 pt-5 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">Free cancellation</span>
            <span className="text-neutral-900 font-medium">48h before</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">Instant confirmation</span>
            <span className="text-neutral-900 font-medium">Via email</span>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-5 pt-5 border-t border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full bg-neutral-200 border-2 border-white"
                />
              ))}
            </div>
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">127</span> booked this week
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
