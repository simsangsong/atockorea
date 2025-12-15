// app/seoul/page.tsx
import TourCard, { Tour } from "../../components/TourCard";

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

const seoulTours: Tour[] = [
  {
    slug: "seoul-palace-market-tour",
    city: "Seoul",
    tag: "Seoul · Day tour",
    title: "Seoul Palace & Market Tour",
    desc: "Small-group · hotel pickup",
    price: "from US$69 / person",
    href: "/seoul/seoul-palace-market-tour",
  },
  {
    slug: "seoul-culture-village-tour",
    city: "Seoul",
    tag: "Seoul · Day tour",
    title: "Seoul Culture Village & Traditional Experience",
    desc: "Small-group · cultural immersion",
    price: "from US$75 / person",
    href: "/seoul/seoul-culture-village-tour",
  },
];

export default function SeoulPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
      <h1 className="text-[18px] font-semibold mb-1">Seoul Tours</h1>
      <p className="mb-2 text-[12px] text-gray-600">
        Local-based tours in Seoul with trusted agencies and guides.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {seoulTours.map((tour) => (
          <TourCard key={tour.slug} tour={tour} />
        ))}
      </div>
    </div>
  );
}

