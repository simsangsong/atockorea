import { z } from 'zod';

export const saveItineraryBodySchema = z.object({
  title: z.string().max(300).optional().nullable(),
  summary: z.string().max(4000).optional().nullable(),
  requestJson: z.record(z.unknown()),
  itineraryJson: z.record(z.unknown()),
  isFavorite: z.boolean().optional(),
});

export type SaveItineraryBody = z.infer<typeof saveItineraryBodySchema>;

export const patchSavedItineraryBodySchema = z.object({
  title: z.string().max(300).optional().nullable(),
  summary: z.string().max(4000).optional().nullable(),
  isFavorite: z.boolean().optional(),
});

export type PatchSavedItineraryBody = z.infer<typeof patchSavedItineraryBodySchema>;
