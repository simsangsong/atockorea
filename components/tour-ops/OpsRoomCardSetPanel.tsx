'use client';

/**
 * 룸 카드 세트 — AtoC 통합 플랜 §5.4 C-17.
 *
 * C-16이 [투어 시작] 한 번에 5장을 발사하게 만들었지만, 무엇이 나갈지는 코드에만
 * 있었다. 이 패널이 그 구성을 운영자 손에 넘긴다 — 룸 오버라이드를 편집하고,
 * **발사 전에** 실제로 나갈 카드를 미리 본다.
 *
 * 미리보기는 팬아웃과 같은 계획 함수를 서버에서 돌린 결과다(발송·멱등키 소모
 * 없음). "미리 본 것과 실제로 나간 것이 다르다"는 상태가 성립할 수 없다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Eye, MinusCircle, TriangleAlert } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import CardSetEditor, {
  type CardSetInheritedPayload,
  type CardSetResolvedPayload,
  type CardSetSavePayload,
} from '@/components/tour-ops/CardSetEditor';
import { BRIEFING_CARD_DESCRIPTORS, type BriefingCardSetPreview } from '@/lib/ops/seating/cards/cardSet';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

// §D A4.1 — 룸 카드를 미리 보는 화면이므로 이건 **룸 로케일 집합**이다.
// 사본을 두면 로케일이 늘어난 날 미리보기만 5개로 남는다.
// 운영자 기본이 한국어라 ko를 앞으로 돌려 보여주되, 목록 자체는 정본을 쓴다.
const PREVIEW_LOCALES = ['ko', ...ROOM_LOCALES.filter((l) => l !== 'ko')] as const;
type PreviewLocale = (typeof PREVIEW_LOCALES)[number];

interface CardSetResponse {
  tour_title: string | null;
  resolved: CardSetResolvedPayload;
  inherited: CardSetInheritedPayload;
  levels: { room: { card_ids: string[] | null } | null; tour: { card_ids: string[] | null } | null };
  preview: BriefingCardSetPreview | null;
  migration_pending: boolean;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getOpsToken();
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function OpsRoomCardSetPanel({ roomId, tourId }: { roomId: string; tourId: string | null }) {
  const [data, setData] = useState<CardSetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [locale, setLocale] = useState<PreviewLocale>('ko');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/card-set`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '카드 세트를 불러오지 못했어요.');
      setData(json as CardSetResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '카드 세트를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (payload: CardSetSavePayload) => {
      setBusy(true);
      try {
        const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/card-set`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || json?.error || '저장 실패');
        toast.success(payload.card_ids ? '이 룸의 카드 세트를 저장했어요.' : '상속으로 되돌렸어요.');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '저장 실패');
      } finally {
        setBusy(false);
      }
    },
    [roomId, load],
  );

  const clear = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/card-set`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '되돌리기 실패');
      toast.success('룸 오버라이드를 지웠어요 — 상품 기본값을 따릅니다.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '되돌리기 실패');
    } finally {
      setBusy(false);
    }
  }, [roomId, load]);

  if (loading) {
    return (
      <div className="min-h-[200px] flex-1 px-4 py-3">
        <p className="text-center text-[12px] text-[var(--tr-ink-3)]">카드 세트를 불러오는 중…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-[200px] flex-1 px-4 py-3">
        <p className="text-center text-[12px] text-[var(--tr-ink-3)]">카드 세트를 불러오지 못했어요.</p>
      </div>
    );
  }

  const preview = data.preview;

  return (
    <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {data.migration_pending && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          카드 세트 테이블이 아직 없어요(마이그레이션 미적용). 지금은 <b>코드 기본 5장</b>이 그대로 나가고,
          저장은 되지 않습니다.
        </p>
      )}

      <CardSetEditor
        resolved={data.resolved}
        inherited={data.inherited}
        inheritLabel={data.levels.tour ? '상품 기본값' : '기본 세트'}
        busy={busy}
        canClear={Boolean(data.levels.room)}
        onSave={save}
        onClear={clear}
      />

      {tourId && (
        <a
          href={`/admin/tour-ops/card-sets?tour_id=${encodeURIComponent(tourId)}`}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--tr-hairline)] text-[12px] font-semibold text-[var(--tr-ink-2)]"
        >
          <ExternalLink className="size-3.5" />
          {data.tour_title ? `"${data.tour_title}" 상품 기본값 편집` : '상품 기본값 편집'}
        </a>
      )}

      <div className="rounded-xl border border-[var(--tr-hairline)]">
        <button
          type="button"
          onClick={() => setShowPreview((current) => !current)}
          className="flex h-11 w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--tr-ink-2)]"
        >
          <Eye className="size-3.5" />
          {showPreview ? '미리보기 닫기' : '지금 [투어 시작]을 누르면 나갈 카드 미리보기'}
        </button>

        {showPreview && (
          <div className="space-y-2 border-t border-[var(--tr-hairline)] p-3">
            {!preview && (
              <p className="text-[11px] text-[var(--tr-ink-3)]">
                미리보기를 만들지 못했어요 (룸에 투어·날짜 정보가 없을 수 있어요).
              </p>
            )}
            {preview && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--tr-ink-2)]">
                    {preview.tour_kind === 'private' ? '프라이빗 차터 문구' : '조인투어 문구'}
                  </span>
                  {PREVIEW_LOCALES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLocale(code)}
                      aria-pressed={locale === code}
                      className={`h-7 rounded-full px-2.5 text-[11px] font-semibold ${
                        locale === code
                          ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>

                {preview.cards.map((card) => {
                  const label = BRIEFING_CARD_DESCRIPTORS.find((row) => row.id === card.id)?.label ?? card.id;
                  return (
                    <div
                      key={card.id}
                      className="rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-2.5"
                    >
                      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-[var(--tr-ink)]">
                        {card.will_send ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <MinusCircle className="size-3.5 shrink-0 text-[var(--tr-ink-3)]" />
                        )}
                        {label}
                        {card.pushes && card.will_send && (
                          <span className="rounded bg-[var(--tr-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tr-ink-2)]">
                            푸시
                          </span>
                        )}
                      </p>
                      {card.will_send ? (
                        <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--tr-ink-2)]">
                          {card.translations?.[locale] ?? card.translations?.en ?? ''}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[var(--tr-ink-3)]">
                          {card.skipped_reason === 'already_sent'
                            ? '이미 발송된 카드예요 — 다시 나가지 않습니다.'
                            : '보낼 내용이 없어 발송되지 않아요 (예: 해석된 일정 없음).'}
                        </p>
                      )}
                    </div>
                  );
                })}
                <p className="text-[10px] leading-relaxed text-[var(--tr-ink-3)]">
                  미리보기는 실제 발송 경로와 같은 계산을 씁니다. 이 화면을 여는 것만으로는 아무것도 발송되지
                  않아요.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
