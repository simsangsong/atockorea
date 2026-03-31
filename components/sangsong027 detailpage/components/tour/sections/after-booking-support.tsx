"use client"

import { MessageSquare, Calendar, FileText, Phone } from "lucide-react"

export function AfterBookingSupport() {
  const supportFeatures = [
    {
      icon: <MessageSquare className="h-4 w-4" />,
      title: "Guide Contact",
      description: "Chat 24h before"
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      title: "Reschedule",
      description: "Free up to 48h"
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: "Digital PDF",
      description: "Maps & tips"
    },
    {
      icon: <Phone className="h-4 w-4" />,
      title: "24/7 Support",
      description: "Always available"
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 mb-1 tracking-tight">
          After You Book
        </h2>
        <p className="text-[13px] text-neutral-500">
          Support every step of the way
        </p>
      </div>

      {/* Compact 4-column grid on mobile */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {supportFeatures.map((feature, index) => (
          <div key={index} className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-neutral-100">
            <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-600 mb-2">
              {feature.icon}
            </div>
            <h3 className="text-[11px] font-semibold text-neutral-900 mb-0.5 leading-tight">
              {feature.title}
            </h3>
            <p className="text-[10px] text-neutral-500 leading-tight">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Contact CTA */}
      <div className="p-4 rounded-2xl bg-neutral-900 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold">Questions?</h3>
            <p className="text-[12px] text-white/60">
              We respond within 2 hours
            </p>
          </div>
          <button className="px-4 py-2 bg-white text-neutral-900 rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors flex-shrink-0">
            Message
          </button>
        </div>
      </div>
    </section>
  )
}
