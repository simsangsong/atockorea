"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { TourDetailViewModel } from "@/src/types/tours"
import {
  buildFaqItemsFromTour,
  buildRouteStopsFromTour,
  formatTemplateKrwPrice,
  type TemplateFaqItem,
  type TemplateRouteStop,
} from "./template-data-from-tour"
import { TourWeatherSection } from "./TourWeatherSection"
import { useI18n, useTranslations } from "@/lib/i18n"
import { WEATHER_ANCHOR_EAST_SEONGSAN, resolveTourWeatherAnchor } from "@/lib/weather/tour-weather-anchor"
import {
  Users,
  MapPin,
  Clock,
  Route,
  CheckCircle2,
  Headphones,
  Sun,
  Cloud,
  Wind,
  Footprints,
  Umbrella,
  Baby,
  Heart,
  Camera,
  Mountain,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Mail,
  Bell,
  Navigation,
  CloudSun,
  Sparkles,
  MessageCircle,
  Car,
  Shirt,
  ArrowUpDown,
  Users2,
  UtensilsCrossed,
  Timer,
  Star,
} from "lucide-react"

const tabs = ["Overview", "Route", "Practical", "FAQ"]

/** Route before Overview so nested `sectionRefs.Route` wins while scrolling the itinerary band */
const SCROLL_TAB_ORDER = ["Route", "Overview", "Practical", "FAQ"] as const

/** Itinerary expand/collapse — smooth editorial motion */
const ITIN_EXPAND_EASE = [0.22, 1, 0.36, 1] as const

/** Drawer / overlay motion — cubic bezier as const for Framer types */
const DRAWER_EASE = [0.32, 0.72, 0, 1] as const
const OVERLAY_MS = 0.38
const SHEET_MS = 0.42

const trustFacts = [
  { icon: Car, label: "Pickup Available" },
  { icon: Headphones, label: "Pre-Trip Support" },
  { icon: CloudSun, label: "Weather-Aware Route" },
  { icon: CheckCircle2, label: "Local Expert Operated" },
]

const quickStats = [
  { icon: Footprints, label: "Walking", value: "Moderate" },
  { icon: Umbrella, label: "Rain Safety", value: "Medium" },
  { icon: Baby, label: "Family", value: "Good" },
  { icon: Heart, label: "Seniors", value: "Good" },
  { icon: Mountain, label: "Scenery", value: "High" },
  { icon: Camera, label: "Photo Value", value: "High" },
]

const whyFits = [
  {
    icon: MapPin,
    title: "Coast, Village & Landmark Rhythm",
    desc: "Beach opens, folk-village texture in the middle, then Seongsan-area drama—paced so major views aren’t rushed.",
  },
  {
    icon: Clock,
    title: "Day Flow Designed for Comfort",
    desc: "Natural pacing with strategic rest points ensures sustained energy throughout the day.",
  },
  {
    icon: Mountain,
    title: "Sea, Tradition, Coast & Stone",
    desc: "Multiple facets of Jeju in one journey—coastal beauty, village heritage, and contemplative parks.",
  },
  {
    icon: CheckCircle2,
    title: "Optimized by Experience",
    desc: "Stop order and timing refined through actual operations to maximize satisfaction.",
  },
]

