// data/tours.ts

export type Destination = "Seoul" | "Busan" | "Jeju";

export type ScheduleItem = {
  time: string;        // "09:00"
  title: string;       // "Hotel pickup"
  description?: string; // 선택 설명
};

export type DetailedTour = {
  id: number;
  city: Destination;
  tag: string;
  title: string;
  price: string;
  imageUrl: string;

  // 오른쪽 정보 영역
  duration: string;        // "09:00–17:00 · 8 hours"
  lunchIncluded: boolean;
  ticketIncluded: boolean;
  pickupInfo: string;
  notes?: string;

  // Apple Travel style 일정표
  schedule?: ScheduleItem[];

  // Future properties for richer tour details
  slug?: string;
  reviews?: any[];
  galleryImages?: string[];
  subtitle?: string;
  description?: string;
  highlights?: string[];
  includes?: string[];
  excludes?: string[];
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
    schedule: [
      {
        time: "09:00",
        title: "Hotel pickup",
        description: "Pickup in Busan Station, Seomyeon or Haeundae area.",
      },
      {
        time: "10:00",
        title: "Gamcheon Culture Village",
        description: "Colorful hillside village, photo spots and street art.",
      },
      {
        time: "12:30",
        title: "Local lunch",
        description: "Try Busan-style dishes at a local restaurant.",
      },
      {
        time: "14:00",
        title: "Gwangan Bridge coastal drive",
        description: "Scenic drive along the coast towards Haeundae.",
      },
      {
        time: "15:00",
        title: "Haeundae Beach & Dongbaek Island",
        description: "Easy walk with ocean views and picture spots.",
      },
      {
        time: "17:00",
        title: "Drop-off",
        description: "Return to your hotel or preferred drop-off point.",
      },
    ],
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
    schedule: [
      {
        time: "09:00",
        title: "Hotel pickup",
        description: "Pickup in Jeju City, Aewol or Hamdeok area.",
      },
      {
        time: "10:00",
        title: "Seongsan Ilchulbong (Sunrise Peak)",
        description: "Walk up to the crater and enjoy the UNESCO ocean view.",
      },
      {
        time: "12:30",
        title: "Free time for lunch",
        description: "Seafood or local dishes near Seongsan (own expense).",
      },
      {
        time: "14:00",
        title: "Manjanggul Lava Tube",
        description: "Explore one of the longest lava tubes in the world.",
      },
      {
        time: "16:30",
        title: "Coastal photo stops",
        description: "Short stops at scenic viewpoints on the east coast.",
      },
      {
        time: "18:00",
        title: "Drop-off",
        description: "Return to your hotel or airport on request.",
      },
    ],
  },
  // 여기부터 계속 같은 형태로 상품 추가하면 됩니다.
];
