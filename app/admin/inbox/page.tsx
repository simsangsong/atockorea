'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  X,
  Mail,
  MessageSquareText,
  LifeBuoy,
  ArrowUpRight,
  Circle,
  CheckCheck,
} from 'lucide-react';
import { Skeleton } from '@/components/admin/Skeleton';
import { useUrlFilters } from '@/lib/admin/useUrlFilters';
import { useRealtimeActivity } from '@/lib/admin/useRealtimeActivity';
import { kstDayBounds } from '@/lib/admin/kst-day';
import { INBOX_SOURCE_LABEL, type InboxItem, type InboxSource } from '@/lib/admin/inbox';
import { cn } from '@/lib/utils';

type Counts = { unread: number; contact: number; email: number; ticket: number };

const SOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'contact', label: '문의' },
  { value: 'email', label: '메일' },
  { value: 'ticket', label: '티켓' },
];

const SOURCE_ICON: Record<InboxSource, typeof Mail> = {
  contact: MessageSquareText,
  email: Mail,
  ticket: LifeBuoy,
};

const SOURCE_CHIP: Record<InboxSource, string> = {
  contact: 'bg-blue-50 text-blue-700',
  email: 'bg-violet-50 text-violet-700',
  ticket: 'bg-amber-50 text-amber-700',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return iso.slice(5, 10).replace('-', '.');
}

/** Group items into date buckets (오늘 / 어제 / 이전) using KST day boundaries. */
function groupByDay(items: InboxItem[]): Array<{ label: string; items: InboxItem[] }> {
  const today = kstDayBounds(new Date());
  const yesterday = kstDayBounds(new Date(Date.now() - 86_400_000));
  const buckets = new Map<string, InboxItem[]>();
  const order: string[] = [];
  for (const it of items) {
    const t = new Date(it.createdAt).getTime();
    let label: string;
    if (t >= new Date(today.startIso).getTime()) label = '오늘';
    else if (t >= new Date(yesterday.startIso).getTime()) label = '어제';
    else label = '이전';
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(it);
  }
  return order.map((label) => ({ label, items: buckets.get(label)! }));
}

export default function InboxPage() {
  const { filters, setFilter } = useUrlFilters({ source: 'all', status: 'all', q: '' });
  const source = filters.source;
  const status = filters.status;
  const q = filters.q;

  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [refreshNonce, setRefreshNonce] = useState(0);
  // U-1 inbox realtime: contact_inquiries + support_tickets are in the
  // publication. received_emails is not (needs a separate DDL approval) so it
  // isn't counted here yet.
  const rtContact = useRealtimeActivity('contact_inquiries', { event: 'INSERT' });
  const rtTicket = useRealtimeActivity('support_tickets', { event: 'INSERT' });
  const newCount = rtContact.newCount + rtTicket.newCount;
  const reloadInbox = () => {
    rtContact.reset();
    rtTicket.reset();
    setRefreshNonce((n) => n + 1);
  };

  // Debounce the search box into the URL filter.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) setFilter('q', searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q, setFilter]);

  const buildUrl = useCallback(
    (nextCursor?: string) => {
      const p = new URLSearchParams();
      if (source !== 'all') p.set('source', source);
      if (status !== 'all') p.set('status', status);
      if (q) p.set('q', q);
      if (nextCursor) p.set('cursor', nextCursor);
      return `/api/admin/inbox${p.toString() ? `?${p.toString()}` : ''}`;
    },
    [source, status, q],
  );

  const reqId = useRef(0);
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetch(buildUrl(), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (id !== reqId.current) return;
        setItems(json.items ?? []);
        setCursor(json.nextCursor ?? null);
        if (json.counts) setCounts(json.counts);
      })
      .catch((err) => {
        if (id === reqId.current) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [buildUrl, refreshNonce]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(cursor), { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems((prev) => [...prev, ...(json.items ?? [])]);
      setCursor(json.nextCursor ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '더 불러오기 실패');
    } finally {
      setLoadingMore(false);
    }
  };

  const setRead = useCallback(async (item: InboxItem, read: boolean) => {
    setItems((prev) => prev.map((it) => (it.ref === item.ref ? { ...it, unread: !read } : it)));
    setCounts((prev) => (prev ? { ...prev, unread: Math.max(0, prev.unread + (read ? -1 : 1)) } : prev));
    try {
      const res = await fetch('/api/admin/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source: item.source, id: item.id, read }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Roll back on failure.
      setItems((prev) => prev.map((it) => (it.ref === item.ref ? { ...it, unread: read } : it)));
      toast.error('읽음 상태 변경 실패');
    }
  }, []);

  const openItem = (item: InboxItem) => {
    setSelected(item);
    if (item.unread) void setRead(item, true);
  };

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 space-y-3 border-b border-admin-border bg-admin-bg px-4 pb-3 pt-4 md:-mx-5 md:-mt-5 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {SOURCE_FILTERS.map((f) => {
              const active = source === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter('source', f.value)}
                  aria-pressed={active}
                  className={cn(
                    'min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors',
                    active ? 'bg-slate-900 text-white' : 'bg-admin-surface-hover text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {newCount > 0 && (
            <button
              type="button"
              onClick={reloadInbox}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-100"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-600" />
              </span>
              새 항목 {newCount}건 · 불러오기
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilter('status', status === 'unread' ? 'all' : 'unread')}
            aria-pressed={status === 'unread'}
            className={cn(
              'ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors',
              status === 'unread' ? 'bg-blue-600 text-white' : 'bg-admin-surface-hover text-slate-600 hover:bg-slate-200',
            )}
          >
            미처리만
            {counts && counts.unread > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums',
                  status === 'unread' ? 'bg-white/20' : 'bg-blue-100 text-blue-700',
                )}
              >
                {counts.unread}
              </span>
            ) : null}
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름 · 이메일 · 제목 · 내용 검색"
            className="min-h-11 w-full rounded-design-sm border border-admin-border bg-admin-surface pl-9 pr-9 text-base text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="검색 지우기"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-design-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-design-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-design-md border border-dashed border-admin-border p-10 text-center text-sm text-slate-400">
          {q || source !== 'all' || status !== 'all' ? '조건에 맞는 항목이 없습니다.' : '받은 문의가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
              {g.items.map((item) => (
                <InboxItemCard key={item.ref} item={item} onOpen={openItem} />
              ))}
            </div>
          ))}
          {cursor ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="min-h-11 w-full rounded-design-sm border border-admin-border bg-admin-surface text-sm font-medium text-slate-600 hover:bg-admin-surface-hover disabled:opacity-50"
            >
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          ) : null}
        </div>
      )}

      {selected ? (
        <DetailSheet item={selected} onClose={() => setSelected(null)} onSetRead={setRead} />
      ) : null}
    </div>
  );
}

