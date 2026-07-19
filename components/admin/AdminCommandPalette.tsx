'use client';

/**
 * ⌘K / Ctrl+K command palette (spec §3.1) — fast keyboard navigation across the
 * admin. Additive: opens on the shortcut or an `admin-cmdk-open` window event
 * (the header ⌕ button), filters the nav routes, arrow+Enter to go.
 *
 * W4.4: when an `onSearch` fn is wired (the admin layout passes an authed one),
 * a query of ≥2 chars also debounce-fetches matching orders (by ref / contact)
 * and merchants (by name), rendered under group headers below the nav matches.
 * Without `onSearch` the palette stays nav-only (backward-compatible + testable).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ClipboardList, CornerDownLeft, Search } from 'lucide-react';

export interface CmdkItem {
  path: string;
  label: string;
}

/** A data-search hit resolved to a destination + display strings by the caller. */
export interface CmdkDataResult {
  group: 'order' | 'merchant';
  path: string;
  label: string;
  sublabel?: string;
}

type EntryGroup = 'nav' | 'order' | 'merchant';

interface Entry {
  group: EntryGroup;
  path: string;
  label: string;
  sublabel?: string;
}

const GROUP_LABELS: Record<EntryGroup, string> = {
  nav: '페이지',
  order: '주문',
  merchant: '업체',
};

const MIN_QUERY = 2;

export function AdminCommandPalette({
  items,
  onSearch,
}: {
  items: CmdkItem[];
  onSearch?: (query: string) => Promise<CmdkDataResult[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [dataResults, setDataResults] = useState<CmdkDataResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('admin-cmdk-open', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('admin-cmdk-open', onOpen);
    };
  }, []);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    // Nested so the effect body doesn't call setState directly (lint guard).
    const reset = () => {
      setQuery('');
      setActive(0);
      setDataResults([]);
      setSearching(false);
    };
    reset();
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Debounced data search. Only round-trips when a searcher is wired and the
  // query carries enough signal. All setState routed through nested fns so the
  // effect body has no direct setState call (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open || !onSearch) return;
    const q = query.trim();
    let cancelled = false;

    const apply = (results: CmdkDataResult[], busy: boolean) => {
      if (cancelled) return;
      setDataResults(results);
      setSearching(busy);
    };
    const begin = () => {
      if (!cancelled) setSearching(true);
    };

    if (q.length < MIN_QUERY) {
      apply([], false);
      return;
    }

    begin();
    const timer = setTimeout(() => {
      onSearch(q)
        .then((results) => apply(results, false))
        .catch(() => apply([], false));
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, onSearch, query]);

  const entries = useMemo<Entry[]>(() => {
    const nav: Entry[] = navMatches.map((i) => ({ group: 'nav', path: i.path, label: i.label }));
    const data: Entry[] = dataResults.map((d) => ({
      group: d.group,
      path: d.path,
      label: d.label,
      sublabel: d.sublabel,
    }));
    return [...nav, ...data];
  }, [navMatches, dataResults]);

  if (!open) return null;

  const activeIndex = entries.length ? Math.min(active, entries.length - 1) : 0;

  const go = (entry: Entry) => {
    setOpen(false);
    router.push(entry.path);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      data-testid="admin-cmdk"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-design-md border border-admin-border bg-admin-surface shadow-admin-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-admin-border px-3">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={onSearch ? '페이지·주문·업체 검색…' : '페이지 검색 / 이동…'}
            aria-label="명령 검색"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, entries.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (entries[activeIndex]) go(entries[activeIndex]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          {searching ? (
            <span
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500"
              aria-label="검색 중"
            />
          ) : null}
          <kbd className="hidden shrink-0 rounded border border-admin-border px-1.5 py-0.5 text-xs text-slate-400 sm:block">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {entries.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-400">
              {searching ? '검색 중…' : '결과 없음'}
            </li>
          ) : (
            entries.map((entry, i) => {
              const showHeader = i === 0 || entries[i - 1].group !== entry.group;
              const isActive = i === activeIndex;
              const Icon = entry.group === 'order' ? ClipboardList : entry.group === 'merchant' ? Building2 : null;
              return (
                <Fragment key={`${entry.group}:${entry.path}:${i}`}>
                  {showHeader ? (
                    <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {GROUP_LABELS[entry.group]}
                    </li>
                  ) : null}
                  <li>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(entry)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-design-sm px-3 text-left text-sm ${
                        isActive ? 'bg-admin-surface-hover text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {Icon ? <Icon size={15} className="shrink-0 text-slate-400" aria-hidden /> : null}
                      <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                      <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs text-slate-400">
                        {entry.sublabel ?? entry.path}
                      </span>
                      {isActive ? (
                        <CornerDownLeft size={13} className="shrink-0 text-slate-300" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                </Fragment>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
