"use client"

import { useState } from "react"
import { Star, ThumbsUp, ChevronDown, Check, Camera, MapPin, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

// Sample review data
const reviewsSummary = {
  averageRating: 4.8,
  totalReviews: 127,
  ratingDistribution: [
    { stars: 5, count: 98, percentage: 77 },
    { stars: 4, count: 21, percentage: 17 },
    { stars: 3, count: 6, percentage: 5 },
    { stars: 2, count: 1, percentage: 1 },
    { stars: 1, count: 1, percentage: 1 },
  ],
  highlights: [
    { label: "Scenery", count: 89 },
    { label: "Guide", count: 76 },
    { label: "Pacing", count: 54 },
    { label: "Photo spots", count: 48 },
  ]
}

const reviews = [
  {
    id: 1,
    author: "Sarah M.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
    location: "Singapore",
    date: "March 2024",
    rating: 5,
    title: "Perfectly paced day through East Jeju",
    text: "The route made so much sense—starting at Stone Park gave us context for everything that came after. Our guide explained the geology in a way that made Seongsan and the lava tube much more meaningful. Lunch timing was perfect, and we had energy for the crater climb.",
    helpful: 24,
    verified: true,
    tripType: "Couple",
    photos: [
      "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=400&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80"
    ]
  },
  {
    id: 2,
    author: "James K.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
    location: "Hong Kong",
    date: "March 2024",
    rating: 5,
    title: "Best way to see East Jeju in one day",
    text: "We've done several tours in Korea, and this one stood out for its thoughtful sequencing. The guide knew exactly when to slow down and when to move. The village at the end was a nice cultural finish after all the natural scenery.",
    helpful: 18,
    verified: true,
    tripType: "Family",
    photos: []
  },
  {
    id: 3,
    author: "Yuki T.",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80",
    location: "Tokyo",
    date: "February 2024",
    rating: 4,
    title: "Great route, wish we had more time at Seongsan",
    text: "The overall experience was excellent. Stone Park was surprisingly interesting, and the cave-garden stop was a nice break after the crater. Only reason for 4 stars is I would have liked 15 more minutes at Seongsan, but I understand the schedule constraints.",
    helpful: 12,
    verified: true,
    tripType: "Solo",
    photos: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"
    ]
  },
  {
    id: 4,
    author: "Michael R.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
    location: "Sydney",
    date: "February 2024",
    rating: 5,
    title: "Exceeded expectations in every way",
    text: "Came for the scenery, stayed for the storytelling. The guide connected each stop to the next in a way that made the whole day feel cohesive. The lunch spot was excellent and the small group size meant we could actually hear explanations at each stop.",
    helpful: 31,
    verified: true,
    tripType: "Friends",
    photos: []
  }
]

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating 
              ? "fill-amber-400 text-amber-400" 
              : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: typeof reviews[0] }) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = review.text.length > 200
  
  return (
    <div className="card-premium p-5 transition-all duration-200 hover:shadow-premium-elevated">
      {/* Header: Avatar, Name, Meta */}
      <div className="flex items-start gap-3.5">
        <img
          src={review.avatar}
          alt={review.author}
          className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{review.author}</span>
            {review.verified && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                <Check className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {review.location}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {review.date}
            </span>
          </div>
        </div>
      </div>
      
      {/* Rating and Title */}
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-xs text-muted-foreground">{review.tripType}</span>
        </div>
        {review.title && (
          <h4 className="mt-2 text-sm font-semibold text-foreground leading-snug">
            {review.title}
          </h4>
        )}
      </div>
      
      {/* Review Text */}
      <div className="mt-3">
        <p className="text-sm text-muted-foreground leading-[1.7]">
          {shouldTruncate && !expanded 
            ? `${review.text.slice(0, 200)}...` 
            : review.text
          }
        </p>
        {shouldTruncate && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
      
      {/* Photos */}
      {review.photos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {review.photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt={`Review photo ${i + 1}`}
              className="h-20 w-28 flex-shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}
      
      {/* Footer: Helpful */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ThumbsUp className="h-3.5 w-3.5" />
          Helpful ({review.helpful})
        </button>
      </div>
    </div>
  )
}

export function ReviewsSection() {
  const [showAll, setShowAll] = useState(false)
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3)
  
  return (
    <div className="space-y-7">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Guest Reviews
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          What travelers say about this experience.
        </p>
      </div>
      
      {/* Summary Card - Premium glass treatment */}
      <div 
        className="rounded-xl px-4 py-3 sm:px-4 sm:py-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(46,92,138,0.03) 0%, rgba(200,149,108,0.02) 100%)',
          border: '1px solid rgba(235,232,227,0.8)',
        }}
      >
        <div className="grid w-full grid-cols-2 items-center gap-4 sm:gap-5">
          <div className="flex min-w-0 justify-center px-0.5 sm:px-1">
            <div className="inline-flex shrink-0 flex-col items-center justify-center gap-1 text-center">
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-2xl font-bold text-foreground tracking-tight leading-none tabular-nums">
                  {reviewsSummary.averageRating}
                </span>
                <span className="text-xs text-muted-foreground">/5</span>
              </div>
              <StarRating rating={Math.round(reviewsSummary.averageRating)} size="sm" />
              <p className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap sm:text-[11px]">
                Based on {reviewsSummary.totalReviews} reviews
              </p>
            </div>
          </div>

          <div className="flex min-w-0 justify-center px-0.5 sm:px-1">
            <div className="w-[min(100%,11.75rem)] shrink-0 space-y-1 sm:w-[min(100%,13.25rem)]">
              {reviewsSummary.ratingDistribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-3 tabular-nums sm:text-[13px]">{item.stars}</span>
                  <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5" />
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden min-w-0">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-9 text-right tabular-nums sm:text-[13px] sm:w-10">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Highlight Tags */}
        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground shrink-0">
            Guests frequently mention
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reviewsSummary.highlights.map((tag) => (
              <span
                key={tag.label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-border/60 text-foreground"
              >
                {tag.label}
                <span className="text-muted-foreground tabular-nums">({tag.count})</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Review Cards */}
      <div className="space-y-4">
        {displayedReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
      
      {/* Show More Button */}
      {reviews.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 rounded-xl border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
        >
          {showAll ? "Show fewer reviews" : `Show all ${reviews.length} reviews`}
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform duration-200",
            showAll && "rotate-180"
          )} />
        </button>
      )}
      
      {/* Write a Review CTA */}
      <div className="card-utility p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Been on this tour?
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Share your experience to help other travelers.
        </p>
        <button className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Write a Review
        </button>
      </div>
    </div>
  )
}
