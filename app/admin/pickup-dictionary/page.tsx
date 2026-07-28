'use client';

/**
 * DE7 — 픽업 표준지점 사전.
 *
 * OTA 예약마다 픽업지 표기가 제각각이다("Lotte Hotel Jeju", "롯데호텔 제주",
 * "만남의 장소: LOTTE City Hotel Jeju, 83 Doryeong-ro…"). 이걸 하나의 표준지점으로
 * 모으는 사전이 있어야 매번 손으로 고치지 않는다.
 *
 * 사전은 있었지만 **행을 만들 화면이 없었다.** 그래서 비어 있었고, 비어 있으면
 * 정규화는 모든 표기에 대해 계속 실패한다.
 *
 * 자동 승인은 없다 — 잘못 모인 별칭은 손님을 엉뚱한 곳으로 보낸다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, MapPin, Plus, X } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

interface LocationRow {
  id: string;
  canonical_name: string;
  display_name_ko: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  aliases: Array<{ id: string; alias: string }>;
}

interface QueueRow {
  id: string;
  raw_value: string;
  proposed_canonical_id: string | null;
  occurrence_count: number;
  confidence: number | null;
}

export default function PickupDictionaryPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newKo, setNewKo] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAdminAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      credentials: 'include',
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/pickup-dictionary');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setLocations(json.locations ?? []);
      setQueue(json.queue ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const addLocation = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy('new');
    try {
      const res = await authedFetch('/api/admin/pickup-dictionary', {
        method: 'POST',
        body: JSON.stringify({ canonical_name: name, display_name_ko: newKo || null, address: newAddress || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '추가 실패');
      setNewName('');
      setNewKo('');
      setNewAddress('');
      toast.success('표준지점을 추가했어요.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '추가 실패');
    } finally {
      setBusy(null);
    }
  };

  const addAlias = async (locationId: string) => {
    const alias = window.prompt('이 지점으로 모을 표기를 적어주세요 (예: 롯데호텔 제주)');
    if (!alias?.trim()) return;
    setBusy(locationId);
    try {
      const res = await authedFetch('/api/admin/pickup-dictionary', {
        method: 'POST',
        body: JSON.stringify({ location_id: locationId, alias }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '별칭 추가 실패');
      toast.success(json.duplicate ? '이미 등록된 표기예요.' : '별칭을 추가했어요.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '별칭 추가 실패');
    } finally {
      setBusy(null);
    }
  };

  const decide = async (queueId: string, decision: 'approve' | 'reject', locationId?: string) => {
    setBusy(queueId);
    try {
      const res = await authedFetch('/api/admin/pickup-dictionary', {
        method: 'PATCH',
        body: JSON.stringify({ queue_id: queueId, decision, ...(locationId ? { location_id: locationId } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '처리 실패');
      toast.success(decision === 'approve' ? '사전에 넣었어요. 다음 예약부터 자동으로 잡혀요.' : '무시했어요.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '처리 실패');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-cjk-safe text-xl font-bold text-stone-900">픽업 표준지점 사전</h1>
        <p className="text-cjk-body mt-1 text-sm text-stone-600">
          예약마다 다르게 적히는 픽업지 표기를 하나의 표준지점으로 모읍니다. 한 번 등록하면 다음부터 자동으로 잡혀
          손으로 고칠 일이 줄어듭니다.
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-cjk-safe text-sm font-bold text-stone-900">표준지점 추가</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="표준 이름 (예: Lotte City Hotel Jeju)"
            className="h-10 rounded-lg border border-stone-300 px-3 text-sm"
            data-testid="new-canonical-name"
          />
          <input
            value={newKo}
            onChange={(e) => setNewKo(e.target.value)}
            placeholder="한국어 표시명 (선택)"
            className="h-10 rounded-lg border border-stone-300 px-3 text-sm"
          />
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="주소 (선택)"
            className="h-10 rounded-lg border border-stone-300 px-3 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy === 'new' || !newName.trim()}
          onClick={() => void addLocation()}
          className="text-cjk-safe mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
          data-testid="add-location"
        >
          <Plus className="size-4" /> 추가
        </button>
      </section>

      {queue.length > 0 && (
        <section>
          <h2 className="text-cjk-safe text-sm font-bold text-stone-900">확인 대기 {queue.length}건</h2>
          <p className="text-cjk-body mt-1 text-xs text-stone-500">
            파싱 중에 만난 새 표기들입니다. 어느 지점인지 정해 주시면 다음부터 자동으로 잡힙니다.
          </p>
          <ul className="mt-2 space-y-2">
            {queue.map((q) => (
              <li key={q.id} className="text-cjk-safe rounded-xl border border-stone-200 bg-white p-3" data-testid={`queue-${q.id}`}>
                <p className="break-all text-sm text-stone-800">{q.raw_value}</p>
                <p className="mt-0.5 text-xs text-stone-500">{q.occurrence_count}회 등장</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <select
                    defaultValue={q.proposed_canonical_id ?? ''}
                    onChange={(e) => e.target.value && void decide(q.id, 'approve', e.target.value)}
                    className="h-9 rounded-lg border border-stone-300 px-2 text-xs"
                    data-testid={`queue-select-${q.id}`}
                  >
                    <option value="">지점 고르기…</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.canonical_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void decide(q.id, 'reject')}
                    className="text-cjk-safe inline-flex h-9 items-center gap-1 rounded-lg bg-stone-100 px-3 text-xs font-semibold text-stone-700 disabled:opacity-40"
                  >
                    <X className="size-3.5" /> 무시
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-cjk-safe text-sm font-bold text-stone-900">표준지점 {locations.length}곳</h2>
        {loading ? (
          <p className="mt-2 text-sm text-stone-500">불러오는 중…</p>
        ) : locations.length === 0 ? (
          <p className="text-cjk-body mt-2 text-sm text-stone-500">
            아직 비어 있습니다. 사전이 비어 있으면 픽업지 표기는 계속 손으로 고쳐야 합니다 — 자주 쓰는 지점부터
            등록해 보세요.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {locations.map((l) => (
              <li key={l.id} className="rounded-xl border border-stone-200 bg-white p-3" data-testid={`location-${l.id}`}>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-stone-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-cjk-safe text-sm font-semibold text-stone-900">{l.canonical_name}</p>
                    {l.display_name_ko && <p className="text-cjk-body text-xs text-stone-600">{l.display_name_ko}</p>}
                    {l.address && <p className="text-cjk-body text-xs text-stone-500">{l.address}</p>}
                    <p className="mt-1 text-xs text-stone-500">
                      {l.aliases.length === 0 ? '별칭 없음' : `별칭 ${l.aliases.length}개`}
                      {l.lat == null && ' · 좌표 없음(근접 매칭 불가)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => void addAlias(l.id)}
                    className="text-cjk-safe inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-stone-100 px-3 text-xs font-semibold text-stone-700 disabled:opacity-40"
                    data-testid={`add-alias-${l.id}`}
                  >
                    <Plus className="size-3.5" /> 표기 추가
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-cjk-body flex items-start gap-1.5 text-xs text-stone-500">
        <Check className="mt-0.5 size-3.5 shrink-0" />
        표기는 저장할 때 조회와 같은 방식으로 정규화됩니다 — 띄어쓰기·하이픈·괄호가 달라도 같은 것으로 잡힙니다.
      </p>
    </div>
  );
}
