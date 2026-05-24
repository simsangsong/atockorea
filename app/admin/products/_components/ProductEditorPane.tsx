'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ExternalLink,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  Globe,
  Hash,
  ArrowLeft,
} from 'lucide-react';
import { ALL_LOCALES, LOCALE_FLAGS, LOCALE_LABELS } from '../_hooks/types';
import type { Locale, ProductPageRow } from '../_hooks/types';
import { saveProductPage } from '../_hooks/useProductPage';
import { MediaSection, type MediaState, type GalleryEntry } from './sections/MediaSection';
import { HeroSection, type HeroState } from './sections/HeroSection';
import { ItinerarySection, type ItineraryStop } from './sections/ItinerarySection';
import { FAQSection, type FAQItem } from './sections/FAQSection';

type Props = {
  slug: string;
  row: ProductPageRow | null;
  loading: boolean;
  error: string | null;
  fallbackLocale: string | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onSaved: (next: ProductPageRow) => void;
  onTogglePreview: () => void;
  previewOpen: boolean;
  onBackToList: () => void;
};

const buildSavePatch = (source: ProductPageRow): Partial<ProductPageRow> => ({
  title: source.title,
  subtitle: source.subtitle,
  headline_line_1: source.headline_line_1,
  headline_line_2: source.headline_line_2,
  region_label: source.region_label,
  duration_label: source.duration_label,
  card_short_description: source.card_short_description,
  seo_title: source.seo_title,
  meta_description: source.meta_description,
  is_published: source.is_published,
  hero_image_url: source.hero_image_url,
  thumbnail_url: source.thumbnail_url,
  detail_payload: source.detail_payload,
});

const serializeSavePatch = (source: ProductPageRow): string =>
  JSON.stringify(buildSavePatch(source));

/**
 * Editor pane — for Phase 2-A1 we expose only the basic-info subset
 * (title/subtitle/SEO/hero+thumbnail preview). Subsequent sprints add the
 * media manager, itinerary, gallery, FAQ etc. and replace the old JSON
 * textarea with structured forms.
 */
