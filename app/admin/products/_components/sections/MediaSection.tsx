'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  ImageIcon,
  Star,
  Crop,
  Sparkles,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import { SortableImageCard } from './SortableImageCard';
import { useImageUpload } from '../../_hooks/useImageUpload';

export type GalleryEntry = {
  /** Stable client-side id. Generated from URL or random when uploaded. */
  id: string;
  url: string;
  title?: string;
  alt?: string;
  caption?: string;
};

export type MediaState = {
  thumbnailUrl: string | null;
  heroUrl: string | null;
  /** Multi-image hero slideshow (사용자 요청 2026-05-19). 비어있으면 heroUrl 단일로 fallback.
      Frontend: `slides = hero.images.length > 0 ? hero.images : [hero.imageUrl]` */
  heroImages: string[];
  gallery: GalleryEntry[];
};

type Props = {
  state: MediaState;
  onChange: (next: MediaState) => void;
};

/** Detect whether a stored URL looks like a local site-relative image. */
function isLocalImage(url: string | null | undefined): boolean {
  return !!url && url.startsWith('/');
}

/** Append `?v={ts}` for cache-busting on the editor side only. */
function withCacheBust(url: string | null | undefined, key: number): string | null {
  if (!url) return null;
  if (!isLocalImage(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_v=${key}`;
}

function entryIdFromUrl(url: string): string {
  // url is unique enough; encode to be CSS-safe
  return `g-${btoa(unescape(encodeURIComponent(url))).replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}-${url.length}`;
}

/**
 * The media manager — thumbnail + hero slots, plus a sortable gallery grid.
 * Uploads go to Supabase Storage via `/api/admin/upload`. All edits are
 * propagated up through `onChange`; save is the caller's responsibility.
 */
export function MediaSection({ state, onChange }: Props) {
  const { uploading, progress, uploadOne, uploadMany } = useImageUpload();
  const [dragOver, setDragOver] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cacheKey = useMemo(() => Date.now(), []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const galleryIds = useMemo(() => state.gallery.map((g) => g.id), [state.gallery]);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = state.gallery.findIndex((g) => g.id === active.id);
    const newIndex = state.gallery.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({
      ...state,
      gallery: arrayMove(state.gallery, oldIndex, newIndex),
    });
  };

  const handleFiles = useCallback(
    async (files: FileList | File[], slot: 'thumbnail' | 'hero' | 'gallery') => {
      const arr = Array.from(files);
      if (arr.length === 0) return;

      if (slot === 'gallery') {
        const results = await uploadMany(arr, { kind: 'gallery' });
        const successes = results.filter((r): r is { url: string; path: string; name: string } => !!r);
        if (successes.length === 0) {
          toast.error('업로드 실패', { description: '모든 파일 업로드에 실패했습니다.' });
          return;
        }
        const newEntries: GalleryEntry[] = successes.map((r) => ({
          id: entryIdFromUrl(r.url),
          url: r.url,
          title: '',
          alt: '',
        }));
        onChange({ ...state, gallery: [...state.gallery, ...newEntries] });
        toast.success(`${successes.length}장 업로드 완료`, {
          description:
            results.length > successes.length
              ? `${results.length - successes.length}장은 실패했습니다.`
              : '갤러리에 추가되었습니다. 저장을 잊지 마세요.',
        });
      } else {
        try {
          const r = await uploadOne(arr[0]!, { kind: 'product' });
          onChange({
            ...state,
            [slot === 'thumbnail' ? 'thumbnailUrl' : 'heroUrl']: r.url,
          });
          toast.success(
            slot === 'thumbnail' ? '썸네일 업로드 완료' : '히어로 업로드 완료',
            { description: '저장을 잊지 마세요.' },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.error('업로드 실패', { description: msg });
        }
      }
    },
    [state, onChange, uploadOne, uploadMany],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) void handleFiles(files, 'gallery');
  };

  const setEntryAsThumbnail = (entry: GalleryEntry) => {
    onChange({ ...state, thumbnailUrl: entry.url });
    toast.info('썸네일로 설정', { description: entry.title || entry.url });
  };

  const setEntryAsHero = (entry: GalleryEntry) => {
    onChange({ ...state, heroUrl: entry.url });
    toast.info('히어로로 설정', { description: entry.title || entry.url });
  };

  /* Multi-hero slideshow toggle (사용자 요청 2026-05-19). entry.url을 heroImages 배열에
     push/remove. 첫 image가 자동 slideshow 시작점. heroUrl과 별개 — heroUrl은 fallback. */
  const toggleHeroSlide = (entry: GalleryEntry) => {
    const exists = state.heroImages.includes(entry.url);
    const next = exists
      ? state.heroImages.filter((u) => u !== entry.url)
      : [...state.heroImages, entry.url];
    onChange({ ...state, heroImages: next });
    toast.info(exists ? '히어로 슬라이드에서 제거' : '히어로 슬라이드에 추가', {
      description: entry.title || entry.url,
    });
  };

  const removeEntry = (entry: GalleryEntry) => {
    onChange({
      ...state,
      gallery: state.gallery.filter((g) => g.id !== entry.id),
      // If we just removed the active thumb/hero/heroSlide, clear it
      thumbnailUrl: state.thumbnailUrl === entry.url ? null : state.thumbnailUrl,
      heroUrl: state.heroUrl === entry.url ? null : state.heroUrl,
      heroImages: state.heroImages.filter((u) => u !== entry.url),
    });
  };

  const updateEntry = (next: GalleryEntry) => {
    onChange({
      ...state,
      gallery: state.gallery.map((g) => (g.id === next.id ? next : g)),
    });
  };

  const swapThumbAndHero = () => {
    onChange({
      ...state,
      thumbnailUrl: state.heroUrl,
      heroUrl: state.thumbnailUrl,
    });
  };

  const activeEntry = activeId ? state.gallery.find((g) => g.id === activeId) ?? null : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ImageIcon className="size-4 text-blue-600" />
            미디어 매니저
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            드래그&드롭으로 업로드 · 갤러리 카드 드래그로 순서 변경 · "썸네일/히어로" 클릭으로 슬롯 지정
          </p>
        </div>
        {uploading && progress && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
            <Loader2 className="size-3.5 animate-spin" />
            업로드 중 {progress.done}/{progress.total}
          </div>
        )}
      </div>

      {/* Slot row: thumbnail + hero */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <SlotPanel
          label="썸네일 (Thumbnail)"
          subLabel="카드 이미지 · 1:1"
          aspect="1/1"
          src={withCacheBust(state.thumbnailUrl, cacheKey)}
          onPick={(file) => handleFiles([file], 'thumbnail')}
          onClear={() => onChange({ ...state, thumbnailUrl: null })}
          accentColor="amber"
        />
        <SlotPanel
          label="히어로 (Hero)"
          subLabel="페이지 상단 · 16:9"
          aspect="16/9"
          src={withCacheBust(state.heroUrl, cacheKey)}
          onPick={(file) => handleFiles([file], 'hero')}
          onClear={() => onChange({ ...state, heroUrl: null })}
          accentColor="blue"
        />
      </div>

      {/* Swap button when both filled */}
      {state.thumbnailUrl && state.heroUrl && state.thumbnailUrl !== state.heroUrl && (
        <div className="px-4 -mt-2 mb-3 flex justify-end">
          <button
            type="button"
            onClick={swapThumbAndHero}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            title="썸네일과 히어로 이미지 교체"
          >
            <ArrowLeftRight className="size-3" />
            썸네일 ↔ 히어로 교체
          </button>
        </div>
      )}

      {/* Gallery */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-700">
            갤러리 ({state.gallery.length}장)
          </h4>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files, 'gallery');
              e.target.value = '';
            }}
          />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={galleryIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {state.gallery.map((entry, idx) => (
                <SortableImageCard
                  key={entry.id}
                  index={idx}
                  entry={entry}
                  isThumbnail={entry.url === state.thumbnailUrl}
                  isHero={entry.url === state.heroUrl}
                  isInHeroSlides={state.heroImages.includes(entry.url)}
                  heroSlideOrder={state.heroImages.indexOf(entry.url)}
                  onChange={updateEntry}
                  onRemove={() => removeEntry(entry)}
                  onSetAsThumbnail={() => setEntryAsThumbnail(entry)}
                  onSetAsHero={() => setEntryAsHero(entry)}
                  onToggleHeroSlide={() => toggleHeroSlide(entry)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeEntry ? (
              <div className="bg-white border-2 border-blue-400 rounded-xl shadow-xl p-2 flex items-center gap-2 max-w-xs">
                {activeEntry.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeEntry.url} alt="" className="w-14 h-14 rounded object-cover" />
                )}
                <span className="text-xs text-slate-700 truncate">
                  {activeEntry.title || '이동 중...'}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Empty state / dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-3 border-2 border-dashed rounded-xl p-6 text-center text-sm transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Upload className="size-5 mx-auto mb-1.5 text-slate-400" />
          <p className="font-medium">
            여기에 이미지를 드래그하거나 <span className="underline cursor-pointer" onClick={() => fileInputRef.current?.click()}>클릭하여 업로드</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">JPG/PNG/WebP · 자동 압축 · 갤러리에 추가됩니다</p>
        </div>

        {state.gallery.length === 0 && (
          <p className="mt-2 text-xs text-slate-400 text-center">
            갤러리에 이미지가 없습니다. 위 영역에 이미지를 드래그하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function SlotPanel({
  label,
  subLabel,
  aspect,
  src,
  onPick,
  onClear,
  accentColor,
}: {
  label: string;
  subLabel: string;
  aspect: string;
  src: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  accentColor: 'amber' | 'blue';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const accent =
    accentColor === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  const iconAccent = accentColor === 'amber' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            {accentColor === 'amber' ? (
              <Crop className={`size-3 ${iconAccent}`} />
            ) : (
              <Star className={`size-3 ${iconAccent}`} />
            )}
            {label}
          </div>
          <div className="text-[10px] text-slate-500">{subLabel}</div>
        </div>
        {src && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
            title="비우기"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      <div
        className="relative w-full bg-white rounded-md overflow-hidden border border-slate-200 cursor-pointer hover:border-blue-400"
        style={{ aspectRatio: aspect }}
        onClick={() => ref.current?.click()}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <Sparkles className="size-5 mb-1" />
            <span className="text-[11px]">클릭하여 업로드</span>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </div>
      {src && (
        <p className={`mt-1 px-1.5 py-0.5 inline-block text-[9px] font-mono rounded ${accent} break-all`}>
          {src.split('?')[0]}
        </p>
      )}
    </div>
  );
}
