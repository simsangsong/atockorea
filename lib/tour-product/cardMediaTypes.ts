export type TourProductCardMedia = {
  slug: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  cardImageUrl: string | null;
  sourceLocale: string | null;
  updatedAt: string | null;
};

export type TourProductCardMediaMap = Record<string, TourProductCardMedia>;
