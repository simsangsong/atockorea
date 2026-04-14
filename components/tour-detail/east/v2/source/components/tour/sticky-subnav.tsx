"use client"

import { useState, useEffect } from "react"
import { useEastV2LayoutIntegration } from "@/components/tour-detail/east/v2/EastV2LayoutIntegrationContext"
import { cn } from "../../lib/utils"

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "details", label: "Details" },
  { id: "faq", label: "FAQ" },
]

export function StickySubnav() {
  const [activeSection, setActiveSection] = useState("overview")
  const [isSticky, setIsSticky] = useState(false)
  const { stickySubnavTopClass, scrollToSectionOffsetPx, scrollSpyViewportOffsetPx } =
    useEastV2LayoutIntegration()

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 400)

      const sections = navItems.map((item) => document.getElementById(item.id))
      const scrollPosition = window.scrollY + scrollSpyViewportOffsetPx

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navItems[i].id)
          break
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [scrollSpyViewportOffsetPx])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = scrollToSectionOffsetPx
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: elementPosition - offset, behavior: "smooth" })
    }
  }

  return (
    <nav
      className={cn(
        "bg-white/98 backdrop-blur-md border-b border-border/80 transition-all duration-200 z-[45]",
        isSticky ? cn("sticky shadow-sm", stickySubnavTopClass) : "",
      )}
    >
      <div className="mx-auto max-w-xl px-5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                activeSection === item.id
                  ? "bg-foreground text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

