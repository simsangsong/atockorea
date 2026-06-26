'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import {
  type SavedView,
  parseSavedViews,
  removeSavedView,
  serializeSavedViews,
  upsertSavedView,
  viewIsActive,
} from '@/lib/admin/saved-views';

/**
 * U-8 — saved filter views for admin lists (spec §P). Persists named filter
 * presets in localStorage (per storageKey) so an operator can bookmark common
 * filters. Pure preset logic lives in lib/admin/saved-views.ts; this component
 * owns the localStorage I/O + UI only. No window.prompt() (iOS WebView hostile)
 * — naming uses an inline input.
 */
export function SavedViews({
  storageKey,
  currentFilters,
  isDefault,
  onApply,
}: {
  storageKey: string;
  currentFilters: Record<string, string>;
  /** true when currentFilters equals the list defaults (nothing to save). */
  isDefault: boolean;
  onApply: (filters: Record<string, string>) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      setViews(parseSavedViews(window.localStorage.getItem(storageKey)));
    } catch {
      setViews([]);
    }
  }, [storageKey]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      window.localStorage.setItem(storageKey, serializeSavedViews(next));
    } catch {
      /* ignore quota / privacy-mode write failures */
    }
  };

  const handleSave = () => {
    const next = upsertSavedView(views, name, currentFilters);
    if (next === views) return; // empty name -> no-op
    persist(next);
    setName('');
    setNaming(false);
    toast.success('뷰를 저장했습니다');
  };

  const handleRemove = (id: string) => {
    persist(removeSavedView(views, id));
    toast.success('뷰를 삭제했습니다');
  };

  if (views.length === 0 && isDefault && !naming) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Bookmark className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />

      {views.map((view) => {
        const active = viewIsActive(view, currentFilters);
        return (
          <span
            key={view.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
              active
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-admin-border bg-admin-surface text-slate-600 hover:bg-admin-surface-hover'
            }`}
          >
            <button type="button" onClick={() => onApply(view.filters)} aria-pressed={active}>
              {view.name}
            </button>
            <button
              type="button"
              onClick={() => handleRemove(view.id)}
              aria-label={`${view.name} 뷰 삭제`}
              className="text-slate-400 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
            placeholder="뷰 이름"
            maxLength={48}
            className="h-9 w-28 rounded-lg border border-admin-border bg-admin-surface px-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName('');
            }}
            className="inline-flex h-9 items-center rounded-lg px-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            취소
          </button>
        </span>
      ) : (
        !isDefault && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-admin-border px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-admin-surface-hover"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            현재 필터 저장
          </button>
        )
      )}
    </div>
  );
}