/** Default East route: 돌문화공원 → 일출랜드(미천굴) → 성읍 → 점심 → 성산 → 섭지코지 */
const routeStops = [
  {
    id: 1,
    number: "01",
    title: "Jeju Stone Park",
    shortDesc: "Stone heritage, outdoor figures, and geology context before the coast.",
    badges: ["Stone culture", "Museum", "Geology"],
    image: "https://images.unsplash.com/photo-1544077960-604201fe74bc?w=800&h=500&fit=crop",
    duration: "~60–75 min",
    fullDesc:
      "Jeju Stone Park (제주돌문화공원) opens the day with how the island was formed and how stone shaped daily life—open-air stone rows, reflective water, and an underground museum for volcanic context.",
    highlights: ["Stone figures & towers", "Reflective pool", "Volcanic story", "Museum shelter in rain"],
    facilities: ["Restrooms", "Museum", "Parking"],
    tip: "Softer morning light suits photos on the stone grounds.",
    walkingLevel: "Easy to moderate — broad paths, optional extra walking",
  },
  {
    id: 2,
    number: "02",
    title: "Ilchulland (Micheongul Cave)",
    shortDesc: "Lava-tube cave at 일출랜드—cool air and basalt textures underground.",
    badges: ["Lava tube", "Weather buffer", "Moderate"],
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop",
    duration: "~55–70 min",
    fullDesc:
      "Micheongul at Ilchulland (일출랜드·미천굴) is the route’s lava-cave segment—dimmer light, cooler temperatures, and a tangible sense of Jeju’s tube geology after Stone Park’s surface story.",
    highlights: ["Basalt textures", "Cool interior", "East-side cave option", "Pairs with morning geology"],
    facilities: ["Restrooms", "Ilchulland facilities", "Parking"],
    tip: "Grip-friendly shoes help on slightly uneven cave floors.",
    walkingLevel: "Moderate — dim, cool, uneven in places",
  },
  {
    id: 3,
    number: "03",
    title: "Seongeup Folk Village",
    shortDesc: "성읍민속마을—stone walls, thatch roofs, and traditional Jeju village life.",
    badges: ["Culture", "Village", "Photo"],
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=500&fit=crop",
    duration: "~45–55 min",
    fullDesc:
      "Seongeup Folk Village preserves Jeju’s folk atmosphere—lava-stone walls, thatched homes, and storytelling that adds human texture between cave and afternoon coast.",
    highlights: ["Thatched houses", "Stone-wall lanes", "Heritage context", "Cultural photo spots"],
    facilities: ["Restrooms", "Shops", "Parking"],
    tip: "Light layers help between sun and shade in the lanes.",
    walkingLevel: "Moderate — mostly flat village paths",
  },
  {
    id: 4,
    number: "04",
    title: "Lunch",
    shortDesc: "Midday meal reset before Seongsan and exposed coastal walking.",
    badges: ["Rest break", "Indoor", "Local food"],
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=500&fit=crop",
    duration: "~55–65 min",
    fullDesc:
      "Lunch is timed after the morning’s geology-and-culture block so the group reaches Seongsan and Seopjikoji with steadier energy.",
    highlights: ["Seated break", "Local set-style meal", "Before summit/coast choices"],
    facilities: ["Restrooms", "Restaurant", "Parking"],
    tip: "Note dietary needs when booking.",
    walkingLevel: "Easy — seated dining",
  },
  {
    id: 5,
    number: "05",
    title: "Seongsan Ilchulbong",
    shortDesc: "UNESCO crater—free coastal side or paid summit stairs; route fits the day.",
    badges: ["UNESCO", "Crater", "Wind-exposed"],
    image: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=500&fit=crop",
    duration: "~70–90 min",
    fullDesc:
      "Seongsan Ilchulbong offers a free coastal approach on one side and a paid stair route to the crater rim on the other—your guide aligns the version with pace, weather, and crowds.",
    highlights: ["Crater silhouette", "Haenyeo coastal context", "Summit option", "Iconic East Jeju"],
    facilities: ["Restrooms", "Visitor center", "Parking"],
    tip: "Wind and sea conditions can change quickly—dress in layers.",
    walkingLevel: "Variable — easier coastal path vs. stair summit",
  },
  {
    id: 6,
    number: "06",
    title: "Seopjikoji",
    shortDesc: "Lighthouse ridge, red slopes, and open sea—classic East Jeju coastline.",
    badges: ["Coast", "Lighthouse", "Photo"],
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop",
    duration: "~45–60 min",
    fullDesc:
      "Seopjikoji finishes the eastern coastal arc—white lighthouse, red volcanic slope, black-rock shoreline, and long sea views along the walking ridge.",
    highlights: ["Ridge walk", "Lighthouse frame", "Drama after Seongsan", "Free entry"],
    facilities: ["Restrooms", "Small café", "Parking"],
    tip: "Step back on the path to frame lighthouse, slope, and shore together.",
    walkingLevel: "Moderate — wind-exposed, light ups and downs",
  },
]

const seasons = [
  {
    id: "spring",
    label: "Spring",
    icon: Sparkles,
    period: "Mar–May",
    desc: "Mild, pleasant conditions across most of the route.",
    points: [
      "Comfortable temperatures for outdoor exploration",
      "Moderate crowds at popular viewpoints",
      "Vibrant spring colors enhance coastal scenery",
    ],
  },
  {
    id: "summer",
    label: "Summer",
    icon: Sun,
    period: "Jun–Aug",
    desc: "Warm and vibrant with longer daylight hours.",
    points: [
      "Peak visibility for coastal views",
      "Best swimming conditions at beaches",
      "Higher humidity requires light clothing",
    ],
  },
  {
    id: "fall",
    label: "Fall",
    icon: Wind,
    period: "Sep–Nov",
    desc: "Mild temperatures with beautiful golden tones.",
    points: [
      "Mild days for longer coastal walks",
      "Fewer crowds than summer peak",
      "Stunning autumn light for photography",
    ],
  },
  {
    id: "winter",
    label: "Winter",
    icon: Cloud,
    period: "Dec–Feb",
    desc: "Cool and crisp with dramatic skies.",
    points: [
      "Quietest time at most stops",
      "Dramatic winter cloud formations",
      "Warm layers recommended",
    ],
  },
]

const practicalItems = [
  {
    icon: Car,
    title: "Pickup & Drop-off",
    content:
      "Pickup time may vary slightly by accommodation area and traffic conditions. Final timing is shared before the tour.",
  },
  {
    icon: Shirt,
    title: "What to Wear & Bring",
    content:
      "Light layers, comfortable shoes, and a windproof outer layer are recommended. Sunglasses are useful on clear days.",
  },
  {
    icon: ArrowUpDown,
    title: "Walking & Stairs",
    content:
      "The route is generally comfortable, but some coastal stops include moderate walking and mild inclines.",
  },
  {
    icon: Users2,
    title: "Families & seniors",
    content:
      "Rest breaks at major stops. When you book, mention strollers, car seats, or mobility needs so your guide can pace the day.",
  },
  {
    icon: UtensilsCrossed,
    title: "Lunch & Restrooms",
    content:
      "A lunch break is included in the route flow, and restrooms are available at major stops.",
  },
  {
    icon: Timer,
    title: "If Schedule Runs Late",
    content:
      "Minor timing adjustments may happen due to weather, traffic, or crowd flow, while preserving the core experience.",
  },
]

