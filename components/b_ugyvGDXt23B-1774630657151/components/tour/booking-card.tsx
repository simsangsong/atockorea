"use client"

import { useState } from "react"
import { Calendar, Users, ChevronDown, Shield, Clock, X, Minus, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BookingCardProps {
  isMobile?: boolean
  isExpanded?: boolean
  onToggle?: () => void
}

export function BookingCard({ isMobile = false, isExpanded = false, onToggle }: BookingCardProps) {
  const [selectedDate, setSelectedDate] = useState("")
  const [guests, setGuests] = useState(2)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const basePrice = 260
  const totalPrice = basePrice * guests

  if (isMobile) {
    return (
      <>
        {/* Mobile Sticky Bottom Bar - Glass effect */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          {/* Glass backdrop */}
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-t border-accent/10" 
               style={{ boxShadow: '0 -4px 30px -4px rgba(0, 100, 200, 0.08)' }} />
          
          <div className="relative p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-foreground">${totalPrice}</span>
                  <span className="text-xs text-muted-foreground">total</span>
                </div>
                <button 
                  onClick={onToggle}
                  className="text-xs text-accent font-medium flex items-center gap-1 mt-0.5"
                >
                  {guests} guests
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <Button 
                onClick={onToggle}
                className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-white px-8 h-12 text-sm font-semibold rounded-xl shadow-lg shadow-accent/25"
              >
                Reserve
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Expanded Booking Sheet - Glass design */}
        {isExpanded && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onToggle}>
            <div 
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
              style={{ boxShadow: '0 -8px 40px -8px rgba(0, 100, 200, 0.15)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-foreground">Complete your booking</h3>
                <button 
                  onClick={onToggle}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <BookingForm 
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                showDatePicker={showDatePicker}
                setShowDatePicker={setShowDatePicker}
                guests={guests}
                setGuests={setGuests}
                basePrice={basePrice}
                totalPrice={totalPrice}
              />
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop sidebar card - Glass styling
  return (
    <div className="sticky top-6">
      {/* Main booking card - Glass effect */}
      <div className="rounded-2xl glass-card overflow-hidden">
        {/* Header with subtle blue gradient */}
        <div className="relative p-6 pb-5 border-b border-border/30 bg-gradient-to-br from-muted/60 via-white to-muted/40">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium">From</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-bold text-foreground tracking-tight">${basePrice}</span>
                <span className="text-sm text-muted-foreground">/ person</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-accent/15 to-accent/10 border border-accent/20">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] font-bold text-accent">Top pick</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <BookingForm 
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            guests={guests}
            setGuests={setGuests}
            basePrice={basePrice}
            totalPrice={totalPrice}
          />
        </div>
      </div>

      {/* Trust note below card */}
      <p className="text-center text-[11px] text-muted-foreground mt-4">
        No payment today. Reserve now, pay later.
      </p>
    </div>
  )
}

interface BookingFormProps {
  selectedDate: string
  setSelectedDate: (date: string) => void
  showDatePicker: boolean
  setShowDatePicker: (show: boolean) => void
  guests: number
  setGuests: (guests: number) => void
  basePrice: number
  totalPrice: number
}

function BookingForm({
  selectedDate,
  setSelectedDate,
  showDatePicker,
  setShowDatePicker,
  guests,
  setGuests,
  basePrice,
  totalPrice
}: BookingFormProps) {
  return (
    <div className="space-y-5">
      {/* Date selector - Glass input */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2">Select date</label>
        <button 
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="w-full flex items-center justify-between p-4 rounded-xl glass-card-subtle hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
              <Calendar className="w-4.5 h-4.5 text-accent" />
            </div>
            <span className={cn(
              "text-sm font-medium",
              selectedDate ? "text-foreground" : "text-muted-foreground"
            )}>
              {selectedDate || "Choose a date"}
            </span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            showDatePicker && "rotate-180"
          )} />
        </button>
        
        {showDatePicker && (
          <div className="mt-3 p-5 rounded-xl glass-card">
            <div className="text-center mb-4">
              <span className="text-sm font-bold text-foreground">April 2026</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-3">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <span key={i} className="text-[10px] text-muted-foreground font-medium py-1">{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDate(`April ${day}, 2026`)
                    setShowDatePicker(false)
                  }}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-medium transition-all",
                    day < 5 
                      ? "text-muted-foreground/30 cursor-not-allowed" 
                      : "text-foreground hover:bg-accent hover:text-white"
                  )}
                  disabled={day < 5}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Guest selector - Glass stepper */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2">Guests</label>
        <div className="flex items-center justify-between p-4 rounded-xl glass-card-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
              <Users className="w-4.5 h-4.5 text-accent" />
            </div>
            <span className="text-sm font-medium text-foreground">{guests} {guests === 1 ? "guest" : "guests"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setGuests(Math.max(1, guests - 1))}
              className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-muted hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={guests <= 1}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGuests(Math.min(8, guests + 1))}
              className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-muted hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={guests >= 8}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="pt-5 border-t border-border/40 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">${basePrice} x {guests} guests</span>
          <span className="text-foreground font-medium">${totalPrice}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">${totalPrice}</span>
        </div>
      </div>

      {/* Primary CTA - Gradient accent */}
      <Button className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-white h-13 text-sm font-semibold rounded-xl shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/25 transition-all">
        Reserve Now
      </Button>

      {/* Secondary CTA - Glass */}
      <Button 
        variant="outline" 
        className="w-full h-12 text-sm font-medium rounded-xl glass-card-subtle border-0 hover:shadow-md"
      >
        Ask a Question
      </Button>

      {/* Trust indicators */}
      <div className="flex flex-col gap-2.5 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
            <Clock className="w-3 h-3 text-accent" />
          </div>
          <span>Free cancellation up to 24 hours before</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
            <Shield className="w-3 h-3 text-accent" />
          </div>
          <span>Secure checkout with instant confirmation</span>
        </div>
      </div>
    </div>
  )
}
