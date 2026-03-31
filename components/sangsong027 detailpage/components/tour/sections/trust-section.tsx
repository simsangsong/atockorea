"use client"

import { useState } from "react"
import { Shield, Award, Clock, MessageCircle, Star, ChevronDown } from "lucide-react"

export function TrustSection() {
  const [showAllReviews, setShowAllReviews] = useState(false)

  const trustPoints = [
    {
      icon: <Shield className="h-4 w-4" />,
      title: "Verified",
      description: "Licensed operator"
    },
    {
      icon: <Award className="h-4 w-4" />,
      title: "Top Rated",
      description: "4.9 from 2,400+"
    },
    {
      icon: <Clock className="h-4 w-4" />,
      title: "Flexible",
      description: "48h free cancel"
    },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      title: "Instant",
      description: "Quick confirm"
    }
  ]

  const reviews = [
    {
      name: "Sarah M.",
      location: "Singapore",
      date: "Mar 2024",
      rating: 5,
      text: "Our guide was exceptional—knowledgeable and flexible with timing. The route felt perfectly paced."
    },
    {
      name: "Thomas K.",
      location: "Germany",
      date: "Feb 2024",
      rating: 5,
      text: "Best day tour I've taken anywhere. Every stop was thoughtfully chosen."
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 mb-1 tracking-tight">
          Book with Confidence
        </h2>
        <p className="text-[13px] text-neutral-500">
          Trusted by thousands of travelers
        </p>
      </div>

      {/* Trust points - compact 4-column on mobile */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {trustPoints.map((point, index) => (
          <div key={index} className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-neutral-100">
            <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-600 mb-2">
              {point.icon}
            </div>
            <h3 className="text-[11px] font-semibold text-neutral-900 mb-0.5">
              {point.title}
            </h3>
            <p className="text-[10px] text-neutral-500 leading-tight">
              {point.description}
            </p>
          </div>
        ))}
      </div>

      {/* Reviews - collapsible on mobile */}
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <button 
          onClick={() => setShowAllReviews(!showAllReviews)}
          className="w-full flex items-center justify-between p-4 md:pointer-events-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[13px] font-medium text-neutral-900">4.9</span>
            <span className="text-[13px] text-neutral-500">(2,437 reviews)</span>
          </div>
          <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform md:hidden ${showAllReviews ? "rotate-180" : ""}`} />
        </button>

        <div className={`border-t border-neutral-50 ${showAllReviews ? "block" : "hidden md:block"}`}>
          {reviews.map((review, index) => (
            <div key={index} className="p-4 border-b border-neutral-50 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-[11px] font-semibold text-neutral-600">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-neutral-900">{review.name}</p>
                    <p className="text-[11px] text-neutral-500">{review.location}</p>
                  </div>
                </div>
                <span className="text-[11px] text-neutral-400">{review.date}</span>
              </div>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                {`"${review.text}"`}
              </p>
            </div>
          ))}
          
          <button className="w-full py-3 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Read all 2,400+ reviews
          </button>
        </div>
      </div>
    </section>
  )
}
