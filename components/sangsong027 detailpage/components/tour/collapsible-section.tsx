"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn("", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-4 text-left active:bg-neutral-50 transition-colors"
      >
        <span className="text-[13px] font-semibold text-neutral-900">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[1000px]" : "max-h-0"
        )}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
