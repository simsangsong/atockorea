// data/tours.ts

export type Destination = "Seoul" | "Busan" | "Jeju";

export type ScheduleItem = {
  time: string; // "09:00"
  title: string; // "Hotel pickup"
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
  duration: string; // "09:00–17:00 · 8 hours"
  lunchIncluded: boolean;
  ticketIncluded: boolean;
  pickupInfo: string;
  notes?: string;

  // Apple Travel style 일정표
  schedule?: ScheduleItem[];

  // 상세 페이지용 추가 필드
  slug?: string;
  reviews?: any[];
  galleryImages?: string[];
  subtitle?: string;
  description?: string;
  highlights?: string[];
  includes?: string[];
  excludes?: string[];

  // FAQ (선택)
  faqs?: { question: string; answer: string }[];
};

export const detailedTours: DetailedTour[] = [
  // ===== JEJU =====
  {
    id: 1,
    city: "Jeju",
    slug: "jeju-eastern-unesco-spots-day-tour",
    tag: "Jeju · Day tour",
    title: "Jeju: Eastern UNESCO Join in Tour (Seongsan, Haenyeo Show)",
    price: "from €46.81 / person",
    imageUrl:
      "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80",
    duration: "08:30–18:00 · 10 hours",
    lunchIncluded: false,
    ticketIncluded: true,
    pickupInfo: "4 pickup locations: Ocean Suites Jeju Hotel, Jeju International Airport, LOTTE City Hotel Jeju, Shilla Duty-Free Jeju Store",
    notes: "Top rated. Free cancellation up to 24 hours in advance. Reserve now & pay later. Live tour guide (English).",
    subtitle: "Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island. Learn about the island's legendary Haenyeo and discover Micheongul Cave.",
    description: "Discover the enchanting beauty of Jeju Island with our all-inclusive Eastern Euphoria One Day Tour. Jeju, the longest island in Korea, is filled with breathtaking landscapes, UNESCO World Heritage Sites, and unique cultural treasures—and we bring them all to you in one seamless journey.",
    highlights: [
      "Experience Jeju's UNESCO World Heritage Sites in one unforgettable day",
      "Enjoy a hassle-free trip with all admission fees included in one booking",
      "Explore the wonders of a lava tube cave system, a rare geological treasure",
      "Join easily from 4 convenient pickup locations across Jeju City",
      "Learn more with insights from our professional English-speaking guide",
    ],
    includes: [
      "Admission to all admission fees",
      "English-speaking professional guide",
      "A vehicle (Van or Bus) & Driver",
      "Toll fees",
      "Parking fees",
      "Fuel fees",
      "No Shopping",
    ],
    excludes: [
      "Lunch (food) Fees",
      "Personal expenses",
      "Tips or additional fees",
      "Personal travel insurance",
    ],
    schedule: [
      {
        time: "08:30",
        title: "Pickup - Ocean Suites Jeju Hotel",
        description: "Pickup from Ocean Suites Jeju Hotel at 08:30",
      },
      {
        time: "08:45",
        title: "Pickup - Jeju International Airport",
        description: "Jeju Airport 3rd Floor, Gate 3 (Domestic Departures) at 8:45",
      },
      {
        time: "08:55",
        title: "Pickup - LOTTE City Hotel Jeju",
        description: "LOTTE City Hotel Jeju at 08:55",
      },
      {
        time: "09:05",
        title: "Pickup - Shilla Duty-Free Jeju Store",
        description: "Shilla Duty-Free Jeju Store at 09:05",
      },
      {
        time: "09:45",
        title: "Bus/coach",
        description: "Travel to first destination (40 minutes)",
      },
      {
        time: "10:25",
        title: "Hamdeok Beach",
        description: "Break time, Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way (1 hour)",
      },
      {
        time: "11:45",
        title: "Haenyeo Museum",
        description: "Photo stop, Visit, Guided tour, Sightseeing, Walk, Scenic views on the way, Arts & crafts market visit (50 minutes)",
      },
      {
        time: "13:00",
        title: "Local restaurant",
        description: "Lunch (1 hour) Extra fee",
      },
      {
        time: "14:30",
        title: "Seongsan Ilchulbong",
        description: "Photo stop, Visit, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way (1 hour)",
      },
      {
        time: "15:45",
        title: "Ilchul Land (Michiangul Cave)",
        description: "Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way (1 hour)",
      },
      {
        time: "17:00",
        title: "Seongeup Folk Village",
        description: "Photo stop, Visit, Guided tour, Free time, Sightseeing, Class, Scenic views on the way (1 hour)",
      },
      {
        time: "18:00",
        title: "Bus/coach",
        description: "Return journey (30 minutes)",
      },
      {
        time: "18:30",
        title: "Dongmun Traditional Market (Optional)",
        description: "Hop-on Hop-off stop (5 minutes) Optional",
      },
      {
        time: "18:35",
        title: "Drop-off",
        description: "4 drop-off locations: Jeju International Airport, LOTTE City Hotel Jeju, Shilla Duty-Free Jeju Store, Ocean Suites Jeju Hotel",
      },
    ],
    faqs: [
      {
        question: "Is lunch included in this tour?",
        answer: "Lunch is provided at a local restaurant. Lunch cost not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals.",
      },
      {
        question: "What should I bring?",
        answer: "Comfortable shoes, warm clothing, comfortable clothes, cash, and weather-appropriate clothing.",
      },
      {
        question: "Can I bring luggage?",
        answer: "You can start your journey immediately with your luggage at the airport. Please let us know the amount of luggage in advance.",
      },
    ],
  },

  // ===== JEJU – EAST (PRIVATE) =====
  {
    id: 2,
    city: "Jeju",
    slug: "jeju-east-unesco-highlights",
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
    galleryImages: [
      "https://images.pexels.com/photos/248771/pexels-photo-248771.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=800",
    ],
    subtitle: "Seongsan Ilchulbong · Manjanggul Lava Tube · Coastal Views",
    description:
      "Private day tour covering East Jeju’s signature UNESCO sites. Enjoy a flexible schedule with your own driver-guide.",
    highlights: [
      "Climb Seongsan Ilchulbong for crater and ocean views",
      "Explore Manjanggul Lava Tube, one of the world's longest lava caves",
      "Flexible stops along the east coast for scenic photos",
      "Private vehicle just for your group",
    ],
    includes: [
      "Private vehicle with driver-guide",
      "Parking fees",
      "Fuel & toll fees",
    ],
    excludes: [
      "Entry tickets",
      "Lunch",
      "Personal expenses",
      "Travel insurance",
    ],
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
    faqs: [
      {
        question: "Is this tour suitable for families with children?",
        answer:
          "Yes. The walking parts can be adjusted and our driver-guide can suggest easier paths for kids and seniors.",
      },
      {
        question: "Can we change the pickup location?",
        answer:
          "Pickup in Jeju City / Aewol / Hamdeok is free. For other locations, please contact us after booking.",
      },
    ],
  },

  // ===== JEJU – SOUTHWEST =====
  {
    id: 3,
    city: "Jeju",
    slug: "jeju-southwest-unesco-tour",
    tag: "Jeju · Private / Small-group",
    title: "Jeju Southwestern UNESCO & Nature Highlights",
    price: "from US$85 / person",
    imageUrl:
      "https://images.pexels.com/photos/3732908/pexels-photo-3732908.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: "09:00–18:00 · 9 hours",
    lunchIncluded: false,
    ticketIncluded: true,
    pickupInfo: "Jeju City hotels / Shilla Duty Free / Airport pickup on request",
    notes:
      "Flexible itinerary. English / Chinese speaking guide available. Small-group or private option.",
    galleryImages: [
      "https://images.pexels.com/photos/3732908/pexels-photo-3732908.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/3662895/pexels-photo-3662895.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/4171216/pexels-photo-4171216.jpeg?auto=compress&cs=tinysrgb&w=800",
    ],
    subtitle: "Hallasan · Camellia Hill · Cheonjeyeon · Jusangjeolli · O'sulloc",
    description:
      "Discover the most beautiful sights in Jeju’s southwestern coast including waterfalls, volcanic cliffs, botanical gardens, and Mt. Hallasan views.",
    highlights: [
      "See the panoramic view of Mt. Hallasan from the southern route",
      "Visit Camellia Hill Botanical Garden with seasonal blooms",
      "Gaze at volcanic lava rock formations at Jusangjeolli Cliff",
      "Cheonjeyeon Falls — one of Jeju’s most iconic waterfalls",
      "Relax at O'sulloc Tea Museum with green tea desserts",
      "4 pickup & 4 drop-off locations for flexible travel",
    ],
    includes: [
      "All entry tickets (admission fees)",
      "UNESCO guided tour",
      "English / Chinese-speaking guide",
      "Parking fee",
      "Fuel fee",
      "No shopping guaranteed",
    ],
    excludes: ["Food (Lunch fees)", "Personal expenses", "Travel insurance"],
    schedule: [
      {
        time: "09:00",
        title: "Hotel pickup",
        description:
          "Pickup in Jeju City, Shilla Duty Free, or airport on request.",
      },
      {
        time: "09:40",
        title: "Hallasan southern scenic point",
        description: "Best photo spot for mountain view. Stay approx. 20 min.",
      },
      {
        time: "10:30",
        title: "Camellia Hill Botanical Garden",
        description: "Guided walk. Seasonal flowers and forest paths.",
      },
      {
        time: "12:00",
        title: "Local restaurant",
        description: "Lunch (own expense). Seafood / traditional Jeju dishes.",
      },
      {
        time: "13:30",
        title: "Cheonjeyeon Falls",
        description: "Beautiful 3-tier waterfall and arched bridge.",
      },
      {
        time: "15:00",
        title: "Jusangjeolli Cliff",
        description:
          "Famous volcanic columnar joint cliff. Scenic ocean viewpoint.",
      },
      {
        time: "16:00",
        title: "O’sulloc Tea Museum",
        description: "Free time, green tea ice cream, souvenirs.",
      },
      {
        time: "17:40",
        title: "Drop-off",
        description:
          "Return to hotel or Jeju City. Airport drop available upon request.",
      },
    ],
    reviews: [
      {
        id: 1,
        author: "Anna · United States",
        rating: 5,
        date: "2025-09-12",
        title: "Amazing scenery!",
        content:
          "Hallasan view was unforgettable. The guide was super friendly and took great pictures for us.",
        helpfulVotes: 12,
      },
      {
        id: 2,
        author: "Luis · Spain",
        rating: 5,
        date: "2025-08-30",
        title: "Perfect southwest Jeju day",
        content:
          "The cliffs and waterfalls were the highlight. The timing was perfect and not rushed.",
        helpfulVotes: 7,
      },
    ],
  },

  // ===== JEJU – EAST SMALL-GROUP (HAENYEO) =====
  {
    id: 4,
    city: "Jeju",
    slug: "jeju-east-unesco-explorer",
    tag: "Jeju · Small-group",
    title: "Jeju East UNESCO Explorer (Haenyeo Show Included)",
    price: "from US$80 / person",
    imageUrl:
      "https://images.pexels.com/photos/3732908/pexels-photo-3732908.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: "08:30–17:30 · 9 hours",
    lunchIncluded: false,
    ticketIncluded: true,
    pickupInfo:
      "Pickup from Lotte Duty Free Shop (Jeju Airport Branch) or Ocean Suites Jeju Hotel",
    notes:
      "Small-group guided tour. Haenyeo show included (subject to weather). English guide available.",
    galleryImages: [
      "https://images.pexels.com/photos/237211/pexels-photo-237211.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/248771/pexels-photo-248771.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=800",
    ],
    subtitle:
      "Hamdeok · Haenyeo Museum · Seongsan Ilchulbong · Seopjikoji · Seongeup Village",
    description:
      "Explore the best UNESCO and cultural highlights of eastern Jeju in one full-day guided trip.",
    highlights: [
      "Walk along the pristine white sand beach of Hamdeok",
      "Watch the Haenyeo women divers' live performance (weather dependent)",
      "Climb Seongsan Ilchulbong (UNESCO) for crater and ocean views",
      "Visit Seopjikoji, one of Jeju’s most scenic coastal capes",
      "Explore Seongeup Folk Village and experience local culture",
      "Two pickup locations in Jeju City for convenience",
    ],
    includes: [
      "English-speaking guide",
      "Air-conditioned tour vehicle",
      "All entry tickets",
      "Parking fees",
      "Toll fees",
      "Haenyeo show admission",
    ],
    excludes: ["Lunch", "Personal expenses", "Travel insurance", "Tips"],
    schedule: [
      {
        time: "08:30",
        title: "Pickup – Lotte Duty Free Shop",
        description: "Next to Lotte City Hotel, Jeju Airport area.",
      },
      {
        time: "08:50",
        title: "Pickup – Ocean Suites Jeju Hotel",
        description: "In front of the hotel entrance.",
      },
      {
        time: "09:20",
        title: "Hamdeok Beach",
        description: "Free walk along turquoise water. (1 hour)",
      },
      {
        time: "10:40",
        title: "Haenyeo Museum + Haenyeo Live Show",
        description:
          "Learn Jeju Haenyeo culture and watch real divers. (40 minutes)",
      },
      {
        time: "12:00",
        title: "Seongsan Ilchulbong (UNESCO)",
        description:
          "Hike to the tuff cone crater and enjoy ocean views. (2 hours)",
      },
      {
        time: "14:10",
        title: "Seopjikoji",
        description: "Coastal walk & photo time at Jeju’s famous cape. (40 minutes)",
      },
      {
        time: "15:30",
        title: "Seongeup Folk Village",
        description: "Explore a preserved traditional village. (1 hour)",
      },
      {
        time: "17:30",
        title: "Drop-off",
        description: "Return to Lotte Duty Free or Ocean Suites.",
      },
    ],
    reviews: [
      {
        id: 1,
        author: "Mia · Singapore",
        rating: 5,
        date: "2025-03-22",
        title: "Perfect eastern Jeju tour",
        content:
          "Beautiful scenery and a very friendly guide. Seongsan Ilchulbong was the highlight!",
        helpfulVotes: 9,
      },
      {
        id: 2,
        author: "Ken · USA",
        rating: 5,
        date: "2025-02-10",
        title: "Great Haenyeo show experience",
        content:
          "The Haenyeo story was unforgettable. Highly recommend this tour for first-time visitors.",
        helpfulVotes: 4,
      },
    ],
    faqs: [
      {
        question: "Is lunch included in this tour?",
        answer:
          "Lunch is not included. Your guide will recommend local restaurants where you can choose and pay on the spot.",
      },
      {
        question: "What happens if the Haenyeo show is cancelled due to weather?",
        answer:
          "If the Haenyeo show is cancelled, we will replace it with another cultural stop or give you more time at nearby attractions.",
      },
      {
        question: "Can I join the tour from outside Jeju City?",
        answer:
          "The main pickup points are Lotte Duty Free Jeju Airport Branch and Ocean Suites Jeju Hotel. If you stay in another area, you can come to one of these points by taxi or bus.",
      },
    ],
  },
];
