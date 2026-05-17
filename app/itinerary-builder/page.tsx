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
        <section className="section-py-sm px-4 md:px-6">
          <div className="mx-auto max-w-2xl">
            <header className="mb-8 text-center md:mb-12">
              <p className="mb-3 text-eyebrow">Custom itinerary builder</p>
              <h1 className="mb-3 text-display text-slate-900">Tell us about your trip</h1>
              <p className="mx-auto max-w-lg text-body text-slate-600">
                Two questions — then you'll be on a map of curated stops you can rearrange into
                your day. No package required.
              </p>
            </header>

            <div className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-200 md:p-7">
              <IntakeForm />
            </div>

            <p className="mt-8 text-center text-micro text-slate-500">
              Seoul + DMZ rollout planned after MVP launch.
            </p>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
