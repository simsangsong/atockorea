'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Clock, Footprints, Camera, CloudSun, ChevronDown, Bath, Timer, Sparkles } from 'lucide-react'

const stops = [
  {
    id: 1,
    name: 'Hamdeok Beach',
    time: '09:00',
    duration: '45-60 min',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=85',
    description: 'Start your day with the crystal-clear turquoise waters of Hamdeok. A gentle beach walk sets the pace for the day ahead.',
    highlight: 'Morning Light',
    order: 'First Stop',
    why: 'Morning light creates the most vibrant turquoise colors. Crowds are minimal before 10am.',
    walkingEffort: 'Easy flat sand and paved paths',
    restroom: 'Clean public facilities at beach entrance',
    photoTip: 'Walk to the far end for unobstructed water views with Sanbangsan in the background.',
    weatherNote: 'Can be windy. A light layer helps.',
    canShorten: true,
    shortenNote: 'Can reduce to 30 min if needed'
  },
  {
    id: 2,
    name: 'Seongeup Folk Village',
    time: '10:30',
    duration: '50-70 min',
    image: 'https://images.unsplash.com/photo-1587411768515-eeac0647deed?w=800&q=85',
    description: 'Step into traditional Jeju life with thatched-roof houses and ancient lava stone walls. Meet local guides who share stories passed down through generations.',
    highlight: 'Cultural Immersion',
    order: 'Second Stop',
    why: 'Mid-morning timing avoids tour bus crowds. Enough time to appreciate culture without rushing.',
    walkingEffort: 'Easy gravel paths, mostly flat',
    restroom: 'Available at village entrance and exit',
    photoTip: 'Stone walls with sunlight filtering through trees create beautiful textures.',
    weatherNote: 'Shaded areas available. Light rain adds atmosphere.',
    canShorten: true,
    shortenNote: 'Can focus on main houses only'
  },
  {
    id: 3,
    name: 'Local Lunch',
    time: '12:30',
    duration: '60 min',
    image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&q=85',
    description: 'Savor authentic Jeju cuisine at a curated local restaurant. Experience the island\'s unique flavors with seasonal ingredients.',
    highlight: 'Culinary Experience',
    order: 'Midday Rest',
    why: 'Placed after cultural exploration to provide natural energy reset before afternoon scenic stops.',
    walkingEffort: 'None - seated dining',
    restroom: 'Restaurant facilities available',
    photoTip: 'Capture the colorful banchan spread before eating.',
    weatherNote: 'Indoor dining regardless of weather.',
    canShorten: false,
    shortenNote: ''
  },
  {
    id: 4,
    name: 'Seopjikoji',
    time: '14:00',
    duration: '60-75 min',
    image: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=85',
    description: 'Walk along dramatic coastal cliffs with panoramic ocean views. The iconic lighthouse and volcanic terrain create unforgettable photo opportunities.',
    highlight: 'Coastal Drama',
    order: 'Fourth Stop',
    why: 'Afternoon light sculpts the cliffs beautifully. Post-lunch timing ensures comfortable energy for the walk.',
    walkingEffort: 'Moderate - gentle uphill path, some uneven ground',
    restroom: 'Facilities at parking area and near lighthouse',
    photoTip: 'The lighthouse with ocean backdrop works best from the eastern path.',
    weatherNote: 'Exposed to wind. Hat may blow away.',
    canShorten: true,
    shortenNote: 'Can skip lighthouse trail if time is tight'
  },
  {
    id: 5,
    name: 'Seongsan Viewpoint',
    time: '16:00',
    duration: '45-60 min',
    image: 'https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=800&q=85',
    description: 'Marvel at the UNESCO World Heritage sunrise peak. Enjoy panoramic views of the volcanic crater and surrounding coastline.',
    highlight: 'UNESCO Heritage',
    order: 'Fifth Stop',
    why: 'Late afternoon light softens the volcanic crater. We visit the viewpoint, not the strenuous crater climb.',
    walkingEffort: 'Easy - paved viewpoint area only',
    restroom: 'Modern facilities at visitor center',
    photoTip: 'Wide angle captures the full crater. Try portrait mode for the peak silhouette.',
    weatherNote: 'Clear days offer views of Udo Island across the water.',
    canShorten: true,
    shortenNote: 'Quick photo stop possible in 20 min'
  },
  {
    id: 6,
    name: 'Jeju Stone Park',
    time: '17:30',
    duration: '45-60 min',
    image: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?w=800&q=85',
    description: 'End your journey in this peaceful sculpture garden. A calm, contemplative finish featuring Jeju\'s iconic stone figures.',
    highlight: 'Peaceful Finale',
    order: 'Final Stop',
    why: 'Intentionally calm to wind down the day. Late light creates beautiful shadows on stone sculptures.',
    walkingEffort: 'Easy - smooth garden paths',
    restroom: 'Clean facilities at entrance',
    photoTip: 'Golden hour light on stone dol hareubang statues creates memorable shots.',
    weatherNote: 'Mostly shaded. Comfortable even on warm days.',
    canShorten: true,
    shortenNote: 'Can adjust based on return timing'
  },
]