const faqItems = [
  { q: "Is the walking difficult?", a: "Walking is generally moderate, with some stops easier than others." },
  { q: "Can it run in rain?", a: "Yes, with weather-aware adjustments when needed." },
  { q: "Can the order change?", a: "Yes, timing or order may shift slightly depending on local conditions." },
  { q: "Is lunch included?", a: "Lunch is part of the planned route flow." },
]

const supportCards = [
  { icon: Mail, title: "Final Pickup Information", desc: "Exact pickup time and location confirmed based on your accommodation." },
  { icon: Bell, title: "12-Hour Reminder", desc: "Timely notification with essential day-of details." },
  { icon: Navigation, title: "First Stop Guidance", desc: "Clear instructions for arrival and meeting point." },
  { icon: CloudSun, title: "Weather Tips", desc: "Day-specific recommendations based on forecast." },
  { icon: Sparkles, title: "Stop Highlights", desc: "Quick tips to make the most of every location." },
  { icon: MessageCircle, title: "Live Updates", desc: "Real-time adjustments communicated if conditions change." },
]

/** Hero-adjacent line: prefer overview (formal balanced sentence); tagline-only if no overview. */
function buildPremiumSubtitleLine(
  tagline: string | null | undefined,
  overview: string | null | undefined
): string {
  const t = tagline?.trim() ?? ""
  const o = overview?.trim() ?? ""
  const fallback =
    "A balanced East Jeju course that moves naturally from Jeju's cultural texture to its most iconic eastern coastal highlights."

  if (!t && !o) return fallback
  if (o) return o.length > 300 ? `${o.slice(0, 297)}…` : o
  return t.length > 220 ? `${t.slice(0, 217)}…` : t
}

export type TourDetailTemplateViewProps = {
  /** When set (e.g. preview from DB), hero, itinerary, FAQ, price, and key copy pull from this view-model. */
  tour?: TourDetailViewModel | null
  /** When set on `/tour/[id]`, the bottom CTA links to checkout instead of being inert. */
  checkoutHref?: string | null
  /** Open-Meteo forecast point; omit to use API default (east Jeju / Seongsan reference). */
  weatherLatitude?: number
  weatherLongitude?: number
  /** Shown as “Based on {label} forecast” (e.g. `Seongsan area`). */
  weatherAreaLabel?: string
}

/**
 * V0 East Jeju small-group detail layout (visual source of truth: components/b_KrD6IiTfhFp-1774880444392).
 * Without `tour`, behavior matches the original hardcoded sandbox. With `tour`, text/media/itinerary come from the API-shaped view-model.
 */
