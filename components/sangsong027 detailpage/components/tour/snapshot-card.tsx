import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface SnapshotCardProps {
  icon: ReactNode
  label: string
  value: string
  subValue?: string
  variant?: "default" | "highlight"
  className?: string
}

export function SnapshotCard({
  icon,
  label,
  value,
  subValue,
  variant = "default",
  className
}: SnapshotCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl",
        variant === "default" && "bg-white border border-neutral-200/60",
        variant === "highlight" && "bg-neutral-900 text-white",
        className
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
          variant === "default" && "bg-neutral-100 text-neutral-700",
          variant === "highlight" && "bg-white/10 text-white"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] uppercase tracking-wider font-medium",
            variant === "default" && "text-neutral-500",
            variant === "highlight" && "text-white/70"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-semibold truncate",
            variant === "default" && "text-neutral-900",
            variant === "highlight" && "text-white"
          )}
        >
          {value}
        </p>
        {subValue && (
          <p
            className={cn(
              "text-xs",
              variant === "default" && "text-neutral-500",
              variant === "highlight" && "text-white/60"
            )}
          >
            {subValue}
          </p>
        )}
      </div>
    </div>
  )
}
