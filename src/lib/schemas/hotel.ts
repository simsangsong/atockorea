import { z } from "zod";

export const HotelLookupResultSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  lat: z.number(),
  lng: z.number(),
  pickupAreaLabel: z.string(),
  surchargeAmount: z.number(),
  surchargeLabel: z.string().nullable(),
  joinAvailable: z.boolean(),
});

export type HotelLookupResult = z.infer<typeof HotelLookupResultSchema>;