function StopDetail({ icon: Icon, label, value }: { icon: typeof Clock, label: string, value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 mb-0.5">{label}</p>
        <p className="text-[12px] text-foreground/80 leading-relaxed">{value}</p>
      </div>
    </div>
  )
}

export function RouteTimeline() {
  const [expandedStop, setExpandedStop] = useState<number | null>(null)

  return (
    <section className="px-5 py-14 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Your Day, Stop by Stop
        </h2>
        <p className="text-[13px] text-muted-foreground mb-3 tracking-wide">
          A carefully curated sequence designed for optimal light and experience
        </p>
        <p className="text-[11px] text-muted-foreground/60 mb-10">
          Tap any stop to see practical details
        </p>
        
        <div className="space-y-5">
          {stops.map((stop, index) => {
            const isExpanded = expandedStop === stop.id
            return (
              <article 
                key={stop.id}
                className="group"
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  className="w-full text-left glass-card rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.1)] cursor-pointer border-0 p-0 bg-transparent"
                  onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
                >
                  <div className="flex flex-col">
                    {/* Image */}
                    <div className="relative h-48 sm:h-52 lg:h-56 overflow-hidden">
                      <Image
                        src={stop.image}
                        alt={stop.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />
                      
                      {/* Time badge */}
                      <div className="absolute bottom-4 left-5">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-xl text-[11px] font-medium text-foreground border border-white/40">
                          <Clock className="h-3 w-3" />
                          {stop.time}
                        </span>
                      </div>
                      
                      {/* Order indicator */}
                      <div className="absolute top-4 right-5">
                        <span className="text-[11px] uppercase tracking-[0.15em] text-white/90 font-medium">
                          {stop.order}
                        </span>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-5 lg:p-6">
                      <div className="flex items-start justify-between gap-4 mb-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-medium mb-1">
                            {stop.highlight}
                          </p>
                          <h3 className="font-serif text-lg font-normal text-foreground tracking-tight lg:text-xl">
                            {stop.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                            {stop.duration}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {stop.description}
                      </p>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-5 pt-5 border-t border-border/40 animate-in slide-in-from-top-2 fade-in duration-200">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-primary/80 font-medium mb-4">
                            Practical Details
                          </p>
                          
                          <div className="grid gap-4 sm:grid-cols-2">
                            <StopDetail icon={Sparkles} label="Why This Stop" value={stop.why} />
                            <StopDetail icon={Footprints} label="Walking Effort" value={stop.walkingEffort} />
                            <StopDetail icon={Bath} label="Restroom" value={stop.restroom} />
                            <StopDetail icon={Camera} label="Photo Tip" value={stop.photoTip} />
                            <StopDetail icon={CloudSun} label="Weather Note" value={stop.weatherNote} />
                            {stop.canShorten && (
                              <StopDetail icon={Timer} label="Flexibility" value={stop.shortenNote} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                
                {/* Connector line */}
                {index < stops.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="w-px h-5 bg-border/50" />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
