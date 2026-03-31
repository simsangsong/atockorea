import { Check, X } from "lucide-react"

export function WhyThisTour() {
  const bestFor = [
    "First-time visitors",
    "Couples",
    "Scenic travelers",
    "Parents"
  ]

  const notIdealFor = [
    "Guests wanting mostly indoor attractions",
    "A strongly cafe-focused day"
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <h2 className="text-base font-semibold text-neutral-900 mb-4 tracking-tight">
        Is This Tour Right for You?
      </h2>
      
      <div className="space-y-3">
        {/* Best For - compact row on mobile */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Best For</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {bestFor.map((item, index) => (
              <span 
                key={index} 
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-full text-[13px] text-neutral-700 font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Not Ideal For - simplified */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100">
              <X className="h-3.5 w-3.5 text-neutral-500" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Not Ideal For</h3>
          </div>
          <ul className="space-y-2">
            {notIdealFor.map((item, index) => (
              <li key={index} className="text-[13px] text-neutral-600 flex items-start gap-2">
                <span className="text-neutral-300 mt-0.5">-</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
