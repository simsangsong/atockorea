/**
 * Normalized Tour API gallery candidate (search + detail rows).
 */

export type JejuGalleryCandidateSourceApi = 'PhotoGalleryService1';

export type JejuGalleryCandidate = {
  galleryTitle: string | null;
  galTitle: string | null;
  galContentId: string | null;
  imageUrl: string;
  thumbUrl: string | null;
  photographyMonth: string | null;
  photographyLocation: string | null;
  galleryGroupTitle: string | null;
  galSearchKeyword: string | null;
  modifiedTime: string | null;
  sourceApi: JejuGalleryCandidateSourceApi;
  /** Detail/search query title used for this fetch path. */
  sourceTitleQueried: string | null;
};

export type JejuGalleryScoreBreakdown = {
  /** 0–1 title similarity (POI title vs gallery row title fields). */
  titleSimilarity: number;
  /** 0–1 best alias / normalized-title match. */
  aliasSimilarity: number;
  /** 0–0.08 bonus if photography location looks Jeju-related. */
  jejuLocationBonus: number;
  /** 0–0.08 bonus if search keyword hints POI. */
  keywordBonus: number;
  /** 0–0.12 penalty if gallery title looks like a broad area hub. */
  broadTitlePenalty: number;
  /** Sum of components (deterministic). */
  total: number;
};
