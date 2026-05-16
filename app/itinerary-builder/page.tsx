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
      <main className="min-h-screen bg-slate-50">
        <section className="px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-2xl">
            <header className="mb-8 text-center md:mb-12">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                Custom itinerary builder
              </p>
              <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Tell us about your trip
              </h1>
              <p className="mx-auto max-w-lg text-sm text-slate-600 md:text-base">
                Two questions — then you'll be on a map of curated stops you can rearrange into
                your day. No package required.
              </p>
            </header>

            <div className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-200 md:p-7">
              <IntakeForm />
            </div>

            <p className="mt-8 text-center text-xs text-slate-500">
              Seoul + DMZ rollout planned after MVP launch.
            </p>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
