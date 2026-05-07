// app/jeju/page.tsx
import TourCard, { Tour } from "../../components/TourCard";

const jejuTours: Tour[] = [
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
    slug: "jeju-southwest-unesco-tour",
    city: "Jeju",
    tag: "Jeju · Private / Small-group",
    title: "Jeju Southwestern UNESCO & Nature Highlights",
    desc: "Private van · flexible schedule",
    price: "from US$85 / person",
    href: "/jeju/jeju-southwest-unesco-tour",
  },
  {
    slug: "jeju-east-unesco-highlights",
    city: "Jeju",
    tag: "Jeju · Private",
    title: "East Jeju UNESCO Highlights",
    desc: "Private van · flexible schedule",
    price: "from US$290 / group",
    href: "/jeju/jeju-east-unesco-highlights",
  },
];

export default function JejuPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
      <h1 className="text-[18px] font-semibold mb-1">Jeju Tours</h1>
      <p className="mb-2 text-[12px] text-gray-600">
        Local-based tours in Jeju with trusted agencies and guides.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {jejuTours.map((tour) => (
          <TourCard key={tour.slug} tour={tour} />
        ))}
      </div>
    </div>
  );
}

