"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourTabsNavProps = Pick<EastSignatureNatureCoreDetailViewModel, "subnavItems">;

export function TourTabsNav({ subnavItems }: TourTabsNavProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 267);
      const sections = subnavItems.map((item) => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 120;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(subnavItems[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [subnavItems]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 60;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
    }
  };

  return (
    <nav
      className={cn(
        "bg-white/98 backdrop-blur-md border-b border-border/80 transition-all duration-200 z-40",
        isSticky ? "sticky top-0 shadow-sm" : "",
      )}
    >
      <div className="mx-auto max-w-xl px-5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2.5">
          {subnavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                activeSection === item.id
                  ? "bg-foreground text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
