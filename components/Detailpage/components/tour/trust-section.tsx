import { Shield, Award, Users, MessageCircle, Star } from 'lucide-react'
import Image from 'next/image'

const trustPoints = [
  {
    icon: Shield,
    title: 'Licensed & Insured',
    description: 'Fully licensed with comprehensive coverage',
  },
  {
    icon: Award,
    title: 'Expert Guides',
    description: 'Jeju natives with 5+ years experience',
  },
  {
    icon: Users,
    title: 'Small Groups',
    description: 'Maximum 8 guests per tour',
  },
  {
    icon: MessageCircle,
    title: '24/7 Support',
    description: 'Direct line to our team',
  },
]

const reviews = [
  {
    name: 'Sarah M.',
    location: 'London',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
    text: 'Absolutely perfect day. Our guide knew exactly when to visit each spot for the best experience. The lunch was incredible.',
    date: 'March 2024',
  },
  {
    name: 'James L.',
    location: 'Sydney',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
    text: "As first-time visitors to Jeju, this tour was ideal. Well-paced, beautiful stops, and our guide's knowledge made everything come alive.",
    date: 'February 2024',
  },
]

export function TrustSection() {
  return (
    <section className="px-5 py-14 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        {/* Trust points - refined grid */}
        <div className="grid grid-cols-2 gap-6 mb-14 md:grid-cols-4">
          {trustPoints.map((point) => (
            <div key={point.title} className="text-center">
              <div className="mx-auto w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                <point.icon className="h-4.5 w-4.5 text-foreground/50" />
              </div>
              <h3 className="text-[13px] font-medium text-foreground">{point.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
        
        {/* Reviews header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2 font-medium">
              Guest Reviews
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-foreground/80 text-foreground/80" />
                ))}
              </div>
              <span className="text-[13px] text-muted-foreground">4.9 from 128 reviews</span>
            </div>
          </div>
        </div>
        
        {/* Reviews - refined cards */}
        <div className="grid gap-5 md:grid-cols-2">
          {reviews.map((review) => (
            <div 
              key={review.name}
              className="glass-card rounded-2xl p-6"
            >
              <p className="text-[14px] text-foreground/80 leading-relaxed mb-5 italic">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 rounded-full overflow-hidden">
                  <Image
                    src={review.avatar}
                    alt={review.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{review.name}</p>
                  <p className="text-[11px] text-muted-foreground">{review.location} · {review.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