function InboxItemCard({ item, onOpen }: { item: InboxItem; onOpen: (i: InboxItem) => void }) {
  const Icon = SOURCE_ICON[item.source];
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'block w-full rounded-design-md border bg-admin-surface p-4 text-left shadow-admin-card transition-colors hover:bg-admin-surface-hover',
        item.unread ? 'border-blue-200' : 'border-admin-border',
      )}
    >
      <div className="flex items-center gap-2">
        {item.unread ? (
          <Circle className="size-2 flex-shrink-0 fill-blue-500 text-blue-500" />
        ) : (
          <span className="size-2 flex-shrink-0" />
        )}
        <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', SOURCE_CHIP[item.source])}>
          <Icon className="size-3" strokeWidth={2} />
          {INBOX_SOURCE_LABEL[item.source]}
        </span>
        {item.category ? (
          <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{item.category}</span>
        ) : null}
        <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{relativeTime(item.createdAt)}</span>
      </div>
      <p className={cn('mt-2 truncate text-sm', item.unread ? 'font-semibold text-slate-900' : 'text-slate-800')}>
        {item.title}
      </p>
      {item.contactName || item.contactEmail ? (
        <p className="truncate text-xs text-slate-500">{item.contactName ?? item.contactEmail}</p>
      ) : null}
      {item.preview ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.preview}</p> : null}
      {item.bookingRef ? (
        <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {item.bookingRef}
        </span>
      ) : null}
    </button>
  );
}

function DetailSheet({
  item,
  onClose,
  onSetRead,
}: {
  item: InboxItem;
  onClose: () => void;
  onSetRead: (i: InboxItem, read: boolean) => void;
}) {
  const Icon = SOURCE_ICON[item.source];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-admin-surface-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-admin-float sm:max-w-lg sm:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', SOURCE_CHIP[item.source])}>
            <Icon className="size-3" strokeWidth={2} />
            {INBOX_SOURCE_LABEL[item.source]}
          </span>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded p-1 text-slate-400 hover:text-slate-700">
            <X className="size-5" />
          </button>
        </div>

        <h2 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {item.contactName ? <span>{item.contactName}</span> : null}
          {item.contactEmail ? <span className="font-mono">{item.contactEmail}</span> : null}
          <span>{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
          {item.category ? <span className="rounded bg-slate-100 px-1.5 py-0.5">{item.category}</span> : null}
          {item.bookingRef ? <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{item.bookingRef}</span> : null}
        </div>

        <div className="mt-4 whitespace-pre-wrap break-words rounded-design-sm border border-admin-border bg-admin-bg p-3 text-sm text-slate-700">
          {item.body?.trim() || '(본문 없음)'}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSetRead(item, item.unread)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-design-sm border border-admin-border px-3 text-sm font-medium text-slate-700 hover:bg-admin-surface-hover"
          >
            <CheckCheck className="size-4" /> {item.unread ? '읽음 표시' : '안 읽음 표시'}
          </button>
          <Link
            href={item.sourceHref}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-design-sm bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            원본에서 답장·처리 <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
