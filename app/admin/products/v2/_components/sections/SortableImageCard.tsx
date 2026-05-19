'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Star,
  ImageIcon,
  Crop,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { GalleryEntry } from './MediaSection';

type Props = {
  index: number;
  entry: GalleryEntry;
  isThumbnail: boolean;
  isHero: boolean;
  /** Multi-hero slideshow: 이 이미지가 hero.images 배열에 포함됐는지. */
  isInHeroSlides: boolean;
  /** Multi-hero slideshow 순서 (0 base, -1 = 미포함). */
  heroSlideOrder: number;
  onChange: (next: GalleryEntry) => void;
  onRemove: () => void;
  onSetAsThumbnail: () => void;
  onSetAsHero: () => void;
  /** Multi-hero slideshow toggle (push/remove from hero.images array). */
  onToggleHeroSlide: () => void;
};

/**
 * One gallery image — drag handle on the left, preview, inline title/alt
 * editor on the right, action row (set-as-thumb / set-as-hero / open / delete).
 *
 * Crucially keyed by a stable `id` (URL-based) at the parent level so reorders
 * don't drop input focus.
 */
export function SortableImageCard({
  index,
  entry,
  isThumbnail,
  isHero,
  isInHeroSlides,
  heroSlideOrder,
  onChange,
  onRemove,
  onSetAsThumbnail,
  onSetAsHero,
  onToggleHeroSlide,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-xl shadow-sm overflow-hidden flex items-stretch ${
        isDragging ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-grab active:cursor-grabbing border-r border-slate-200 text-slate-400"
        aria-label="드래그하여 순서 변경"
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Thumbnail */}
      <div className="relative w-24 h-24 flex-shrink-0 bg-slate-100">
        {entry.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.url}
            alt={entry.alt || `Gallery ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="size-5" />
          </div>
        )}
        {(isThumbnail || isHero || isInHeroSlides) && (
          <div className="absolute top-1 left-1 flex flex-wrap gap-1">
            {isThumbnail && (
              <span className="px-1 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded">
                썸네일
              </span>
            )}
            {isHero && (
              <span className="px-1 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded">
                히어로
              </span>
            )}
            {isInHeroSlides && (
              <span className="px-1 py-0.5 text-[9px] font-bold bg-violet-600 text-white rounded tabular-nums">
                슬라이드 {heroSlideOrder + 1}
              </span>
            )}
          </div>
        )}
        <span className="absolute bottom-1 right-1 px-1 py-0.5 text-[9px] font-bold bg-slate-900/70 text-white rounded">
          #{index + 1}
        </span>
      </div>

      {/* Meta + actions */}
      <div className="flex-1 min-w-0 p-2.5 flex flex-col gap-1.5">
        <input
          type="text"
          value={entry.title || ''}
          onChange={(e) => onChange({ ...entry, title: e.target.value })}
          placeholder="제목 (location)"
          className="w-full h-7 px-2 text-xs rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
        />
        <input
          type="text"
          value={entry.alt || ''}
          onChange={(e) => onChange({ ...entry, alt: e.target.value })}
          placeholder="대체 텍스트 (alt) — SEO/접근성"
          className="w-full h-7 px-2 text-xs rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
        />

        <div className="flex items-center gap-1 mt-auto">
          <ActionBtn
            onClick={onSetAsThumbnail}
            active={isThumbnail}
            title={isThumbnail ? '이미 썸네일입니다' : '썸네일로 설정'}
          >
            <Crop className="size-3" />
            썸네일
          </ActionBtn>
          <ActionBtn
            onClick={onSetAsHero}
            active={isHero}
            title={isHero ? '이미 히어로입니다' : '히어로로 설정 (단일 fallback)'}
          >
            <Star className="size-3" />
            히어로
          </ActionBtn>
          <ActionBtn
            onClick={onToggleHeroSlide}
            active={isInHeroSlides}
            title={
              isInHeroSlides
                ? `히어로 슬라이드 ${heroSlideOrder + 1}번 — 클릭하여 제거`
                : '히어로 슬라이드쇼에 추가 (복수 선택 가능)'
            }
          >
            <Layers className="size-3" />
            슬라이드{isInHeroSlides ? ` ${heroSlideOrder + 1}` : '+'}
          </ActionBtn>
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50"
              title="원본 보기"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
            title="삭제 (저장 시 적용)"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
        active
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
