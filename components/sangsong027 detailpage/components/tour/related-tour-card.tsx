import { Clock, MapPin } from "lucide-react"

interface RelatedTourCardProps {
  title: string
  subtitle: string
  imageSrc: string
  duration: string
  stops: number
  badge?: string
  price?: string
}

export function RelatedTourCard({
  title,
  subtitle,
  imageSrc,
  duration,
  stops,
  badge,
  price
}: RelatedTourCardProps) {
  return (
    <div className="w-[260px] lg:w-full flex-shrink-0 bg-white rounded-2xl border border-neutral-100 overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-black/5 transition-all active:scale-[0.98]">
      {/* Image */}
      <div className="relative h-[140px] lg:h-[160px] overflow-hidden">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
        />
        {badge && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full text-[11px] font-medium text-neutral-800 shadow-sm">
              {badge}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h4 className="font-semibold text-neutral-900 text-[15px] mb-1 line-clamp-1 tracking-tight">
          {title}
        </h4>
        <p className="text-[12px] text-neutral-500 mb-3 line-clamp-2 leading-relaxed">
          {subtitle}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-neutral-400 text-[12px]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {duration}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {stops}
            </span>
          </div>
          {price && (
            <span className="text-[14px] font-semibold text-neutral-900">
              {price}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
