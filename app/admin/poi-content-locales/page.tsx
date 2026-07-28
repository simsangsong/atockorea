'use client';

/**
 * A4 — POI 로케일 해설 검수 큐.
 *
 * `match_pois.content_locales`에는 원래 검수 상태가 없었다. 거기 쓰인 글은 쓰는
 * 즉시 손님 화면에 나갔고, 도착 콘텐츠 티어가 붙은 뒤로는 **소리로도 재생된다.**
 * 그래서 게이트를 걸었고(승인된 로케일만 서빙), 이 화면이 그 게이트를 여는 손잡이다.
 *
 * 검수자가 체크박스만 누르지 않도록 **영어 원문을 항상 옆에 붙여** 보여준다.
 * 승인 전까지는 그 로케일이 영어로 폴백되므로, 미승인 상태가 손님에게 사고가
 * 되지는 않는다 — 다만 그 손님은 자기 언어를 못 듣는다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, RotateCcw, Languages, RefreshCw } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface QueueItem {
  poi_key: string;
  name_en: string | null;
  region: string | null;
  locale: string;
  status: ReviewStatus;
  name: string | null;
  description: string | null;
  highlights: string[];
  insider_tip: string | null;
  english_description: string | null;
}

const TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: 'pending', label: '검수 대기' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '거절됨' },
];

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function PoiContentLocalesPage() {
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [localeFilter, setLocaleFilter] = useState<string>('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/poi-content-locales?status=${tab}`);
      if (!res.ok) throw new Error(`목록을 불러오지 못했습니다 (${res.status})`);
      const json = (await res.json()) as { items: QueueItem[]; counts: Record<string, number> };
      setItems(json.items ?? []);
      setCounts(json.counts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const locales = useMemo(
    () => [...new Set(items.map((i) => i.locale))].sort(),
    [items],
  );
  const visible = useMemo(
    () => (localeFilter ? items.filter((i) => i.locale === localeFilter) : items),
    [items, localeFilter],
  );

  const decide = async (item: QueueItem, status: ReviewStatus) => {
    const key = `${item.poi_key}:${item.locale}`;
    setBusy(key);
    try {
      const res = await authedFetch('/api/admin/poi-content-locales', {
        method: 'PATCH',
        body: JSON.stringify({ poi_key: item.poi_key, locale: item.locale, status }),
      });
      if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
      setItems((prev) => prev.filter((i) => !(i.poi_key === item.poi_key && i.locale === item.locale)));
      setCounts((prev) => ({
        ...prev,
        [item.status]: Math.max(0, (prev[item.status] ?? 1) - 1),
        [status]: (prev[status] ?? 0) + 1,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  /**
   * 로케일 하나를 통째로 승인한다. 필터가 걸려 있을 때만 켜지는데, "전부 승인"이
   * 무엇을 승인하는지 화면에 보이지 않으면 그건 검수가 아니기 때문이다.
   */
  const approveVisible = async () => {
    if (!localeFilter) return;
    const target = [...visible];
    if (!window.confirm(`${localeFilter} ${target.length}건을 모두 승인합니다. 계속할까요?`)) return;
    for (const item of target) {
      // 순차 처리 — 한 건이 실패해도 어디까지 갔는지 화면에 남는다.
      // eslint-disable-next-line no-await-in-loop
      await decide(item, 'approved');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-cjk-safe flex items-center gap-2 text-xl font-semibold text-stone-900">
          <Languages size={20} aria-hidden />
          POI 해설 로케일 검수
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          className="text-cjk-safe inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-stone-300 px-3 text-sm text-stone-600"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </header>

      <p className="text-cjk-body mb-4 max-w-3xl text-sm leading-relaxed text-stone-600">
        승인된 로케일만 손님에게 서빙되고, 도착 카드에서 <strong>소리로 재생</strong>됩니다.
        미승인 로케일은 영어로 폴백되므로 손님 화면이 깨지지는 않지만, 그 손님은 자기 언어를 듣지 못합니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setLocaleFilter('');
            }}
            className={`text-cjk-safe min-h-[36px] rounded-full px-3.5 text-sm font-medium ${
              tab === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {t.label}
            {counts[t.key] !== undefined && <span className="ml-1.5 opacity-70">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {locales.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLocaleFilter('')}
            className={`text-cjk-safe min-h-[32px] rounded-full px-3 text-xs ${
              localeFilter === '' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            전체 {items.length}
          </button>
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setLocaleFilter(locale)}
              className={`text-cjk-safe min-h-[32px] rounded-full px-3 text-xs ${
                localeFilter === locale ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {locale} {items.filter((i) => i.locale === locale).length}
            </button>
          ))}
          {localeFilter && tab === 'pending' && (
            <button
              type="button"
              onClick={() => void approveVisible()}
              className="text-cjk-safe ml-auto min-h-[32px] rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white"
            >
              보이는 {visible.length}건 전부 승인
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-cjk-body mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && <p className="text-sm text-stone-500">불러오는 중…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-cjk-body rounded-lg bg-stone-50 px-4 py-6 text-sm text-stone-500">
          이 상태의 항목이 없습니다.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((item) => {
          const key = `${item.poi_key}:${item.locale}`;
          return (
            <li key={key} className="text-cjk-safe rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-cjk-safe rounded-full bg-stone-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {item.locale}
                </span>
                <span className="text-cjk-safe text-sm font-semibold text-stone-900">
                  {item.name ?? item.name_en ?? item.poi_key}
                </span>
                <span className="text-cjk-safe text-xs text-stone-400">{item.poi_key}</span>
                {item.region && <span className="text-cjk-safe text-xs text-stone-400">· {item.region}</span>}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-cjk-safe mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    번역 ({item.locale})
                  </p>
                  <p className="text-cjk-body whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                    {item.description ?? '(해설 없음)'}
                  </p>
                  {item.highlights.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {item.highlights.map((h, i) => (
                        <li
                          key={i}
                          className="text-cjk-safe rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                        >
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.insider_tip && (
                    <p className="text-cjk-body mt-2 text-xs text-stone-500">💡 {item.insider_tip}</p>
                  )}
                </div>
                <div className="md:border-l md:border-stone-100 md:pl-3">
                  <p className="text-cjk-safe mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    영어 원문
                  </p>
                  <p className="text-cjk-body whitespace-pre-wrap text-sm leading-relaxed text-stone-500">
                    {item.english_description ?? '(원문 없음)'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void decide(item, 'approved')}
                    className="text-cjk-safe inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check size={14} aria-hidden />
                    승인
                  </button>
                )}
                {item.status !== 'rejected' && (
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void decide(item, 'rejected')}
                    className="text-cjk-safe inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-stone-300 px-3.5 text-sm text-stone-600 disabled:opacity-50"
                  >
                    <X size={14} aria-hidden />
                    거절
                  </button>
                )}
                {item.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void decide(item, 'pending')}
                    className="text-cjk-safe inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-stone-300 px-3.5 text-sm text-stone-600 disabled:opacity-50"
                  >
                    <RotateCcw size={14} aria-hidden />
                    보류로
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
