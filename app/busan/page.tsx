// app/busan/page.tsx
import TourCard, { Tour } from "../../components/TourCard";

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';


const busanTours: Tour[] = [
  {
    slug: "jeju-eastern-unesco-spots-day-tour",
    city: "Jeju",
    tag: "Jeju · Day tour",
    title: "Jeju: Eastern Jeju UNESCO Spots Day Tour",
    desc: "Top rated · 4 pickup locations",
    price: "from €46 / person",
    href: "/jeju/jeju-eastern-unesco-spots-day-tour",
  },
  {
    slug: "gwangalli-night-food",
    city: "Busan",
    tag: "Busan · Night tour",
    title: "Gwangalli night view & local food",
    desc: "3–4 hours · foodie style",
    price: "from US$65 / person",
    href: "/busan/gwangalli-night-food",
  },
];

export default function BusanPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
      <h1 className="text-[18px] font-semibold mb-1">Busan Tours</h1>
      <p className="mb-2 text-[12px] text-gray-600">
        Local-based tours in Busan with trusted agencies and guides.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {busanTours.map((tour) => (
          <TourCard key={tour.slug} tour={tour} />
        ))}
      </div>
    </div>
  );
}
