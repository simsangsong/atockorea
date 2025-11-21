// app/busan/page.tsx
import TourCard, { Tour } from "../../components/TourCard";


const busanTours: Tour[] = [
  {
    slug: "gamcheon-haeundae-small-group",
    city: "Busan",
    tag: "Busan · Day tour",
    title: "Gamcheon Culture Village + Haeundae",
    desc: "Small-group · hotel pickup",
    price: "from US$79 / person",
    href: "/busan/gamcheon-haeundae-small-group",
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
