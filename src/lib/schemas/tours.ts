import { z } from "zod";
import { BookingTimelineSchema } from "../schemas/booking";

export const BuildTourRequestSchema = z.object({
  destination: z.literal("jeju"),
  hotelId: z.string().optional(),
  hotelName: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  pickupAreaLabel: z.string().optional(),
  date: z.string(),
  guests: z.number().min(1),
  styleTags: z.array(z.string()),
  preferredType: z.enum(["private", "join", "both"]),
});

export const PickupInfoSchema = z.object({
  areaLabel: z.string(),
  surchargeLabel: z.string().nullable(),
  surchargeAmount: z.number(),
  surchargeFinal: z.boolean(),
  joinAvailable: z.boolean(),
});

export const TourCardViewModelSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["private", "join", "bus"]),
  tags: z.array(z.string()),
  priceFrom: z.number(),
  originalPrice: z.number().nullable().optional(),
  currency: z.string(),
  pickup: PickupInfoSchema,
  matchQuality: z.enum(["great", "good", "slight"]).optional(),
  joinStatus: z
    .enum([
      "waiting",
      "balance_open",
      "confirmed",
      "missed_deadline",
      "private_only",
      "join_unavailable",
    ])
    .optional(),
  travelersJoined: z.number().optional(),
  maxTravelers: z.number().optional(),
  imageUrl: z.string().optional(),
  duration: z.string().optional(),
  city: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  bookingCount: z.number().optional(),
});

export const BuildTourResponseSchema = z.object({
  searchSummary: z.object({
    destination: z.literal("jeju"),
    pickupAreaLabel: z.string(),
    date: z.string(),
    guests: z.number(),
    styleTags: z.array(z.string()),
  }),
  recommended: z.array(TourCardViewModelSchema),
  privateTours: z.array(TourCardViewModelSchema),
  joinTours: z.array(TourCardViewModelSchema),
  busTours: z.array(TourCardViewModelSchema),
});

const ItineraryItemSchema = z.object({
  time: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const PickupPointSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  pickup_time: z.string().nullable().optional(),
});

export const TourDetailViewModelSchema = z.object({
  id: z.string(),
  /** DB slug — used to pick v0 detail template vs classic small-group layout */
  slug: z.string().optional(),
  title: z.string(),
  type: z.enum(["private", "join", "bus"]),
  tagline: z.string().optional(),
  city: z.string(),
  rating: z.number(),
  reviewCount: z.number(),
  badges: z.array(z.string()),
  price: z.number(),
  originalPrice: z.number().nullable(),
  priceType: z.enum(["person", "group"]),
  duration: z.string(),
  difficulty: z.string().optional(),
  groupSize: z.string().optional(),
  highlight: z.string().optional(),
  images: z.array(z.object({ url: z.string(), title: z.string().optional(), description: z.string().optional() })),
  itinerary: z.array(ItineraryItemSchema),
  itineraryDetails: z.array(z.object({ time: z.string(), activity: z.string(), description: z.string(), images: z.array(z.string()).optional() })).optional(),
  overview: z.string(),
  pickup: PickupInfoSchema,
  pickupPoints: z.array(PickupPointSchema),
  inclusions: z.array(z.union([z.string(), z.object({ icon: z.string(), text: z.string() })])),
  exclusions: z.array(z.union([z.string(), z.object({ icon: z.string(), text: z.string() })])),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  highlights: z.array(z.string()).optional(),
  whyThisFitsYou: z.array(z.string()),
  whoThisIsBestFor: z.array(z.string()),
  cancellationPolicy: z.string(),
  joinStatus: z.enum(["waiting", "balance_open", "confirmed", "missed_deadline", "private_only", "join_unavailable"]).optional(),
  travelersJoined: z.number().optional(),
  maxTravelers: z.number().optional(),
  childEligibility: z.array(z.object({
    id: z.string(),
    num: z.number().optional(),
    num1: z.number().optional(),
    num2: z.number().optional(),
    num3: z.number().optional(),
    text: z.string().optional(),
  })).optional(),
  bookingTimeline: BookingTimelineSchema.nullable().optional(),
});
