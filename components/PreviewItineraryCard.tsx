"use client";

import { useCopy } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";

export default function PreviewItineraryCard() {
  const copy = useCopy();
  const p = copy.previewItinerary;
  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-[#F5F7FA]" aria-labelledby="preview-itinerary-heading">
      <div className="container mx-auto max-w-2xl">
        <h2 id="preview-itinerary-heading" className="text-xl md:text-2xl font-bold text-[#1A1A1A] mb-6 text-center">
          Example itinerary
        </h2>
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle className="text-lg text-[#1A1A1A]">{p.title}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="info" size="sm">{p.pickupArea}</Badge>
              <Badge variant="neutral" size="sm">{p.hotelFitHint}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#666666]">
            <p>{p.travelerCount} · {p.vehicleType}</p>
            <p>{p.paymentNote}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
