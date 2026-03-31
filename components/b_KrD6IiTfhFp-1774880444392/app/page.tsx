"use client"

import { useState, useRef, useEffect } from "react"
import {
  Users,
  MapPin,
  Clock,
  Route,
  CheckCircle2,
  Headphones,
  Sun,
  Cloud,
  CloudRain,
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
} from "lucide-react"

const tabs = ["Overview", "Route", "Practical", "FAQ"]

const badges = ["First-Time Friendly", "Scenic East Jeju", "Nature Core", "Small Group"]

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
    icon: Users,
    title: "Balanced for First-Time Visitors",
    desc: "A carefully curated route that introduces the essential character of East Jeju without overwhelming first-time guests.",
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

const routeStops = [
  {
    id: 1,
    number: "01",
    title: "Hamdeok Beach",
    shortDesc:
      "Start the day with East Jeju's bright sea colors and open shoreline. The turquoise waters and white sand create an ideal first impression of the island's natural beauty.",
    badges: ["Low Walking", "Photo Spot", "Scenic Highlight"],
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop",
    duration: "40 min at this stop",
    fullDesc:
      "Hamdeok Beach is known for its bright turquoise water, open shoreline, and soft white sand. It creates an easy and memorable first impression of East Jeju.",
    highlights: [
      "Wide open beach scenery",
      "Turquoise water and white sand",
      "Great first-stop energy",
      "Comfortable seaside stroll",
    ],
    facilities: ["Restrooms", "Café", "Parking"],
    tip: "Best enjoyed in the morning light when the sea color is especially clear.",
    walkingLevel: "Easy — flat beachfront access",
  },
  {
    id: 2,
    number: "02",
    title: "Seongeup Folk Village",
    shortDesc:
      "Experience Jeju's old village atmosphere and traditional character. Stone walls, thatched roofs, and centuries of history preserved in an authentic setting.",
    badges: ["Moderate Walking", "Cultural Stop", "Restroom"],
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=500&fit=crop",
    duration: "45 min at this stop",
    fullDesc:
      "Seongeup Folk Village preserves Jeju's historic village atmosphere through stone walls, thatched homes, and a more traditional rhythm of place.",
    highlights: [
      "Traditional Jeju stone-wall village",
      "Thatched-roof homes",
      "Historic atmosphere",
      "Cultural storytelling value",
    ],
    facilities: ["Restrooms", "Shops", "Parking"],
    tip: "A good stop to understand Jeju beyond scenery and beaches.",
    walkingLevel: "Moderate — mostly flat paths with light walking",
  },
  {
    id: 3,
    number: "03",
    title: "Lunch",
    shortDesc: "A midday reset before the key scenic highlights of the afternoon. Local cuisine in a comfortable setting.",
    badges: ["Restroom", "Rest Break"],
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=500&fit=crop",
    duration: "60 min at this stop",
    fullDesc:
      "A well-timed midday break that helps reset the day before continuing into the major scenic afternoon stops.",
    highlights: ["Comfortable meal break", "Balanced day pacing", "Rest before afternoon highlights"],
    facilities: ["Restrooms", "Restaurant", "Parking"],
    tip: "Lunch timing may vary slightly depending on flow and local conditions.",
    walkingLevel: "Easy — seated rest stop",
  },
  {
    id: 4,
    number: "04",
    title: "Seongsan Ilchulbong",
    shortDesc:
      "The iconic sunrise peak of Jeju. A volcanic crater rising from the sea, offering one of the island's most dramatic landscapes.",
    badges: ["Moderate Walking", "UNESCO Site", "Photo Spot"],
    image: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=500&fit=crop",
    duration: "50 min at this stop",
    fullDesc:
      "Seongsan Ilchulbong is one of Jeju's most recognizable landmarks, where volcanic geology and ocean views come together in a dramatic setting.",
    highlights: [
      "UNESCO World Heritage landmark",
      "Volcanic crater rising from the sea",
      "Iconic East Jeju scenery",
      "Strong photo value",
    ],
    facilities: ["Restrooms", "Café", "Parking"],
    tip: "Visibility and wind conditions can shape the experience, so timing matters.",
    walkingLevel: "Moderate — paved paths with some incline",
  },
  {
    id: 5,
    number: "05",
    title: "Seopjikoji",
    shortDesc:
      "Dramatic coastal cliffs with wide ocean views. A quieter, contemplative stop with some of Jeju's most beautiful volcanic coastline.",
    badges: ["Moderate Walking", "Scenic Highlight", "Photo Spot"],
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop",
    duration: "40 min at this stop",
    fullDesc:
      "Seopjikoji is a peaceful coastal promontory known for its dramatic cliffs, wide-open views, and contemplative atmosphere. Popular filming location for Korean dramas.",
    highlights: [
      "Volcanic cliff formations meeting the sea",
      "Historic lighthouse and church on the cape",
      "Rapeseed flower fields in spring",
      "Panoramic ocean views stretching to Seongsan",
    ],
    facilities: ["Restrooms", "Small café", "Parking"],
    tip: "Best visited in late afternoon light. The wind can be strong — bring a light jacket.",
    walkingLevel: "Moderate — paved paths with some inclines",
  },
  {
    id: 6,
    number: "06",
    title: "Woljeongri Beach",
    shortDesc:
      "End with a calm coastal finish. Turquoise waters and a relaxed café atmosphere create a gentle conclusion to the day.",
    badges: ["Low Walking", "Rest Break", "Photo Spot"],
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=500&fit=crop",
    duration: "35 min at this stop",
    fullDesc:
      "Woljeongri Beach offers a serene conclusion to your East Jeju experience. The shallow turquoise waters and café-lined shore create a relaxed atmosphere.",
    highlights: [
      "Shallow emerald waters extending far from shore",
      "Charming beachfront cafés with ocean views",
      "Wind turbines creating an iconic backdrop",
      "Perfect sunset timing in late afternoon",
    ],
    facilities: ["Restrooms", "Multiple cafés", "Parking"],
    tip: "Great spot for a final coffee or refreshment. The beach extends beautifully at low tide.",
    walkingLevel: "Easy — flat beach and café access",
  },
]

