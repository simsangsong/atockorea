import { cn } from "@/lib/utils"

interface FitIndicatorProps {
  label: string
  level: "low" | "medium" | "high"
  description?: string
  className?: string
}

export function FitIndicator({
  label,
  level,
  description,
  className
}: FitIndicatorProps) {
  const levelConfig = {
    low: { bars: 1, color: "bg-neutral-300", text: "Low" },
    medium: { bars: 2, color: "bg-neutral-400", text: "Medium" },
    high: { bars: 3, color: "bg-neutral-900", text: "Good" }
  }

  const config = levelConfig[level]

  return (
    <div className={cn("flex items-center justify-between py-3", className)}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-neutral-900">{label}</p>
        {description && (
          <p className="text-[11px] text-neutral-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex gap-0.5">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={cn(
                "h-3.5 w-1 rounded-full transition-colors",
                bar <= config.bars ? config.color : "bg-neutral-100"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
