import type { Metadata } from "next";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import IntakeForm from "@/components/itinerary-builder/IntakeForm";

export const metadata: Metadata = {
  title: "Build Your Custom Korea Itinerary | AtoC Korea",
  description:
    "Tell us a couple of things about your trip — we'll set you up with a map of curated stops and quote your itinerary within 24 hours.",
};

export default function ItineraryBuilderLanding() {
  return (
    <SitePageShell>
      <main className="min-h-screen bg-white/55">
        <section className="section-py-sm px-4 md:px-6">
          <div className="mx-auto max-w-2xl">
            <header className="mb-8 text-center md:mb-12">
              <p className="mb-3 text-eyebrow">Custom itinerary builder</p>
              <h1 className="mb-3 text-display text-slate-900">Tell us about your trip</h1>
              <p className="mx-auto max-w-lg text-body text-slate-600">
                Pick a region and trip type — we&apos;ll put you on a map of curated stops you
                can rearrange into your day.
              </p>
            </header>

            <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_18px_48px_-26px_rgba(15,23,42,0.32)] backdrop-blur-md md:p-7">
              <IntakeForm />
            </div>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