export function TourDetailTemplateView({
  tour = null,
  checkoutHref = null,
  weatherLatitude,
  weatherLongitude,
  weatherAreaLabel,
}: TourDetailTemplateViewProps) {
  const { locale } = useI18n()
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState("Overview")
  const [selectedStop, setSelectedStop] = useState<TemplateRouteStop | null>(null)
  const [activeSeason, setActiveSeason] = useState("spring")
  const [expandedPractical, setExpandedPractical] = useState<number | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [itineraryExpanded, setItineraryExpanded] = useState(false)

  const sectionRefs = {
    Overview: useRef<HTMLDivElement>(null),
    Route: useRef<HTMLDivElement>(null),
    Practical: useRef<HTMLDivElement>(null),
    FAQ: useRef<HTMLDivElement>(null),
  }

  const scrollToSection = (tab: string) => {
    setActiveTab(tab)
    const ref = sectionRefs[tab as keyof typeof sectionRefs]
    if (ref.current) {
      const offset = 60
      const top = ref.current.offsetTop - offset
      window.scrollTo({ top, behavior: "smooth" })
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100

      for (const tab of SCROLL_TAB_ORDER) {
        const ref = sectionRefs[tab as keyof typeof sectionRefs]
        if (ref.current) {
          const { offsetTop, offsetHeight } = ref.current
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveTab(tab)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const currentSeason = seasons.find((s) => s.id === activeSeason)!

  const dbItineraryStops = useMemo(() => (tour ? buildRouteStopsFromTour(tour) : []), [tour])

  const displayRouteStops = useMemo((): TemplateRouteStop[] => {
    if (!tour) return routeStops
    return dbItineraryStops.length > 0 ? dbItineraryStops : routeStops
  }, [tour, dbItineraryStops])

  const displayFaqItems = useMemo((): TemplateFaqItem[] => {
    if (!tour) return faqItems
    return buildFaqItemsFromTour(tour, faqItems)
  }, [tour])

  const displayPracticalItems = useMemo(() => {
    if (!tour) return practicalItems
    const pickupLine = [tour.pickup?.areaLabel].filter(Boolean).join(" ").trim()
    if (!pickupLine) return practicalItems
    return practicalItems.map((item, idx) =>
      idx === 0 ? { ...item, content: pickupLine } : item
    )
  }, [tour])

  const heroImageUrl =
    tour?.images?.[0]?.url && String(tour.images[0].url).trim() !== ""
      ? String(tour.images[0].url)
      : "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&h=800&fit=crop&q=90"

  const heroImageAlt = tour?.title ? tour.title : "East Jeju coastal landscape"

  const heroTitle = tour?.title ?? "East Signature Nature Core"

  const premiumSubtitle = useMemo(
    () => buildPremiumSubtitleLine(tour?.tagline, tour?.overview),
    [tour?.tagline, tour?.overview]
  )

  /** Short route / product positioning on the image; full `premiumSubtitle` may follow in the card below. */
  const heroRouteLine = useMemo(() => {
    const tag = tour?.tagline?.trim() ?? ""
    if (tag) return tag.length > 200 ? `${tag.slice(0, 197)}…` : tag
    const body = premiumSubtitle.trim()
    if (!body) return ""
    const first = body.split(/(?<=[.!?])\s+/)[0]?.trim() ?? body
    if (first.length <= 200 && first.length < body.length) return first
    if (first.length <= 120) return first
    return `${first.slice(0, 117).trim()}…`
  }, [tour?.tagline, premiumSubtitle])

  const showOverviewCard =
    premiumSubtitle.trim().length > 0 && premiumSubtitle.trim() !== heroRouteLine.trim()

  const eyebrowGroup = (tour?.groupSize && tour.groupSize.trim()) || "Small Group"
  const eyebrowPlace = (tour?.city && tour.city.trim()) || "East Jeju"
  const eyebrowDuration = (tour?.duration && tour.duration.trim()) || "8 Hours"
  const eyebrowTheme = (tour?.highlight && tour.highlight.trim()) || "Scenic"

  const displayQuickStats = tour
    ? quickStats.map((s) =>
        s.label === "Walking" && tour.difficulty
          ? { ...s, value: tour.difficulty }
          : s
      )
    : quickStats

  const templateRating =
    tour?.rating != null && !Number.isNaN(Number(tour.rating)) ? Number(tour.rating) : null
  const templateReviewCount = tour?.reviewCount != null ? Math.max(0, tour.reviewCount) : 0
  const templateFullStars =
    templateRating != null
      ? Math.min(5, Math.floor(templateRating) + (templateRating % 1 >= 0.5 ? 1 : 0))
      : 0

  const stickyPriceLabel = tour
    ? formatTemplateKrwPrice(tour.price)
    : "$189"

  const journeyLead =
    dbItineraryStops.length > 0
      ? `${dbItineraryStops.length} stops—open a card for duration, photos, and on-site tips. Order or timing may shift for traffic, hours, or weather; your guide keeps the same planned places.`
      : "Open each card for duration, photos, and what to expect on the ground. Order or timing may shift for traffic, hours, or weather; your guide keeps the same planned places."

  const resolvedWeather = useMemo(() => {
    const lat = weatherLatitude
    const lon = weatherLongitude
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        latitude: lat,
        longitude: lon,
        areaLabel: (weatherAreaLabel ?? "").trim() || "This tour area",
      }
    }
    if (tour) {
      const a = resolveTourWeatherAnchor({ slug: tour.slug, city: tour.city })
      return {
        latitude: a.latitude,
        longitude: a.longitude,
        areaLabel: (weatherAreaLabel ?? "").trim() || a.areaLabel,
      }
    }
    return {
      latitude: WEATHER_ANCHOR_EAST_SEONGSAN.latitude,
      longitude: WEATHER_ANCHOR_EAST_SEONGSAN.longitude,
      areaLabel: (weatherAreaLabel ?? "").trim() || `${eyebrowPlace} area`,
    }
  }, [tour, weatherLatitude, weatherLongitude, weatherAreaLabel, eyebrowPlace])

  /** Korean UI: human-friendly region line for east-Jeju forecast (same coords as 성산 anchor). */
  const weatherForecastAreaLabel = useMemo(() => {
    const explicit = (weatherAreaLabel ?? "").trim()
    if (explicit) return explicit
    if (locale === "ko") {
      const { latitude, longitude } = resolvedWeather
      const nearEastSeongsan =
        Math.abs(latitude - WEATHER_ANCHOR_EAST_SEONGSAN.latitude) < 0.02 &&
        Math.abs(longitude - WEATHER_ANCHOR_EAST_SEONGSAN.longitude) < 0.02
      if (nearEastSeongsan) return "제주 동쪽 날씨"
    }
    return resolvedWeather.areaLabel
  }, [locale, weatherAreaLabel, resolvedWeather])

  return (
    <div
      className="tour-detail-template-view relative z-[2] isolate min-h-screen bg-gradient-to-b from-[#fdfdfc] via-[#f9f9f6] to-[#f5f6f4] pb-28 text-neutral-900"
      style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Sticky Tab Navigation — avoid backdrop-blur here: Win/Chrome can fail to composite page content until hover/repaint */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.02)] supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="flex items-center justify-center gap-1 px-4 py-2.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => scrollToSection(tab)}
              className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all duration-300 ease-out ${
                activeTab === tab
                  ? "bg-neutral-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50 active:scale-[0.97]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Overview Section */}
      <div ref={sectionRefs.Overview}>
        {/* Hero Image — layer 1 title + layer 2 route line; meta chips sit on bright strip below */}
        <div className="relative h-[308px] overflow-hidden group sm:h-[328px]">
          <img
            src={heroImageUrl}
            alt={heroImageAlt}
            className="w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
            style={{ filter: 'contrast(1.06) saturate(1.12) brightness(1.02)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/24 to-black/12 max-sm:from-black/82" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/14 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 z-[2] px-5 pb-8 pt-14 text-left sm:pb-6">
            <h1 className="max-w-[min(100%,22rem)] text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-white text-balance text-pretty sm:max-w-none sm:text-[29px] sm:leading-[1.12] sm:tracking-[-0.03em]">
              {heroTitle}
            </h1>
            {heroRouteLine ? (
              <p className="mt-2 max-w-[min(100%,20rem)] text-[13px] font-normal leading-snug tracking-tight text-white/80 line-clamp-2 sm:mt-3 sm:max-w-xl sm:text-[15px] sm:font-medium sm:leading-relaxed sm:text-white/88">
                {heroRouteLine}
              </p>
            ) : null}
          </div>
        </div>

        {/* Layer 3 quick facts + layer 4 rating */}
        <div className="relative z-[3] -mt-1 px-5 pb-2 max-sm:pt-0.5 sm:-mt-5">
          <div className="td-card-b td-card-b--hero-handoff mx-auto max-w-md px-3.5 pb-2.5 pt-3 backdrop-blur-[2px] supports-[backdrop-filter]:bg-white/75 sm:px-5 sm:py-3.5">
            <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200/75 bg-neutral-50/85 px-2.5 py-1 text-[10px] font-medium tracking-tight text-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:font-semibold sm:text-neutral-800 md:text-[12px]">
                <Users className="h-3 w-3 shrink-0 text-neutral-400 sm:h-3.5 sm:w-3.5 sm:text-neutral-500" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 truncate">{eyebrowGroup}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200/75 bg-neutral-50/85 px-2.5 py-1 text-[10px] font-medium tracking-tight text-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:font-semibold sm:text-neutral-800 md:text-[12px]">
                <MapPin className="h-3 w-3 shrink-0 text-neutral-400 sm:h-3.5 sm:w-3.5 sm:text-neutral-500" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 truncate">{eyebrowPlace}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200/75 bg-neutral-50/85 px-2.5 py-1 text-[10px] font-medium tracking-tight text-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:font-semibold sm:text-neutral-800 md:text-[12px]">
                <Clock className="h-3 w-3 shrink-0 text-neutral-400 sm:h-3.5 sm:w-3.5 sm:text-neutral-500" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 truncate">{eyebrowDuration}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200/75 bg-neutral-50/85 px-2.5 py-1 text-[10px] font-medium tracking-tight text-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:font-semibold sm:text-neutral-800 md:text-[12px]">
                <Route className="h-3 w-3 shrink-0 text-neutral-400 sm:h-3.5 sm:w-3.5 sm:text-neutral-500" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 truncate">{eyebrowTheme}</span>
              </span>
            </div>
            {templateRating != null ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-200/60 pt-2 text-neutral-600 sm:mt-3 sm:gap-2 sm:border-neutral-200/80 sm:pt-3 sm:text-neutral-700">
                <div className="flex items-center gap-0.5 text-amber-500/95" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i: number) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${
                        i <= templateFullStars ? "fill-amber-500 text-amber-500" : "fill-transparent text-amber-500/40"
                      }`}
                      strokeWidth={i <= templateFullStars ? 0 : 1.35}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-neutral-800 sm:text-[13px] sm:font-bold sm:text-neutral-900 md:text-sm">
                  {templateRating.toFixed(1)}
                </span>
                <span className="text-[10px] font-medium text-neutral-500 sm:text-[11px] md:text-[12px]">
                  ({templateReviewCount} {t("tour.reviews")})
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Longer overview / tagline — only when it adds detail beyond the hero route line */}
        {showOverviewCard ? (
          <div className="relative z-[3] px-5 pb-4 pt-2">
            <div className="td-card-b mx-auto max-w-md px-3.5 py-3 backdrop-blur-[3px] supports-[backdrop-filter]:bg-white/78 sm:px-4 sm:py-3.5">
              <p
                className="m-0 text-[13px] sm:text-[14px] leading-[1.55] font-normal text-neutral-950 tracking-tight antialiased"
                style={{
                  fontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
                }}
              >
                {premiumSubtitle}
              </p>
            </div>
          </div>
        ) : null}

        {/* Trust Facts */}
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {trustFacts.map((fact) => (
              <div key={fact.label} className="flex items-center gap-1.5 text-gray-500 text-[11px] tracking-[-0.005em]">
                <fact.icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                <span className="font-medium">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Itinerary — above At a Glance; prominent CTA, expands below with motion */}
        <div ref={sectionRefs.Route} className="px-5 pb-5">
          <button
            type="button"
            aria-expanded={itineraryExpanded}
            onClick={() => setItineraryExpanded((v) => !v)}
            className="group/itin relative w-full overflow-hidden rounded-2xl border-2 border-neutral-900/90 bg-gradient-to-br from-slate-50 via-white to-sky-50/90 px-4 py-4 text-left shadow-[0_2px_0_0_rgba(15,23,42,0.06),0_8px_24px_-6px_rgba(15,23,42,0.12),0_20px_48px_-12px_rgba(37,99,235,0.12)] ring-1 ring-white/80 transition-[box-shadow,transform,border-color,background-color] duration-500 ease-out hover:border-neutral-900 hover:shadow-[0_2px_0_0_rgba(15,23,42,0.08),0_12px_32px_-8px_rgba(15,23,42,0.16),0_24px_56px_-14px_rgba(37,99,235,0.18)] active:scale-[0.992] sm:px-5 sm:py-4"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 ease-out group-hover/itin:opacity-100"
              style={{
                background:
                  "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.65) 40%, rgba(224,242,254,0.35) 55%, transparent 75%)",
              }}
            />
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-sky-400/15 blur-2xl" aria-hidden />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-[0_4px_14px_rgba(15,23,42,0.25)] ring-2 ring-white/90">
                  <Route className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Schedule</p>
                  <p className="mt-1 text-[17px] font-bold leading-tight tracking-[-0.03em] text-neutral-950 sm:text-[18px]">
                    See full itinerary
                  </p>
                  <p className="mt-1 text-[12px] font-semibold tracking-[-0.01em] text-neutral-600">
                    {displayRouteStops.length} stops · tap to expand the day
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold tabular-nums text-white shadow-md ring-2 ring-white/90">
                  {displayRouteStops.length} stops
                </span>
                <motion.span
                  animate={{ rotate: itineraryExpanded ? 180 : 0 }}
                  transition={{ duration: 0.48, ease: ITIN_EXPAND_EASE }}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-900/20 bg-white text-neutral-900 shadow-[0_2px_10px_rgba(15,23,42,0.1)] transition-colors duration-300 group-hover/itin:border-neutral-900/40 group-hover/itin:bg-neutral-50"
                >
                  <ChevronDown className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </motion.span>
              </div>
            </div>
          </button>

          <motion.div
            initial={false}
            animate={itineraryExpanded ? "open" : "closed"}
            variants={{
              open: {
                height: "auto",
                opacity: 1,
                transition: {
                  height: { duration: 0.64, ease: ITIN_EXPAND_EASE },
                  opacity: { duration: 0.44, delay: 0.07, ease: ITIN_EXPAND_EASE },
                },
              },
              closed: {
                height: 0,
                opacity: 0,
                transition: {
                  opacity: { duration: 0.24, ease: ITIN_EXPAND_EASE },
                  height: { duration: 0.5, delay: 0.05, ease: ITIN_EXPAND_EASE },
                },
              },
            }}
            style={{ overflow: "hidden" }}
            className="will-change-[height,opacity]"
          >
            <div className="border-t border-neutral-100/80 pt-5">
              <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">The Route</p>
              <h2 className="text-[17px] font-semibold text-gray-900 mb-1 tracking-[-0.02em]">Your Journey</h2>
              <p className="text-[13px] text-gray-500 mb-5 leading-[1.5] tracking-[-0.005em]">{journeyLead}</p>

              <div className="space-y-0">
                {displayRouteStops.map((stop, idx) => (
                  <motion.div
                    key={stop.id}
                    initial={false}
                    animate={itineraryExpanded ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                    transition={{
                      duration: 0.4,
                      delay: itineraryExpanded ? Math.min(idx * 0.04, 0.32) : 0,
                      ease: ITIN_EXPAND_EASE,
                    }}
                    className="flex items-stretch gap-3.5"
                  >
                    <div className="flex w-[3rem] shrink-0 flex-col items-center pt-1">
                      <div className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200/95 bg-gradient-to-br from-white via-white to-stone-50/90 text-[9px] font-semibold tabular-nums tracking-[0.14em] text-stone-700 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,1)] ring-1 ring-white/80">
                        {stop.number}
                      </div>
                      {idx < displayRouteStops.length - 1 ? (
                        <div
                          className="relative mt-3 flex w-full flex-1 min-h-[1.75rem] flex-col items-center"
                          aria-hidden
                        >
                          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-2.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-200/35 via-stone-100/50 to-stone-100/25" />
                          <div className="relative z-[1] mx-auto h-full w-[2px] flex-1 min-h-[1.5rem] rounded-full bg-gradient-to-b from-stone-400/45 from-[5%] via-stone-300/28 via-[42%] to-stone-200/10 to-[98%] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pb-4">
                      <div
                        className="td-card-a overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 group"
                      >
                        <div className="px-3 pt-2.5 pb-1.5">
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
                            <img
                              src={stop.image}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[500ms] ease-out group-hover:scale-[1.03]"
                              style={{ filter: "contrast(1.03) saturate(1.08) brightness(1.01)" }}
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/8 to-transparent" />
                          </div>
                        </div>
                        <div className="px-3 pb-2.5 pt-0">
                          <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-gray-900 sm:text-[15px]">
                            {stop.title}
                          </h3>
                          <p className="mt-1 text-[13px] leading-[1.45] tracking-[-0.01em] text-gray-600 break-words">
                            {stop.shortDesc}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {stop.badges.map((badge) => (
                              <span
                                key={badge}
                                className="rounded-full border border-gray-150 bg-gray-50 px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em] text-gray-600"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedStop(stop)}
                            className="group/btn mt-2 flex items-center gap-1 text-[11px] font-semibold text-gray-800 transition-colors duration-200 hover:text-gray-600 active:scale-[0.98]"
                          >
                            View details
                            <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Overview */}
        <div className="px-5 pb-6">
          <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1 uppercase">At a Glance</p>
          <h2 className="text-[16px] font-semibold text-gray-900 mb-2.5 tracking-[-0.02em]">Quick Overview</h2>

          {/* Best For Card */}
          <div className="td-card-a mb-2 p-3.5 transition-all duration-400 ease-out hover:-translate-y-0.5">
            <div className="flex items-start gap-3.5">
              <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100/90 rounded-xl border border-gray-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <Users className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-gray-400 mb-0.5 tracking-[0.1em] uppercase">Best For</p>
                <p className="font-semibold text-gray-900 text-[14px] tracking-[-0.01em]">First-time visitors, couples, parents</p>
                <p className="text-[13px] text-gray-500 mt-1 leading-[1.5] tracking-[-0.005em]">
                  Balanced scenic sightseeing with natural day flow
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {displayQuickStats.map((stat) => (
              <div
                key={stat.label}
                className="td-card-b td-card-b--compact p-3 text-center transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <stat.icon className="w-4 h-4 text-gray-400 mx-auto mb-1.5" strokeWidth={1.75} />
                <p className="text-[8px] text-gray-400 uppercase tracking-[0.1em] font-semibold">{stat.label}</p>
                <p className="text-[13px] font-semibold text-gray-800 mt-0.5 tracking-[-0.01em]">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why This Tour Fits — above weather */}
        <div className="px-5 pb-8">
          <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">The Experience</p>
          <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Why This Tour Fits</h2>
          <div className="space-y-2.5">
            {whyFits.map((item) => (
              <div
                key={item.title}
                className="td-card-a p-4 transition-all duration-400 ease-out hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100/90 rounded-xl border border-gray-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.9)] flex-shrink-0">
                    <item.icon className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-[14px] tracking-[-0.01em]">{item.title}</h3>
                    <p className="text-[13px] text-gray-500 mt-1 leading-[1.55] tracking-[-0.005em]">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <TourWeatherSection
          areaLabel={weatherForecastAreaLabel}
          latitude={resolvedWeather.latitude}
          longitude={resolvedWeather.longitude}
        />

        {/* Seasonal Variations — after narrative; itinerary lives in collapsible above At a Glance */}
        <div className="px-5 pb-8">
          <div className="mt-2">
            <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">Adaptability</p>
            <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Seasonal Variations</h2>

            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  onClick={() => setActiveSeason(season.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-out ${
                    activeSeason === season.id
                      ? "bg-neutral-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]"
                      : "bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300/80 active:scale-[0.97]"
                  }`}
                >
                  <season.icon className="w-3.5 h-3.5" />
                  {season.label}
                </button>
              ))}
            </div>

            <div className="td-card-b p-4">
              <div className="flex items-center gap-3.5 mb-3.5">
                <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100/90 rounded-xl border border-gray-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <currentSeason.icon className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-[14px] tracking-[-0.01em]">{currentSeason.label}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 tracking-[-0.005em]">{currentSeason.period}</p>
                </div>
              </div>
              <p className="text-[13px] text-gray-500 mb-4 leading-[1.55] tracking-[-0.005em]">{currentSeason.desc}</p>
              <div className="space-y-2.5">
                {currentSeason.points.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-[13px] text-gray-600 leading-[1.5] tracking-[-0.005em]">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Practical Section */}
      <div ref={sectionRefs.Practical} className="px-5 pb-8">
        <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">Preparation</p>
        <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Practical Information</h2>

        <div className="home-neutral-editorial td-card-c overflow-hidden">
          {displayPracticalItems.map((item, idx) => (
            <div key={idx} className="border-b border-slate-200/25 last:border-b-0">
              <button
                onClick={() => setExpandedPractical(expandedPractical === idx ? null : idx)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors duration-200 hover:bg-sky-50/35 active:bg-sky-50/45"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-sky-600/75" strokeWidth={1.75} />
                  <span className="text-[13px] font-semibold text-slate-800 tracking-[-0.01em]">{item.title}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-300 ease-out ${
                    expandedPractical === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div className={`grid transition-all duration-300 ease-out ${expandedPractical === idx ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-3.5 pl-11">
                    <p className="text-[13px] text-slate-600 leading-[1.58] tracking-[-0.005em]">{item.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div ref={sectionRefs.FAQ} className="px-5 pb-8">
        <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">Questions</p>
        <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Frequently Asked</h2>

        <div className="home-neutral-editorial td-card-c overflow-hidden">
          {displayFaqItems.map((item, idx) => (
            <div key={idx} className="border-b border-slate-200/25 last:border-b-0">
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors duration-200 hover:bg-sky-50/35 active:bg-sky-50/45"
              >
                <span className="text-[13px] font-semibold text-slate-800 pr-3 tracking-[-0.01em]">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ease-out ${
                    expandedFaq === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div className={`grid transition-all duration-300 ease-out ${expandedFaq === idx ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-3.5">
                    <p className="text-[13px] text-slate-600 leading-[1.58] tracking-[-0.005em]">{item.a}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post-Booking Support */}
      <div className="px-5 pb-10">
        <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">After You Book</p>
        <h2 className="text-[17px] font-semibold text-gray-900 mb-1 tracking-[-0.02em]">Post-Booking Support</h2>
        <p className="text-[13px] text-gray-500 mb-5 leading-[1.5] tracking-[-0.005em]">
          Receive practical guidance—not just confirmation. Arrive prepared and supported.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          {supportCards.map((card) => (
            <div
              key={card.title}
              className="td-card-b td-card-b--compact p-3.5 transition-all duration-400 ease-out hover:-translate-y-0.5"
            >
              <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100/90 rounded-xl border border-gray-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.9)] w-fit mb-2.5">
                <card.icon className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              </div>
              <h3 className="font-semibold text-gray-900 text-[13px] mb-1 tracking-[-0.01em]">{card.title}</h3>
              <p className="text-[11px] text-gray-500 leading-[1.45] tracking-[-0.005em]">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer Label */}
        <div className="text-center mt-10">
          <span className="text-[9px] text-gray-300 tracking-[0.2em] font-semibold uppercase">East Signature Tours</span>
        </div>
      </div>

      {/* Sticky Bottom Booking Bar — above app BottomNav on mobile (nav is z-50, h-16) */}
      <div className="fixed bottom-16 left-0 right-0 z-[60] border-t border-gray-100 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-[0_-1px_2px_rgba(0,0,0,0.02),0_-4px_16px_rgba(0,0,0,0.04),0_-12px_40px_rgba(0,0,0,0.03)] supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:backdrop-blur-sm md:bottom-0 md:z-50 md:pb-0">
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <span className="text-[9px] text-gray-400 tracking-[0.1em] font-semibold uppercase">From</span>
            <p className="text-[24px] font-semibold text-gray-900 tracking-[-0.03em] leading-tight">{stickyPriceLabel}</p>
          </div>
          {checkoutHref ? (
            <a
              href={checkoutHref}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-7 py-3 bg-neutral-900 text-white text-[13px] font-semibold rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.15),0_6px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out hover:bg-neutral-800 hover:shadow-[0_4px_10px_rgba(0,0,0,0.18),0_10px_28px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0"
            >
              Reserve Now
            </a>
          ) : (
            <button
              type="button"
              className="px-7 py-3 bg-neutral-900 text-white text-[13px] font-semibold rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.15),0_6px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out hover:bg-neutral-800 hover:shadow-[0_4px_10px_rgba(0,0,0,0.18),0_10px_28px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0"
            >
              Reserve Now
            </button>
          )}
        </div>
      </div>

      {/* Bottom Sheet / Drawer — fade overlay + slide/fade sheet; exit animates before unmount */}
      <AnimatePresence>
        {selectedStop && (
          <>
            <motion.div
              key="stop-drawer-overlay"
              role="presentation"
              className="fixed inset-0 z-[60] bg-black/50 supports-[backdrop-filter]:backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: OVERLAY_MS, ease: DRAWER_EASE }}
              onClick={() => setSelectedStop(null)}
            />
            <motion.div
              key={`stop-drawer-sheet-${selectedStop.id}`}
              className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-[24px] max-h-[92vh] overflow-y-auto shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_-12px_48px_rgba(0,0,0,0.1)]"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: SHEET_MS, ease: DRAWER_EASE }}
            >
            <div className="sticky top-0 z-10 border-b border-gray-100/80 bg-white pt-2.5 pb-3 px-5 supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:backdrop-blur-sm">
              <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-3.5" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold tracking-[0.1em] uppercase">Stop {selectedStop.number}</p>
                  <h2 className="text-[20px] font-semibold text-gray-900 tracking-[-0.025em]">{selectedStop.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedStop(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 active:scale-[0.95]"
                >
                  <X className="w-4.5 h-4.5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-xl overflow-hidden mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
                <img
                  src={selectedStop.image}
                  alt={selectedStop.title}
                  className="w-full h-52 object-cover"
                  style={{ filter: 'contrast(1.04) saturate(1.1) brightness(1.01)' }}
                />
              </div>

              <div className="flex items-center gap-2 text-gray-500 mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[13px] font-medium tracking-[-0.01em]">{selectedStop.duration}</span>
              </div>

              <p className="text-[14px] text-gray-600 leading-[1.65] mb-6 tracking-[-0.005em]">{selectedStop.fullDesc}</p>

              <div className="mb-6">
                <h3 className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-3 uppercase">Highlights</h3>
                <div className="space-y-2.5">
                  {selectedStop.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[13px] text-gray-700 leading-[1.5] tracking-[-0.005em]">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-3 uppercase">Facilities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStop.facilities.map((facility) => (
                    <span
                      key={facility}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-150 rounded-full text-[11px] font-semibold text-gray-600 tracking-[0.01em]"
                    >
                      {facility}
                    </span>
                  ))}
                </div>
              </div>

              <div className="td-card-b td-card-b--compact mb-3 p-4">
                <h3 className="font-semibold text-gray-900 text-[13px] mb-1.5 tracking-[-0.01em]">Tip</h3>
                <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{selectedStop.tip}</p>
              </div>

              <div className="td-card-b td-card-b--compact mb-24 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Footprints className="w-3.5 h-3.5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900 text-[13px] tracking-[-0.01em]">Walking Level</h3>
                </div>
                <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{selectedStop.walkingLevel}</p>
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
