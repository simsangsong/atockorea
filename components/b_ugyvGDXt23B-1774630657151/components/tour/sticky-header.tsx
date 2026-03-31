"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Heart, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function StickyHeader() {
  const [isVisible, setIsVisible] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show header after scrolling past hero (roughly 320px on mobile)
      setIsVisible(window.scrollY > 280)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 -translate-y-full pointer-events-none"
      )}
    >
      {/* Glass background with blue tint */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-xl border-b border-accent/10"
           style={{ boxShadow: '0 4px 20px -4px rgba(0, 100, 200, 0.06)' }} />
      
      <div className="relative flex items-center justify-between h-14 px-4">
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors -ml-1">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <div className="flex-1 text-center px-3">
          <h1 className="text-sm font-semibold text-foreground truncate">
            부산 프라이빗 투어
          </h1>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
          >
            <Heart className={cn("w-5 h-5", isLiked ? "fill-rose-500 text-rose-500" : "text-foreground")} />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  )
}
