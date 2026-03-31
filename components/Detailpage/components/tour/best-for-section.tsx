import { Check, X } from 'lucide-react'

const bestFor = [
  { text: 'First-time visitors to Jeju', detail: 'Covers iconic highlights efficiently' },
  { text: 'Couples seeking scenic romance', detail: 'Beautiful light and intimate moments' },
  { text: 'Photo-focused travelers', detail: 'Multiple golden hour opportunities' },
  { text: 'Parents with children 6+', detail: 'Engaging variety, manageable pace' },
  { text: 'Active seniors', detail: 'Moderate walking, flexible rest' },
  { text: 'Nature and culture seekers', detail: 'Balanced mix of both' },
]

const notIdeal = [
  { text: 'Guests wanting mostly indoor attractions', detail: 'This tour is 80% outdoor' },
  { text: 'Cafe-hopping focused days', detail: 'Limited cafe time in schedule' },
  { text: 'Very young children (under 4)', detail: 'Long day with walking involved' },
  { text: 'Guests with significant mobility limits', detail: 'Some uneven terrain' },
]

export function BestForSection() {
  return (
    <section className="px-5 py-14 md:px-8 lg:px-10 bg-secondary/40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Is This Tour Right for You?
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Designed for specific travel styles and preferences
        </p>
        
        <div className="grid gap-5 md:grid-cols-2">
          {/* Best For */}
          <div className="glass-card rounded-2xl p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] text-primary font-medium mb-5">
              Ideal For
            </p>
            <ul className="space-y-4">
              {bestFor.map((item) => (
                <li key={item.text} className="flex items-start gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <span className="text-[14px] text-foreground">{item.text}</span>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Not Ideal */}
          <div className="glass-card rounded-2xl p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-5">
              May Not Suit
            </p>
            <ul className="space-y-4">
              {notIdeal.map((item) => (
                <li key={item.text} className="flex items-start gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-[14px] text-muted-foreground">{item.text}</span>
                    <p className="text-[12px] text-muted-foreground/70 mt-0.5">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Uncertainty note */}
        <div className="mt-6 text-center">
          <p className="text-[12px] text-muted-foreground/60">
            Not sure? <span className="text-primary">Ask us</span> — we&apos;ll help you find the right fit
          </p>
        </div>
      </div>
    </section>
  )
}