const routeLogicQuestions = [
  "Why start at Hamdeok?",
  "Why place Seongeup in the middle?",
  "Why is lunch placed there?",
  "Why is the later part structured this way?",
  "Why might the order change?",
]

const seasons = [
  {
    id: "spring",
    label: "Spring",
    icon: Sparkles,
    period: "Mar–May",
    desc: "Balanced and pleasant conditions throughout the route.",
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
      "Comfortable walking conditions",
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
    icon: Baby,
    title: "Children & Family",
    content: "This route works well for families who enjoy scenic sightseeing at a calm pace.",
  },
  {
    icon: Users2,
    title: "Parents & Seniors",
    content:
      "Comfortable for many senior travelers, with flexible pacing and rest opportunities throughout the day.",
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
  { q: "Is this good for first-time visitors?", a: "Yes, it is designed especially well for first-time East Jeju visitors." },
  { q: "Is the walking difficult?", a: "Walking is generally moderate, with some stops easier than others." },
  { q: "Can it run in rain?", a: "Yes, with weather-aware adjustments when needed." },
  { q: "Is it okay with parents or seniors?", a: "Yes, many parents and seniors enjoy this route comfortably." },
  { q: "Can I join with children?", a: "Yes, especially for families who like scenic sightseeing." },
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

export default function TourDetailPage() {
  const [activeTab, setActiveTab] = useState("Overview")
  const [selectedStop, setSelectedStop] = useState<(typeof routeStops)[0] | null>(null)
  const [activeSeason, setActiveSeason] = useState("spring")
  const [expandedPractical, setExpandedPractical] = useState<number | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [expandedRouteLogic, setExpandedRouteLogic] = useState<number | null>(null)

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

      for (const tab of tabs) {
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_15%,#ffffff_40%,#f7f9fc_70%,#f8fafc_100%)] pb-28">
      {/* Sticky Tab Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.02)]">
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
        {/* Hero Image */}
        <div className="relative h-[340px] overflow-hidden group">
          <img
            src="https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&h=800&fit=crop&q=90"
            alt="East Jeju coastal landscape"
            className="w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
            style={{ filter: 'contrast(1.06) saturate(1.12) brightness(1.02)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/15 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-7">
            <div className="flex items-center gap-2 text-white/70 text-[9px] mb-4 tracking-[0.14em] font-medium uppercase">
              <span className="flex items-center gap-1">
                <Users className="w-2.5 h-2.5 opacity-70" />
                Small Group
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-white/40" />
              <span className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 opacity-70" />
                East Jeju
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-white/40" />
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 opacity-70" />
                8 Hours
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-white/40" />
              <span className="flex items-center gap-1">
                <Route className="w-2.5 h-2.5 opacity-70" />
                Scenic
              </span>
            </div>
            <h1 className="text-[28px] font-semibold text-white mb-3 tracking-[-0.025em] leading-[1.15]">
              East Signature Nature Core
            </h1>
            <p className="text-white/85 text-[14px] leading-[1.6] font-normal max-w-[320px] tracking-[-0.01em]">
              A first-time visitor-friendly East Jeju route with balanced scenery, culture, and flow.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="px-5 pt-6 pb-5">
          <p className="text-gray-600 text-[14px] leading-[1.75] tracking-[-0.008em] max-w-[340px]">
            A stable East Jeju route that moves naturally from sea, village, and coastal scenery to Seongsan views and a calm finish.
          </p>
        </div>

        {/* Badges */}
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 bg-[#FAFAF9] border border-gray-200/90 rounded-full text-[10px] font-semibold text-gray-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] tracking-[0.02em] transition-all duration-200 hover:border-gray-300/80 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Trust Facts */}
        <div className="px-5 pb-6">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {trustFacts.map((fact) => (
              <div key={fact.label} className="flex items-center gap-1.5 text-gray-500 text-[11px] tracking-[-0.005em]">
                <fact.icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                <span className="font-medium">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Card */}
        <div className="px-5 pb-6">
          <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.02)] transition-all duration-400 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.03)] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] uppercase">Live Weather</span>
              <span className="text-[10px] text-gray-400 tracking-[-0.01em]">Based on Seongsan area forecast</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[9px] text-gray-400 mb-1 tracking-[0.08em] font-semibold uppercase">Now</p>
                <div className="flex items-center gap-2">
                  <Sun className="w-6 h-6 text-amber-400" />
                  <span className="text-[26px] font-semibold text-gray-900 tracking-[-0.03em]">21°C</span>
                </div>
                <p className="text-[13px] text-gray-700 mt-1 font-medium tracking-[-0.01em]">Partly Cloudy</p>
                <p className="text-[10px] text-gray-400 mt-0.5 tracking-[-0.005em]">Feels like 19°C · Wind 18 km/h</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-1 tracking-[0.08em] font-semibold uppercase">Tomorrow</p>
                <div className="flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-gray-400" />
                  <span className="text-[20px] font-semibold text-gray-900 tracking-[-0.02em]">16° / 22°</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Umbrella className="w-3 h-3 text-gray-400" />
                  <span className="text-[13px] text-gray-700 font-medium tracking-[-0.01em]">40% Rain</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 tracking-[-0.005em]">Breezy through coastal stops</p>
              </div>
            </div>
            <div className="space-y-2 pt-3.5 border-t border-gray-100/80">
              <p className="text-[11px] text-gray-500 leading-[1.5]">
                <span className="font-semibold text-gray-600">What to wear:</span> Light layers recommended. Bring a windproof outer layer.
              </p>
              <p className="text-[11px] text-gray-500 leading-[1.5]">
                <span className="font-semibold text-gray-600">Route note:</span> Exposed coastal sections may feel cooler than the temperature suggests.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="px-5 pb-6">
          <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">At a Glance</p>
          <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Quick Overview</h2>

          {/* Best For Card */}
          <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)] mb-3.5 transition-all duration-400 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.05)] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}>
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
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="bg-[#FEFEFE] rounded-xl border border-gray-150 p-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <stat.icon className="w-4 h-4 text-gray-400 mx-auto mb-1.5" strokeWidth={1.75} />
                <p className="text-[8px] text-gray-400 uppercase tracking-[0.1em] font-semibold">{stat.label}</p>
                <p className="text-[13px] font-semibold text-gray-800 mt-0.5 tracking-[-0.01em]">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why This Tour Fits */}
        <div className="px-5 pb-8">
          <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">The Experience</p>
          <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Why This Tour Fits</h2>
          <div className="space-y-2.5">
            {whyFits.map((item) => (
              <div
                key={item.title}
                className="bg-[#FEFEFE] rounded-2xl border border-gray-150 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-400 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.05)] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}
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
      </div>

      {/* Route Section */}
      <div ref={sectionRefs.Route} className="px-5 pb-8">
        <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">The Route</p>
        <h2 className="text-[17px] font-semibold text-gray-900 mb-1 tracking-[-0.02em]">Your Journey</h2>
        <p className="text-[13px] text-gray-500 mb-5 leading-[1.5] tracking-[-0.005em]">
          Six carefully sequenced stops that build a complete East Jeju experience.
        </p>

        <div className="space-y-3.5">
          {routeStops.map((stop) => (
            <div
              key={stop.id}
              className="bg-[#FEFEFE] rounded-2xl border border-gray-150 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.05),0_8px_32px_rgba(0,0,0,0.03)] transition-all duration-400 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.07),0_16px_48px_rgba(0,0,0,0.04)] hover:-translate-y-1 group" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFC 100%)' }}
            >
              <div className="px-4 pt-3.5 pb-2">
                <span className="text-[10px] text-gray-400 font-semibold tracking-[0.08em]">{stop.number}</span>
              </div>
              <div className="px-4 pb-2.5">
                <div className="relative h-40 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
                  <img
                    src={stop.image}
                    alt={stop.title}
                    className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
                    style={{ filter: 'contrast(1.03) saturate(1.08) brightness(1.01)' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/8 to-transparent" />
                </div>
              </div>
              <div className="p-4 pt-2">
                <h3 className="font-semibold text-gray-900 mb-2 text-[15px] tracking-[-0.015em]">{stop.title}</h3>
                <p className="text-[13px] text-gray-500 leading-[1.6] mb-3.5 tracking-[-0.005em]">{stop.shortDesc}</p>
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {stop.badges.map((badge) => (
                    <span
                      key={badge}
                      className="px-2.5 py-1 bg-gray-50 border border-gray-150 rounded-full text-[10px] font-semibold text-gray-600 tracking-[0.01em]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedStop(stop)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-gray-800 hover:text-gray-600 transition-all duration-200 active:scale-[0.98] group/btn"
                >
                  View details
                  <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Route Logic */}
        <div className="mt-8">
          <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">Route Logic</p>
          <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Why This Order Works</h2>
          <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)]">
            {routeLogicQuestions.map((question, idx) => (
              <div key={idx} className="border-b border-gray-100/80 last:border-b-0">
                <button
                  onClick={() => setExpandedRouteLogic(expandedRouteLogic === idx ? null : idx)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors duration-200 hover:bg-gray-50/60 active:bg-gray-50"
                >
                  <span className="text-[13px] font-medium text-gray-800 tracking-[-0.01em]">{question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-out ${
                      expandedRouteLogic === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div className={`grid transition-all duration-300 ease-out ${expandedRouteLogic === idx ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="px-4 pb-3.5">
                      <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">
                        This sequence is optimized based on traffic patterns, lighting conditions, and energy flow throughout the day.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seasonal Variations */}
        <div className="mt-8">
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

          <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}>
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

      {/* Practical Section */}
      <div ref={sectionRefs.Practical} className="px-5 pb-8">
        <p className="text-[9px] font-semibold text-gray-400 tracking-[0.12em] mb-1.5 uppercase">Preparation</p>
        <h2 className="text-[17px] font-semibold text-gray-900 mb-4 tracking-[-0.02em]">Practical Information</h2>

        <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)]">
          {practicalItems.map((item, idx) => (
            <div key={idx} className="border-b border-gray-100/80 last:border-b-0">
              <button
                onClick={() => setExpandedPractical(expandedPractical === idx ? null : idx)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors duration-200 hover:bg-gray-50/60 active:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-gray-800 tracking-[-0.01em]">{item.title}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-out ${
                    expandedPractical === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div className={`grid transition-all duration-300 ease-out ${expandedPractical === idx ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-3.5 pl-11">
                    <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{item.content}</p>
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

        <div className="bg-[#FEFEFE] rounded-2xl border border-gray-150 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.04)]">
          {faqItems.map((item, idx) => (
            <div key={idx} className="border-b border-gray-100/80 last:border-b-0">
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors duration-200 hover:bg-gray-50/60 active:bg-gray-50"
              >
                <span className="text-[13px] font-medium text-gray-800 pr-3 tracking-[-0.01em]">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-300 ease-out ${
                    expandedFaq === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div className={`grid transition-all duration-300 ease-out ${expandedFaq === idx ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-3.5">
                    <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{item.a}</p>
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
              className="bg-[#FEFEFE] rounded-xl border border-gray-150 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-400 ease-out hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.05)] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}
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

      {/* Sticky Bottom Booking Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-2xl border-t border-gray-100 shadow-[0_-1px_2px_rgba(0,0,0,0.02),0_-4px_16px_rgba(0,0,0,0.04),0_-12px_40px_rgba(0,0,0,0.03)] z-50">
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <span className="text-[9px] text-gray-400 tracking-[0.1em] font-semibold uppercase">From</span>
            <p className="text-[24px] font-semibold text-gray-900 tracking-[-0.03em] leading-tight">$189</p>
          </div>
          <button className="px-7 py-3 bg-neutral-900 text-white text-[13px] font-semibold rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.15),0_6px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out hover:bg-neutral-800 hover:shadow-[0_4px_10px_rgba(0,0,0,0.18),0_10px_28px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0">
            Reserve Now
          </button>
        </div>
      </div>

      {/* Bottom Sheet / Drawer */}
      {selectedStop && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedStop(null)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_-12px_48px_rgba(0,0,0,0.1)]">
            <div className="sticky top-0 bg-white/98 backdrop-blur-2xl pt-2.5 pb-3 px-5 border-b border-gray-100/80 z-10">
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

              <div className="bg-[#FEFEFE] rounded-xl border border-gray-150 p-4 mb-3 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.03)]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}>
                <h3 className="font-semibold text-gray-900 text-[13px] mb-1.5 tracking-[-0.01em]">Tip</h3>
                <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{selectedStop.tip}</p>
              </div>

              <div className="bg-[#FEFEFE] rounded-xl border border-gray-150 p-4 mb-24 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.03)]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Footprints className="w-3.5 h-3.5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900 text-[13px] tracking-[-0.01em]">Walking Level</h3>
                </div>
                <p className="text-[13px] text-gray-500 leading-[1.55] tracking-[-0.005em]">{selectedStop.walkingLevel}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
