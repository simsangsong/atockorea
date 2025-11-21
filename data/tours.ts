// data/tours.ts

export type Destination = "Seoul" | "Busan" | "Jeju";

export type DetailedTour = {
  id: number;
  city: Destination;
  tag: string;
  title: string;
  price: string;
  imageUrl: string;
  duration: string;
  lunchIncluded: boolean;
  ticketIncluded: boolean;
  pickupInfo: string;
  notes?: string;
};

export const detailedTours: DetailedTour[] = [
  {
    id: 1,
    city: "Busan",
    tag: "Busan · Day tour",
    title: "Gamcheon Culture Village + Haeundae Coastal Line",
    price: "from US$79 / person",
    imageUrl:
      "https://images.pexels.com/photos/237211/pexels-photo-237211.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: "09:00–17:00 · 8 hours",
    lunchIncluded: true,
    ticketIncluded: true,
    pickupInfo: "Busan Station / Seomyeon / Haeundae hotel pickup",
    notes: "Small group (max 8 guests). English / Chinese guide available.",
  },
  {
    id: 2,
    city: "Jeju",
    tag: "Jeju · Private",
    title: "East Jeju UNESCO Highlights (Seongsan + Manjanggul)",
    price: "from US$290 / group (up to 7 pax)",
    imageUrl:
      "https://images.pexels.com/photos/248771/pexels-photo-248771.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: "09:00–18:00 · 9 hours",
    lunchIncluded: false,
    ticketIncluded: false,
    pickupInfo: "Jeju City / Aewol / Hamdeok hotel pickup",
    notes: "Flexible itinerary, English / Chinese speaking driver-guide.",
  },
];
