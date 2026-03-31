"use client"

import { CollapsibleSection } from "../collapsible-section"
import { FitIndicator } from "../fit-indicator"
import { 
  Clock, 
  MapPin, 
  Car, 
  Utensils, 
  Shirt, 
  Package, 
  Ban
} from "lucide-react"

export function PracticalDetails() {
  return (
    <section className="px-4 lg:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 mb-1 tracking-tight">
          Practical Details
        </h2>
        <p className="text-[13px] text-neutral-500">
          Everything you need to know
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 divide-y divide-neutral-50">
        <CollapsibleSection title="Meeting & Pickup" defaultOpen>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-neutral-500" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-neutral-900">8:30 AM pickup</p>
                <p className="text-[12px] text-neutral-500">Return by 6:00 PM</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <Car className="h-4 w-4 text-neutral-500" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-neutral-900">Private vehicle</p>
                <p className="text-[12px] text-neutral-500">Air-conditioned minivan or SUV</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="What's Included">
          <ul className="space-y-2">
            {[
              "Private transport with local driver",
              "English-speaking guide",
              "All entrance fees",
              "Bottled water & snacks"
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-[13px] text-neutral-700">
                <Package className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Not Included">
          <ul className="space-y-2">
            {[
              "Lunch (~₩15,000–25,000)",
              "Personal expenses",
              "Travel insurance"
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-[13px] text-neutral-700">
                <Ban className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="What to Wear">
          <ul className="space-y-2">
            {[
              "Comfortable walking shoes",
              "Light layers",
              "Sun protection",
              "Light rain jacket"
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-[13px] text-neutral-700">
                <Shirt className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Physical Requirements">
          <div className="space-y-0 divide-y divide-neutral-50">
            <FitIndicator 
              label="Walking Level" 
              level="medium" 
              description="Moderate, some stairs"
            />
            <FitIndicator 
              label="Senior Fit" 
              level="high" 
              description="Good with adjusted pacing"
            />
            <FitIndicator 
              label="Family Fit" 
              level="high" 
              description="Suitable for children 5+"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Dining Options">
          <div className="flex items-start gap-3">
            <Utensils className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] text-neutral-700 mb-2">
                Guide recommendations based on preference:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Black pork", "Seafood", "Stone pot", "Vegetarian"].map((item) => (
                  <span key={item} className="px-2 py-1 bg-neutral-50 rounded-md text-[11px] text-neutral-600">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </section>
  )
}
