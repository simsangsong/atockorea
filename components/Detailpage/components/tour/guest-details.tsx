'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Check, X, MapPin, Clock, Utensils, AlertCircle } from 'lucide-react'

const details = [
  {
    id: 'included',
    title: "What's Included",
    items: [
      { included: true, text: 'Professional English-speaking guide' },
      { included: true, text: 'Private vehicle transportation' },
      { included: true, text: 'Hotel pickup and drop-off (Jeju City area)' },
      { included: true, text: 'Entrance fees to all scheduled stops' },
      { included: true, text: 'Local lunch (set menu, dietary options available)' },
      { included: true, text: 'Bottled water throughout the day' },
      { included: true, text: 'WhatsApp support before and during tour' },
    ],
  },
  {
    id: 'not-included',
    title: 'Not Included',
    items: [
      { included: false, text: 'Additional meals, snacks, or drinks' },
      { included: false, text: 'Personal purchases and souvenirs' },
      { included: false, text: 'Travel insurance' },
      { included: false, text: 'Gratuities (optional but appreciated)' },
    ],
  },
  {
    id: 'pickup',
    title: 'Pickup & Drop-off',
    content: null,
    customContent: (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1">Pickup Location</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Hotel lobby in Jeju City area. For Seogwipo or other areas, please contact us for arrangements.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1">Timing</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Pickup at 8:30 AM. Return approximately 6:30-7:00 PM depending on traffic.
            </p>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground/70 italic">
          Final pickup details sent via WhatsApp 12 hours before your tour.
        </p>
      </div>
    ),
  },
  {
    id: 'wear',
    title: 'What to Wear',
    items: [
      { included: true, text: 'Comfortable walking shoes with grip (no heels)' },
      { included: true, text: 'Layers - mornings can be cool, afternoons warm' },
      { included: true, text: 'Light jacket or windbreaker (coastal areas windy)' },
      { included: true, text: 'Hat and sunglasses for sun protection' },
    ],
  },
  {
    id: 'bring',
    title: 'What to Bring',
    items: [
      { included: true, text: 'Camera or phone for photos' },
      { included: true, text: 'Sunscreen (SPF 30+)' },
      { included: true, text: 'Light rain jacket (just in case)' },
      { included: true, text: 'Cash for optional purchases (10,000-30,000 KRW)' },
      { included: true, text: 'Any personal medications' },
    ],
  },
  {
    id: 'terrain',
    title: 'Terrain & Accessibility',
    content: null,
    customContent: (
      <div className="space-y-4">
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Stairs & Slopes</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Some stops have gentle slopes and a few short stair sections. Most paths are paved or well-maintained. No strenuous climbing required.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Mobility Considerations</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Wheelchair users: please contact us in advance. We can adjust stops for accessibility. Walking aids are manageable at most locations.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Rest Opportunities</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Benches available at each stop. Vehicle rest between locations. Pace is relaxed, not rushed.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'families',
    title: 'Families & Seniors',
    content: null,
    customContent: (
      <div className="space-y-4">
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Children</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Best for ages 6+. Younger children welcome but may tire during longer walks. Car seats available on request.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Strollers</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Compact strollers work at most stops. Some paths have uneven sections. Baby carriers often easier.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground mb-1">Senior Travelers</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Suitable for active seniors comfortable with moderate walking. Your guide adjusts pace and can shorten walks if needed.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'rhythm',
    title: 'Restroom & Break Rhythm',
    content: null,
    customContent: (
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Restrooms available at every stop. We never go more than 90 minutes without a bathroom opportunity.
        </p>
        <div className="bg-secondary/50 rounded-xl p-4">
          <p className="text-[12px] text-foreground/80">
            <span className="font-medium">Typical rhythm:</span> Stop 1 → 45 min drive → Stop 2 → 40 min drive → Lunch (full break) → Afternoon stops with shorter drives
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'lunch',
    title: 'Lunch Details',
    content: null,
    customContent: (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Utensils className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Traditional Jeju set menu at a local restaurant. Includes rice, soup, protein (usually seafood or pork), and multiple banchan side dishes.
            </p>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Dietary needs:</span> Vegetarian, pescatarian, and allergy accommodations available. Please note requirements when booking.
        </p>
      </div>
    ),
  },
  {
    id: 'timing',
    title: 'Timing Flexibility',
    content: null,
    customContent: (
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Times shown are estimates. Your guide adjusts based on group pace, weather, and real-time conditions.
        </p>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted-foreground/80">
            If you have evening plans (flight, dinner reservation), please let us know at booking. We&apos;ll ensure timely return.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'weather',
    title: 'Weather & Visibility',
    content: 'Tours operate in most weather conditions. Light rain adds atmosphere to many stops. Heavy rain or storms may require stop substitutions - your guide chooses the best alternatives. Refunds available only if the entire tour must cancel due to severe conditions.',
  },
  {
    id: 'cancellation',
    title: 'Cancellation Policy',
    content: 'Free cancellation up to 48 hours before tour start. 50% refund for cancellations 24-48 hours before. No refund within 24 hours. Weather-related cancellations by operator receive full refund or reschedule.',
  },
]

export function GuestDetails() {
  return (
    <section className="px-5 py-14 md:px-8 lg:px-10 bg-secondary/40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Practical Details
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Everything you need to know before you go
        </p>
        
        <div className="glass-card rounded-2xl overflow-hidden">
          <Accordion type="multiple" defaultValue={['included', 'pickup']} className="divide-y divide-border/40">
            {details.map((detail) => (
              <AccordionItem key={detail.id} value={detail.id} className="border-0">
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-secondary/30 transition-colors">
                  <span className="text-[14px] font-medium text-foreground">{detail.title}</span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  {detail.customContent ? (
                    detail.customContent
                  ) : detail.items ? (
                    <ul className="space-y-2.5">
                      {detail.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-[13px]">
                          {item.included ? (
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                              <X className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className={item.included ? 'text-foreground/80' : 'text-muted-foreground'}>
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {detail.content}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
