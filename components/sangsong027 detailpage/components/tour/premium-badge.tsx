import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface PremiumBadgeProps {
  children: ReactNode
  className?: string
  variant?: "default" | "highlight" | "subtle" | "accent"
  size?: "sm" | "md"
  icon?: ReactNode
}

export function PremiumBadge({ 
  children, 
  className, 
  variant = "default",
  size = "sm",
  icon 
}: PremiumBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" && "px-2.5 py-1 text-[11px] tracking-wide",
        size === "md" && "px-3 py-1.5 text-xs",
        variant === "default" && "bg-neutral-100 text-neutral-700",
        variant === "highlight" && "bg-neutral-900 text-white",
        variant === "subtle" && "bg-neutral-50 text-neutral-600 border border-neutral-200",
        variant === "accent" && "bg-amber-50 text-amber-800 border border-amber-200/60",
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}