export function ProductEditorPane({
  slug,
  row,
  loading,
  error,
  fallbackLocale,
  locale,
  onLocaleChange,
  onSaved,
  onTogglePreview,
  previewOpen,
  onBackToList,
}: Props) {
  const [draft, setDraft] = useState<ProductPageRow | null>(row);
  const [saving, setSaving] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestSaveIdRef = useRef(0);
  const lastPersistedSignatureRef = useRef(row ? serializeSavePatch(row) : '');

  useEffect(() => {
    lastPersistedSignatureRef.current = row ? serializeSavePatch(row) : '';
    setDraft(row);
  }, [row]);

  const dirty = (() => {
    if (!draft || !row) return false;
    return (
      draft.title !== row.title ||
      draft.subtitle !== row.subtitle ||
      draft.headline_line_1 !== row.headline_line_1 ||
      draft.headline_line_2 !== row.headline_line_2 ||
      draft.region_label !== row.region_label ||
      draft.duration_label !== row.duration_label ||
      draft.card_short_description !== row.card_short_description ||
      draft.seo_title !== row.seo_title ||
      draft.meta_description !== row.meta_description ||
      draft.is_published !== row.is_published ||
      draft.hero_image_url !== row.hero_image_url ||
      draft.thumbnail_url !== row.thumbnail_url ||
      JSON.stringify(draft.detail_payload) !== JSON.stringify(row.detail_payload)
    );
  })();

  const persistDraft = useCallback(async (
    source: ProductPageRow,
    options: { silent?: boolean } = {},
  ) => {
    const saveId = latestSaveIdRef.current + 1;
    latestSaveIdRef.current = saveId;
    const previousSignature = lastPersistedSignatureRef.current;
    const signature = serializeSavePatch(source);
    lastPersistedSignatureRef.current = signature;
    setSaving(true);

    const run = async () => {
      try {
        const updated = await saveProductPage(slug, locale, buildSavePatch(source));
        if (latestSaveIdRef.current === saveId) {
          lastPersistedSignatureRef.current = serializeSavePatch(updated);
          onSaved(updated);
          if (!options.silent) {
            toast.success('저장되었습니다', {
              description: `${slug} · ${LOCALE_LABELS[locale]}`,
            });
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (latestSaveIdRef.current === saveId) {
          lastPersistedSignatureRef.current = previousSignature;
        }
        toast.error(options.silent ? '미디어 자동 저장 실패' : '저장 실패', { description: msg });
      } finally {
        if (latestSaveIdRef.current === saveId) {
          setSaving(false);
        }
      }
    };

    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(run);
    await saveQueueRef.current;
  }, [locale, onSaved, slug]);

  useEffect(() => {
    if (!draft || !dirty) return;
    const signature = serializeSavePatch(draft);
    if (signature === lastPersistedSignatureRef.current) return;
    const id = window.setTimeout(() => {
      void persistDraft(draft, { silent: true });
    }, 650);
    return () => window.clearTimeout(id);
  }, [dirty, draft, persistDraft]);

  // Media state derived from detail_payload + top-level columns. Saving writes
  // back to all three locations (thumbnail_url, hero_image_url, and the
  // detail_payload's catalog_card/hero/galleryItems) so the live page renders
  // consistently regardless of which path it reads.
  const media: MediaState = (() => {
    if (!draft) return { thumbnailUrl: null, heroUrl: null, heroImages: [], gallery: [] };
    const payload = (draft.detail_payload || {}) as Record<string, unknown>;
    const galleryItems = Array.isArray(payload.galleryItems)
      ? (payload.galleryItems as Array<Record<string, unknown>>)
      : [];
    const gallery: GalleryEntry[] = [];
    galleryItems.forEach((g, idx) => {
      const url = typeof g.src === 'string' ? (g.src as string) : '';
      if (!url) return;
      gallery.push({
        id: `g-${idx}-${url.slice(-32).replace(/[^a-zA-Z0-9]/g, '')}`,
        url,
        title: typeof g.location === 'string' ? (g.location as string) : '',
        alt: typeof g.alt === 'string' ? (g.alt as string) : '',
        caption: typeof g.caption === 'string' ? (g.caption as string) : '',
      });
    });

    /* Multi-image hero slideshow (사용자 요청 2026-05-19) — payload.hero.images에서 load. */
    const heroPayload = (payload.hero as Record<string, unknown>) || {};
    const heroImagesRaw = heroPayload.images;
    const heroImages: string[] = Array.isArray(heroImagesRaw)
      ? (heroImagesRaw as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [];

    return {
      thumbnailUrl: draft.thumbnail_url,
      heroUrl: draft.hero_image_url,
      heroImages,
      gallery,
    };
  })();

  // Derive HeroState / ItineraryStop[] / FAQItem[] from detail_payload
  const hero: HeroState = (() => {
    const payload = (draft?.detail_payload || {}) as Record<string, unknown>;
    const h = (payload.hero as Record<string, unknown>) || {};
    const meta = (h.meta as Record<string, unknown>) || {};
    return {
      tagline: typeof h.tagline === 'string' ? (h.tagline as string) : '',
      imagePosition:
        typeof h.imagePosition === 'string' ? (h.imagePosition as string) : 'center 50%',
      pills: Array.isArray(h.pills) ? (h.pills as string[]).filter((p) => typeof p === 'string') : [],
      meta: {
        duration: typeof meta.duration === 'string' ? (meta.duration as string) : '',
        region: typeof meta.region === 'string' ? (meta.region as string) : '',
        stops: typeof meta.stops === 'string' ? (meta.stops as string) : '',
        rating: typeof meta.rating === 'number' ? (meta.rating as number) : null,
        ratingStars: typeof meta.ratingStars === 'number' ? (meta.ratingStars as number) : null,
      },
    };
  })();

  const itinerary: ItineraryStop[] = (() => {
    const payload = (draft?.detail_payload || {}) as Record<string, unknown>;
    const raw = Array.isArray(payload.itineraryStops)
      ? (payload.itineraryStops as Array<Record<string, unknown>>)
      : [];
    const out: ItineraryStop[] = [];
    raw.forEach((s, idx) => {
      out.push({
        id: `stop-${idx}-${typeof s.name === 'string' ? (s.name as string).slice(0, 12) : ''}`,
        number: typeof s.number === 'number' ? (s.number as number) : idx + 1,
        time: typeof s.time === 'string' ? (s.time as string) : '',
        duration: typeof s.duration === 'string' ? (s.duration as string) : '',
        name: typeof s.name === 'string' ? (s.name as string) : '',
        category: typeof s.category === 'string' ? (s.category as string) : '',
        description: typeof s.description === 'string' ? (s.description as string) : '',
        image: typeof s.image === 'string' ? (s.image as string) : undefined,
      });
    });
    return out;
  })();

  const faqs: FAQItem[] = (() => {
    const payload = (draft?.detail_payload || {}) as Record<string, unknown>;
    // FAQs in our JSON live under `staticQuestions` for Q&A and sometimes
    // `faqs`. Read the first one that's a non-empty array.
    const raw = (Array.isArray(payload.staticQuestions)
      ? payload.staticQuestions
      : Array.isArray(payload.faqs)
        ? payload.faqs
        : []) as Array<Record<string, unknown>>;
    const out: FAQItem[] = [];
    raw.forEach((q, idx) => {
      const question =
        typeof q.question === 'string' ? (q.question as string) : '';
      const answer = typeof q.answer === 'string' ? (q.answer as string) : '';
      if (!question && !answer) return;
      out.push({ id: `faq-${idx}-${question.slice(0, 12)}`, question, answer });
    });
    return out;
  })();

  const onHeroChange = (next: HeroState) => {
    if (!draft) return;
    const payload = { ...(draft.detail_payload || {}) } as Record<string, unknown>;
    payload.hero = {
      ...(payload.hero as Record<string, unknown> | undefined),
      tagline: next.tagline,
      imagePosition: next.imagePosition,
      pills: next.pills,
      meta: {
        ...((payload.hero as Record<string, unknown> | undefined)?.meta as
          | Record<string, unknown>
          | undefined),
        duration: next.meta.duration,
        region: next.meta.region,
        stops: next.meta.stops,
        rating: next.meta.rating ?? 0,
        ratingStars: next.meta.ratingStars ?? 5,
      },
    };
    setDraft({ ...draft, detail_payload: payload });
  };

  const onItineraryChange = (next: ItineraryStop[]) => {
    if (!draft) return;
    const payload = { ...(draft.detail_payload || {}) } as Record<string, unknown>;
    payload.itineraryStops = next.map((s, i) => ({
      number: i + 1,
      time: s.time,
      duration: s.duration,
      name: s.name,
      category: s.category,
      description: s.description,
      ...(s.image ? { image: s.image } : {}),
    }));
    setDraft({ ...draft, detail_payload: payload });
  };

  const onFAQChange = (next: FAQItem[]) => {
    if (!draft) return;
    const payload = { ...(draft.detail_payload || {}) } as Record<string, unknown>;
    const serialized = next.map((q) => ({ question: q.question, answer: q.answer }));
    // Write to whichever field the source bundle was using; default to
    // staticQuestions when neither was present.
    if (Array.isArray(payload.staticQuestions) || !Array.isArray(payload.faqs)) {
      payload.staticQuestions = serialized;
    } else {
      payload.faqs = serialized;
    }
    setDraft({ ...draft, detail_payload: payload });
  };

  const onMediaChange = (next: MediaState) => {
    if (!draft) return;
    // Update top-level columns
    const updated: ProductPageRow = {
      ...draft,
      thumbnail_url: next.thumbnailUrl,
      hero_image_url: next.heroUrl,
    };
    // Update detail_payload so the customer page renders consistently
    const payload = { ...(draft.detail_payload || {}) } as Record<string, unknown>;
    const catalog = { ...((payload.catalog_card as Record<string, unknown>) || {}) };
    catalog.thumbnail = next.thumbnailUrl;
    catalog.heroImage = next.heroUrl;
    payload.catalog_card = catalog;
    const hero = { ...((payload.hero as Record<string, unknown>) || {}) };
    if (next.heroUrl) hero.imageUrl = next.heroUrl;
    /* Multi-image hero slideshow — payload.hero.images에 배열 저장.
       빈 배열이어도 저장 (사용자가 명시적으로 모두 제거한 경우 유지). */
    hero.images = next.heroImages;
    payload.hero = hero;
    payload.galleryItems = next.gallery.map((g, i) => ({
      id: i + 1,
      type: 'photo',
      src: g.url,
      location: g.title || '',
      alt: g.alt || `${g.title || 'Gallery'} ${i + 1}`,
      caption: g.caption || `${g.title || 'photo'} ${i + 1}`,
    }));
    updated.detail_payload = payload;
    setDraft(updated);
    void persistDraft(updated, { silent: true });
  };

  const onSave = async () => {
    if (!draft || !dirty) return;
    await persistDraft(draft);
  };

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-slate-50">
      {/* Sticky header — slug + locale + status + actions */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBackToList}
          className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
          title="목록으로"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Hash className="size-3" />
            <span className="font-mono truncate">{slug}</span>
          </div>
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {row?.title || slug}
          </h1>
        </div>

        {/* Locale switcher */}
        <LocaleSwitcher value={locale} onChange={onLocaleChange} />

        {/* Published toggle */}
        {draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...draft, is_published: !draft.is_published })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              draft.is_published
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {draft.is_published ? (
              <>
                <Eye className="size-3.5" /> 게시 중
              </>
            ) : (
              <>
                <EyeOff className="size-3.5" /> 비공개
              </>
            )}
          </button>
        )}

        {/* Preview toggle */}
        <button
          type="button"
          onClick={onTogglePreview}
          className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            previewOpen
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
          title="라이브 미리보기"
        >
          <Sparkles className="size-3.5" /> 미리보기
        </button>

        {/* View on site */}
        {row && (
          <a
            href={`/tour-product/${slug}${locale !== 'en' ? `?locale=${locale}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            title="새 탭에서 라이브 페이지 열기"
          >
            <ExternalLink className="size-3.5" /> 라이브
          </a>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            dirty && !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saving ? '저장 중...' : dirty ? '저장' : '저장됨'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {fallbackLocale && (
          <div className="mb-4 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
            <AlertTriangle className="size-3.5 flex-shrink-0" />
            <span>
              <strong>{LOCALE_LABELS[locale]}</strong> 행이 없어 <strong>{fallbackLocale}</strong>
              로 미리 채워서 보여드리고 있습니다. 저장 시 새 행이 생성되지 않으므로 먼저
              seed가 필요합니다.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs">
            <strong>로드 실패:</strong> {error}
          </div>
        )}

        {loading && !draft && (
          <div className="space-y-3">
            <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
          </div>
        )}

        {draft && (
          <div className="space-y-4 max-w-3xl">
            {/* Media Manager (Phase 2-A2) */}
            <MediaSection state={media} onChange={onMediaChange} />

            {/* Hero text (Phase 2-A3) */}
            <HeroSection state={hero} onChange={onHeroChange} />

            {/* Itinerary stops (Phase 2-A3) */}
            <ItinerarySection stops={itinerary} onChange={onItineraryChange} />

            {/* FAQ (Phase 2-A3) */}
            <FAQSection items={faqs} onChange={onFAQChange} />

            {/* Basic info form */}
            <Card title="기본 정보" subtitle="카드/페이지 상단 표시 정보">
              <Field label="제목 (Title)">
                <input
                  type="text"
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </Field>
              <Field label="부제목 (Subtitle)">
                <textarea
                  rows={2}
                  value={draft.subtitle || ''}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="헤드라인 1">
                  <input
                    type="text"
                    value={draft.headline_line_1 || ''}
                    onChange={(e) => setDraft({ ...draft, headline_line_1: e.target.value })}
                    className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </Field>
                <Field label="헤드라인 2">
                  <input
                    type="text"
                    value={draft.headline_line_2 || ''}
                    onChange={(e) => setDraft({ ...draft, headline_line_2: e.target.value })}
                    className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="지역 (Region)">
                  <input
                    type="text"
                    value={draft.region_label || ''}
                    onChange={(e) => setDraft({ ...draft, region_label: e.target.value })}
                    className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </Field>
                <Field label="시간 (Duration)">
                  <input
                    type="text"
                    value={draft.duration_label || ''}
                    onChange={(e) => setDraft({ ...draft, duration_label: e.target.value })}
                    className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </Field>
              </div>
              <Field label="카드 짧은 설명">
                <textarea
                  rows={3}
                  value={draft.card_short_description || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, card_short_description: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
                />
              </Field>
            </Card>

            {/* SEO */}
            <Card title="SEO" subtitle="검색 엔진 / 소셜 카드용 메타 정보">
              <Field
                label="SEO 제목 (page title)"
                hint={`${(draft.seo_title || '').length} / 60자 권장`}
              >
                <input
                  type="text"
                  value={draft.seo_title || ''}
                  onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })}
                  className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </Field>
              <Field
                label="메타 설명 (meta description)"
                hint={`${(draft.meta_description || '').length} / 155자 권장`}
              >
                <textarea
                  rows={3}
                  value={draft.meta_description || ''}
                  onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
                />
              </Field>
            </Card>

            <ComingSoonCard
              icon={<Sparkles className="size-4" />}
              title="Autosave + Dirty-state 가드 + 키보드 단축키"
              body="1.5초 debounce 자동 저장, 닫을 때 미저장 경고, Cmd+S 저장, [/] 섹션 이동."
              eta="Phase 2-A4"
            />
            <ComingSoonCard
              icon={<Globe className="size-4" />}
              title="픽업 장소 편집 (지도 통합)"
              body="Google Maps 기반 픽업 포인트 추가/편집/삭제. v1의 PickupPointSelector 통합."
              eta="Phase 2-A5"
            />
          </div>
        )}

        {/* Genuine "row does not exist" state — API returned no data, no
            fallback locale, and no error. Distinct from the loading skeleton. */}
        {!draft && !loading && !error && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 max-w-md mx-auto">
            <div className="w-12 h-12 mb-3 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="size-6 text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              상세 페이지 데이터가 없습니다
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              이 상품(<span className="font-mono text-slate-700">{slug}</span>)은 아직{' '}
              <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">tour_product_pages</code>{' '}
              행이 없습니다. 편집기를 사용하려면 먼저 시드가 필요합니다.
            </p>
            <p className="text-xs text-slate-400">
              터미널에서{' '}
              <code className="px-1 py-0.5 bg-slate-100 rounded">
                node scripts/apply-tour-product.mjs {slug}
              </code>{' '}
              실행
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function ComingSoonCard({
  icon,
  title,
  body,
  eta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  eta: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white border border-dashed border-slate-300 rounded-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded">
            {eta}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function LocaleSwitcher({
  value,
  onChange,
}: {
  value: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="appearance-none h-8 pl-2 pr-7 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
      >
        {ALL_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_FLAGS[l]} · {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-slate-500 pointer-events-none" />
    </div>
  );
}
