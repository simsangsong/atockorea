import type { VideoLanguageCode } from '@/lib/video-automation/languages';

export type VideoProjectStatus =
  | 'draft'
  | 'collecting_assets'
  | 'analyzing'
  | 'scripting'
  | 'generating_audio'
  | 'rendering'
  | 'quality_check'
  | 'awaiting_publish_approval'
  | 'published'
  | 'failed';

export interface VideoLocalizedPoiContent {
  language: VideoLanguageCode;
  sourceLocale: string;
  name: string;
  category?: string;
  description?: string;
  image?: string;
  highlights: string[];
  visitBasics?: Record<string, string>;
  convenience?: Record<string, string>;
  smartNotes?: Record<string, string>;
  sourceFactIds: string[];
  sourcePath?: string;
}

export interface VideoPoiSource {
  poiId: string;
  canonicalName: string;
  region?: string | null;
  coordinates?: { latitude: number; longitude: number } | null;
  tourSlug?: string | null;
  localized: Partial<Record<VideoLanguageCode, VideoLocalizedPoiContent>>;
  sourcePaths: string[];
}

export type VideoAssetKind = 'image' | 'video' | 'audio' | 'subtitle' | 'poster' | 'render';
export type VideoLicenseStatus = 'cleared' | 'unknown' | 'restricted';

export interface VideoAsset {
  assetId: string;
  poiId: string;
  kind: VideoAssetKind;
  uri: string;
  fileType?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;
  source?: string | null;
  checksum?: string | null;
  licenseStatus: VideoLicenseStatus;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  publishable: boolean;
  notes?: string[];
}

export interface VideoAssetManifest {
  poiId: string;
  version: number;
  targetLanguages: VideoLanguageCode[];
  assets: VideoAsset[];
  sourceVideoStatus: 'provided' | 'source_pending';
  warnings: string[];
  jobKey: string;
}

export interface VideoScriptScene {
  sceneId: string;
  start: number;
  end: number;
  template: string;
  visualIntent: string;
  narration: string;
  screenText: string;
  assetCandidates: string[];
  sourceFactIds: string[];
}

export interface VideoScript {
  poiId: string;
  duration: number;
  language: VideoLanguageCode;
  sourceLocale: string;
  scenes: VideoScriptScene[];
}

export interface VideoStoryboardScene extends VideoScriptScene {
  layout: 'hero_intro' | 'poi_title' | 'culture_card' | 'must_see' | 'visit_tip' | 'smartguide_cta';
  overlays: Array<{ type: 'title' | 'subtitle' | 'logo' | 'cta' | 'map'; text?: string }>;
  renderNotes: string[];
}

export interface VideoStoryboard {
  poiId: string;
  language: VideoLanguageCode;
  duration: number;
  aspectRatio: '9:16';
  resolution: { width: number; height: number };
  scenes: VideoStoryboardScene[];
}

export interface LanguageOutputPaths {
  language: VideoLanguageCode;
  narrationTextPath: string;
  narrationAudioPath: string | null;
  vttPath: string;
  srtPath: string;
  mp4Path: string | null;
  renderStatus: 'rendered' | 'blocked_by_missing_ffmpeg' | 'render_failed';
}

export interface AppVideoCardPayload {
  type: 'poi_video';
  poiId: string;
  title: string;
  posterUrl: string | null;
  duration: number;
  version: number;
  status: 'draft' | 'awaiting_media_source' | 'awaiting_publish_approval' | 'ready';
  defaultLanguage: VideoLanguageCode;
  languages: Array<{
    language: VideoLanguageCode;
    roomLocale: string;
    streamUrl: string | null;
    fallbackUrl: string | null;
    captionUrl: string | null;
    narrationAudioUrl: string | null;
  }>;
  analyticsEvents: string[];
}

export interface FacebookPublicationPayload {
  target: 'facebook';
  mode: 'dry_run';
  poiId: string;
  version: number;
  duplicateKey: string;
  title: string;
  description: string;
  hashtags: string[];
  coverImagePath: string | null;
  videoPath: string | null;
  requiresApproval: true;
  nativeUpload: true;
  notes: string[];
}

export interface VideoQcReport {
  poiId: string;
  version: number;
  status: 'passed' | 'warning' | 'failed';
  checks: Array<{ name: string; status: 'passed' | 'warning' | 'failed'; detail: string }>;
}
