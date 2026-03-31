"use client"

import { Shield, MessageCircle, CreditCard, Clock, Star, Award, Quote } from "lucide-react"

const trustPoints = [
  {
    icon: Shield,
    title: "Verified Operator",
    description: "Licensed & insured"
  },
  {
    icon: MessageCircle,
    title: "Fast Support",
    description: "EN/KR replies"
  },
  {
    icon: CreditCard,
    title: "Secure Pay",
    description: "Refund protected"
  },
  {
    icon: Clock,
    title: "Instant Confirm",
    description: "Immediate booking"
  }
]

const reviews = [
  {
    text: "An incredible day exploring Busan! Our guide knew all the best spots and adjusted the pace perfectly for our family.",
    author: "James K.",
    trip: "Family trip",
    date: "March 2026"
  },
  {
    text: "The temple at sunrise was magical. So glad we did this private tour instead of a group.",
    author: "Sarah M.",
    trip: "Couple",
    date: "February 2026"
  }
]

export function TrustSection() {
  return (
    <section className="px-5 md:px-8 lg:px-0 py-12 md:py-16 bg-white">
      <div className="max-w-4xl mx-auto lg:mx-0">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Reviews & Trust</span>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
          What travelers say
        </h2>

        {/* Review summary card - Glass style with blue tint */}
        <div className="relative p-6 rounded-2xl glass-card mb-6 overflow-hidden">
          {/* Decorative blue accent glow */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4.5 h-4.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <span className="text-2xl font-bold text-foreground">4.9</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <span className="text-sm text-muted-foreground">28 reviews</span>
              <div className="hidden md:flex items-center gap-1.5 ml-auto px-3.5 py-1.5 rounded-full bg-gradient-to-r from-accent/15 to-accent/10 border border-accent/20">
                <Award className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-bold text-accent">Top-rated</span>
              </div>
            </div>

            {/* Sample reviews */}
            <div className="space-y-5">
              {reviews.map((review, index) => (
                <div key={index} className="relative">
                  <Quote className="absolute -left-1 -top-1 w-6 h-6 text-accent/15" />
                  <blockquote className="text-sm text-foreground leading-relaxed pl-5 mb-2.5">
                    &ldquo;{review.text}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-2.5 pl-5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
                      <span className="text-[9px] font-bold text-accent">
                        {review.author.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.author} • {review.trip} • {review.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust points - Glass cards with horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 md:mx-0 md:px-0 md:grid md:grid-cols-4 pb-2 md:pb-0">
          {trustPoints.map((point, index) => (
            <div 
              key={index}
              className="flex-shrink-0 w-[145px] md:w-auto p-4 rounded-xl glass-card-subtle text-center hover:scale-[1.02] transition-transform"
            >
              <div className="w-11 h-11 mx-auto rounded-xl bg-gradient-to-br from-accent/12 to-accent/5 flex items-center justify-center mb-3 border border-accent/10">
                <point.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xs font-semibold text-foreground mb-0.5">{point.title}</h3>
              <p className="text-[10px] text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
