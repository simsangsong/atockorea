import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type VideoLanguageCode, videoLanguageProfile } from '@/lib/video-automation/languages';
import type { VideoLocalizedPoiContent, VideoPoiSource } from '@/lib/video-automation/types';

export interface ResolvePoiSourceOptions {
  poi: string;
  tour?: string;
  languages: VideoLanguageCode[];
}

interface StaticStopMatch {
  tourSlug: string;
  sourcePath: string;
  locale: string;
  stop: Record<string, unknown>;
  poiKey: string;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function slugLike(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function toRepoRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function stopPoiKey(stop: Record<string, unknown>): string | null {
  const meta = stop._poi_meta;
  if (meta && typeof meta === 'object') {
    const key = (meta as Record<string, unknown>).poi_key;
    if (typeof key === 'string' && key.trim()) return key.trim();
  }
  return null;
}

function stopMatches(stop: Record<string, unknown>, requestedPoi: string): boolean {
  const key = stopPoiKey(stop);
  if (key === requestedPoi) return true;
  const requestedSlug = slugLike(requestedPoi);
  if (key && slugLike(key).includes(requestedSlug)) return true;
  const name = cleanText(stop.name);
  return Boolean(name && slugLike(name).includes(requestedSlug));
}

function findStopInPayload(payload: Record<string, unknown>, requestedPoi: string): Record<string, unknown> | null {
  const stops = Array.isArray(payload.itineraryStops) ? payload.itineraryStops : [];
  for (const stop of stops) {
    if (stop && typeof stop === 'object' && stopMatches(stop as Record<string, unknown>, requestedPoi)) {
      return stop as Record<string, unknown>;
    }
  }
  return null;
}

function findStaticStop(root: string, requestedPoi: string, tourSlug?: string): StaticStopMatch | null {
  const base = path.join(root, 'components', 'product-tour-static');
  if (!existsSync(base)) return null;
  const tourDirs = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'catalog')
    .map((entry) => entry.name)
    .filter((name) => !tourSlug || name === tourSlug);

  for (const slug of tourDirs) {
    const sourcePath = path.join(base, slug, `${slug}.en.json`);
    if (!existsSync(sourcePath)) continue;
    const payload = readJson(sourcePath);
    const stop = findStopInPayload(payload, requestedPoi);
    if (!stop) continue;
    return {
      tourSlug: slug,
      sourcePath,
      locale: 'en',
      stop,
      poiKey: stopPoiKey(stop) ?? requestedPoi,
    };
  }
  return null;
}

function localizedStop(
  root: string,
  match: StaticStopMatch,
  sourceLocale: string,
): { stop: Record<string, unknown>; sourcePath: string; locale: string } | null {
  const filePath = path.join(root, 'components', 'product-tour-static', match.tourSlug, `${match.tourSlug}.${sourceLocale}.json`);
  if (!existsSync(filePath)) return null;
  const payload = readJson(filePath);
  const stop = findStopInPayload(payload, match.poiKey);
  if (!stop) return null;
  return { stop, sourcePath: filePath, locale: sourceLocale };
}

function objectStrings(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const text = cleanText(raw);
    if (text) out[key] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function factIdsFor(root: string, sourcePath: string, stop: Record<string, unknown>): string[] {
  const rel = toRepoRelative(root, sourcePath);
  const meta = stop._poi_meta && typeof stop._poi_meta === 'object' ? (stop._poi_meta as Record<string, unknown>) : {};
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  return [
    `file:${rel}`,
    ...sources
      .filter((source): source is string => typeof source === 'string' && source.trim() !== '')
      .slice(0, 6)
      .map((source, index) => `source:${index + 1}:${source}`),
  ];
}

function imageCreditsFromStop(stop: Record<string, unknown>): Array<{ url: string; source?: string }> {
  if (!Array.isArray(stop.imageCredits)) return [];
  return stop.imageCredits
    .map((credit) => (credit && typeof credit === 'object' ? (credit as Record<string, unknown>) : null))
    .filter((credit): credit is Record<string, unknown> => credit !== null)
    .map((credit) => ({ url: cleanText(credit.url), source: cleanText(credit.source) || undefined }))
    .filter((credit) => credit.url !== '');
}

function contentFromStop(
  root: string,
  language: VideoLanguageCode,
  sourceLocale: string,
  sourcePath: string,
  stop: Record<string, unknown>,
): VideoLocalizedPoiContent {
  const highlights = Array.isArray(stop.highlights)
    ? stop.highlights.map(cleanText).filter(Boolean).slice(0, 8)
    : [];
  const images = Array.isArray(stop.images) ? stop.images.map(cleanText).filter(Boolean).slice(0, 24) : [];
  const imageCredits = imageCreditsFromStop(stop);
  return {
    language,
    sourceLocale,
    name: cleanText(stop.name) || cleanText(stop.title) || 'Unknown POI',
    category: cleanText(stop.category),
    description: cleanText(stop.description || stop.whyOnRoute),
    image: cleanText(stop.image),
    images: images.length > 0 ? images : undefined,
    imageCredits: imageCredits.length > 0 ? imageCredits : undefined,
    highlights,
    visitBasics: objectStrings(stop.visitBasics),
    convenience: objectStrings(stop.convenience),
    smartNotes: objectStrings(stop.smartNotes),
    sourceFactIds: factIdsFor(root, sourcePath, stop),
    sourcePath: toRepoRelative(root, sourcePath),
  };
}

function sourceFromStaticStop(root: string, match: StaticStopMatch, languages: VideoLanguageCode[]): VideoPoiSource {
  const localized: VideoPoiSource['localized'] = {};
  const sourcePaths = new Set<string>([toRepoRelative(root, match.sourcePath)]);

  for (const language of languages) {
    const profile = videoLanguageProfile(language);
    const found = localizedStop(root, match, profile.sourceLocale);
    const stop = found?.stop ?? match.stop;
    const sourcePath = found?.sourcePath ?? match.sourcePath;
    sourcePaths.add(toRepoRelative(root, sourcePath));
    localized[language] = contentFromStop(root, language, found?.locale ?? match.locale, sourcePath, stop);
  }

  const canonicalName = localized.en?.name ?? Object.values(localized)[0]?.name ?? match.poiKey;
  return {
    poiId: match.poiKey,
    canonicalName,
    tourSlug: match.tourSlug,
    localized,
    sourcePaths: [...sourcePaths],
  };
}

function sourceFromPoiKb(root: string, poi: string, languages: VideoLanguageCode[]): VideoPoiSource | null {
  const filePath = path.join(root, 'data', 'poi_kb', 'poi_knowledge_base_v1.29.json');
  if (!existsSync(filePath)) return null;
  const kb = readJson(filePath);
  const entry = kb[poi];
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const smartNotes = objectStrings(row.smartNotes);
  const visitBasics = objectStrings(row.visitBasics);
  const convenience = objectStrings(row.convenience);
  const fallbackName = poi.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  const localized: VideoPoiSource['localized'] = {};
  for (const language of languages) {
    localized[language] = {
      language,
      sourceLocale: 'en',
      name: fallbackName,
      description: [smartNotes?.photo, smartNotes?.tip].filter(Boolean).join(' '),
      highlights: [smartNotes?.photo, smartNotes?.facilities, smartNotes?.tip].filter(Boolean) as string[],
      visitBasics,
      convenience,
      smartNotes,
      sourceFactIds: [`file:${toRepoRelative(root, filePath)}`, `poi_kb:${poi}`],
      sourcePath: toRepoRelative(root, filePath),
    };
  }
  return {
    poiId: poi,
    canonicalName: fallbackName,
    localized,
    sourcePaths: [toRepoRelative(root, filePath)],
  };
}

export function resolvePoiSource(root: string, options: ResolvePoiSourceOptions): VideoPoiSource {
  const match = findStaticStop(root, options.poi, options.tour);
  if (match) return sourceFromStaticStop(root, match, options.languages);
  const kb = sourceFromPoiKb(root, options.poi, options.languages);
  if (kb) return kb;
  throw new Error(`POI not found in static tour JSON or poi_kb: ${options.poi}`);
}
