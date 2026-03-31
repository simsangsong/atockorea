"use client"

import { cn } from "@/lib/utils"
import { Clock, Camera, Utensils, Compass } from "lucide-react"

interface TimelineStopProps {
  number: number
  title: string
  subtitle?: string
  duration: string
  description: string
  highlights?: string[]
  imageSrc?: string
  isLast?: boolean
  type?: "scenic" | "cultural" | "dining" | "photo"
}

export function TimelineStop({
  number,
  title,
  subtitle,
  duration,
  description,
  highlights,
  imageSrc,
  isLast = false,
  type = "scenic"
}: TimelineStopProps) {
  const typeConfig = {
    scenic: { icon: Compass, label: "Scenic" },
    cultural: { icon: Compass, label: "Cultural" },
    dining: { icon: Utensils, label: "Dining" },
    photo: { icon: Camera, label: "Photo" }
  }
  
  const Icon = typeConfig[type].icon

  return (
    <div className="flex gap-3 md:gap-4">
      {/* Timeline connector - refined */}
      <div className="flex flex-col items-center pt-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold flex-shrink-0 ring-4 ring-white">
          {number}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-gradient-to-b from-neutral-200 via-neutral-100 to-transparent min-h-[24px] mt-2" />
        )}
      </div>

      {/* Stop content - refined mobile card */}
      <div className="flex-1 pb-6">
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          {/* Compact image on mobile */}
          {imageSrc && (
            <div className="relative h-32 md:h-40 overflow-hidden">
              <img
                src={imageSrc}
                alt={title}
                className="h-full w-full object-cover"
              />
              {/* Duration badge on image */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium">
                <Clock className="h-3 w-3" />
                {duration}
              </div>
            </div>
          )}
          
          <div className="p-4">
            {/* Header */}
            <div className="mb-2">
              <h4 className="font-semibold text-neutral-900 text-[15px] tracking-tight">{title}</h4>
              {subtitle && (
                <p className="text-[13px] text-neutral-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            
            {/* Description - shorter on mobile */}
            <p className="text-[13px] text-neutral-600 leading-relaxed line-clamp-3 md:line-clamp-none">
              {description}
            </p>
            
            {/* Highlights - refined chips */}
            {highlights && highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-50">
                {highlights.slice(0, 3).map((highlight, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-50 rounded-md text-[11px] text-neutral-600 font-medium"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
