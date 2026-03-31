"use client"

import { MapPin, Clock, Car, AlertCircle, Navigation, Mail } from "lucide-react"

const pickupInfo = [
  {
    icon: Car,
    title: "Hotel Pickup",
    description: "Complimentary pickup from major hotels in Haeundae, Seomyeon, and Busan Station areas",
    highlighted: true
  },
  {
    icon: MapPin,
    title: "Meeting Point",
    description: "Alternatively, meet at Busan Station or other convenient locations",
    highlighted: false
  },
  {
    icon: Clock,
    title: "Departure Time",
    description: "Default departure at 9:00 AM. Flexible timing available upon request.",
    highlighted: false
  },
  {
    icon: Mail,
    title: "Pre-Tour Info",
    description: "Exact location details and guide contact sent 24 hours before your tour",
    highlighted: false
  }
]

export function MeetingSection() {
  return (
    <section className="px-5 md:px-8 lg:px-0 py-12 md:py-16 bg-white">
      <div className="max-w-4xl mx-auto lg:mx-0">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Meeting Point</span>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
          Where we meet
        </h2>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Map Card - Glass framing */}
          <div className="rounded-2xl overflow-hidden glass-card p-1">
            <div className="aspect-[4/3] relative rounded-xl overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d52456.84089762989!2d129.0307!3d35.1587!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3568eb386a3c8f3d%3A0x8c9e5e58d8d8b5e0!2sBusan%20Station!5e0!3m2!1sen!2skr!4v1600000000000!5m2!1sen!2skr"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />
              {/* Map overlay gradient for depth */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-accent" />
                Busan Station area • Exact location sent after booking
              </p>
            </div>
          </div>

          {/* Pickup info cards - Glass style */}
          <div className="space-y-3">
            {pickupInfo.map((item, index) => (
              <div 
                key={index}
                className={`p-4 rounded-xl transition-all ${
                  item.highlighted 
                    ? 'glass-card' 
                    : 'glass-card-subtle'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.highlighted 
                      ? 'bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20' 
                      : 'bg-gradient-to-br from-muted/80 to-muted/50 border border-border/30'
                  }`}>
                    <item.icon className={`w-4.5 h-4.5 ${item.highlighted ? 'text-accent' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Alert note - Glass amber style */}
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-gradient-to-br from-amber-50/90 to-amber-50/70 border border-amber-200/50 backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Please be ready 5 minutes before your scheduled pickup time
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
