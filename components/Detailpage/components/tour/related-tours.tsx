import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

const relatedTours = [
  {
    id: 1,
    title: 'West Coast Sunset Drive',
    subtitle: 'Dramatic cliffs, artisan villages, and golden hour magic',
    image: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=85',
    price: 179,
    duration: '7 hours',
    badge: 'Sunset',
  },
  {
    id: 2,
    title: 'Hidden Trails & Waterfalls',
    subtitle: 'Off-the-beaten-path adventures for active explorers',
    image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=85',
    price: 199,
    duration: '8 hours',
    badge: 'Adventure',
  },
  {
    id: 3,
    title: 'Culinary Jeju Journey',
    subtitle: "Markets, farms, and the island's finest flavors",
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=85',
    price: 219,
    duration: '6 hours',
    badge: 'Food & Culture',
  },
]

export function RelatedTours() {
  return (
    <section className="py-16 md:py-20">
      <div className="px-5 md:px-8 lg:px-10 mx-auto max-w-6xl">
        {/* Section header - editorial style */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2 font-medium">
              Continue Exploring
            </p>
            <h2 className="font-serif text-[24px] font-normal text-foreground md:text-[28px] tracking-tight">
              More from the Collection
            </h2>
          </div>
          <button className="hidden md:flex items-center gap-2 text-[13px] text-foreground/70 hover:text-foreground transition-colors group">
            <span>View all experiences</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        
        {/* Horizontal scroll on mobile, grid on larger screens */}
        <div className="flex gap-5 overflow-x-auto pb-4 -mx-5 px-5 snap-x snap-mandatory md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:gap-6">
          {relatedTours.map((tour) => (
            <article 
              key={tour.id}
              className="min-w-[300px] snap-start cursor-pointer group md:min-w-0"
            >
              {/* Image container - elegant proportions */}
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden mb-5">
                <Image
                  src={tour.image}
                  alt={tour.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Badge - refined */}
                <div className="absolute top-4 left-4">
                  <span className="inline-flex px-3 py-1.5 rounded-full bg-card/70 backdrop-blur-xl text-[10px] uppercase tracking-[0.12em] font-medium text-foreground/90 border border-white/30">
                    {tour.badge}
                  </span>
                </div>
                
                {/* Duration - bottom right */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="inline-flex px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-xl text-[11px] font-medium text-foreground border border-white/40">
                    {tour.duration}
                  </span>
                </div>
              </div>
              
              {/* Content - refined typography */}
              <div>
                <h3 className="font-serif text-lg font-normal text-foreground group-hover:text-foreground/80 transition-colors tracking-tight">
                  {tour.title}
                </h3>
                <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {tour.subtitle}
                </p>
                
                {/* Price - elegant */}
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[11px] text-muted-foreground tracking-wide">From</span>
                  <span className="text-lg font-medium text-foreground tracking-tight">${tour.price}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        
        {/* Mobile view all link */}
        <div className="mt-8 flex justify-center md:hidden">
          <button className="flex items-center gap-2 text-[13px] text-foreground/70 hover:text-foreground transition-colors group">
            <span>View all experiences</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
