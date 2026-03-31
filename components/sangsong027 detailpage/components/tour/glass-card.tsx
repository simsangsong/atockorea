import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
  variant?: "default" | "frosted" | "solid" | "elevated"
}

export function GlassCard({ children, className, variant = "frosted" }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        variant === "frosted" && "bg-white/80 backdrop-blur-xl border border-neutral-100 shadow-sm",
        variant === "solid" && "bg-white border border-neutral-100 shadow-sm",
        variant === "elevated" && "bg-white border border-neutral-100 shadow-xl shadow-black/5",
        variant === "default" && "bg-neutral-50/80 backdrop-blur-sm border border-neutral-100",
        className
      )}
    >
      {children}
    </div>
  )
}

interface GlassCardHeaderProps {
  children: ReactNode
  className?: string
}

export function GlassCardHeader({ children, className }: GlassCardHeaderProps) {
  return (
    <div className={cn("px-5 pt-5 pb-3", className)}>
      {children}
    </div>
  )
}

interface GlassCardContentProps {
  children: ReactNode
  className?: string
}

export function GlassCardContent({ children, className }: GlassCardContentProps) {
  return (
    <div className={cn("px-5 pb-5", className)}>
      {children}
    </div>
  )
}
