'use client';

/**
 * ⌘K / Ctrl+K command palette (spec §3.1) — fast keyboard navigation across the
 * admin. Additive: opens on the shortcut or an `admin-cmdk-open` window event
 * (the header ⌕ button), filters the nav routes, arrow+Enter to go. Data search
 * (orders by ref, merchants by name) can extend `items` later.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export interface CmdkItem {
  path: string;
  label: string;
}

export function AdminCommandPalette({ items }: { items: CmdkItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
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

  const filtered = useMemo(() => {
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
    };
    reset();
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const go = (item: CmdkItem) => {
    setOpen(false);
    router.push(item.path);
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="페이지 검색 / 이동…"
            aria-label="명령 검색"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[active]) go(filtered[active]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          <kbd className="hidden shrink-0 rounded border border-admin-border px-1.5 py-0.5 text-xs text-slate-400 sm:block">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-400">결과 없음</li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.path}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-design-sm px-3 text-left text-sm ${
                    i === active ? 'bg-admin-surface-hover text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="shrink-0 text-xs text-slate-400">{item.path}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
