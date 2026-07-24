'use client';

/**
 * 배정 지점의 휴무 경고 배지 (§11.F trust-based NOTICE).
 *
 * 이 컴포넌트는 **아무것도 막지 않는다.** 룸·링크 관리에서 보고 있는 날짜에 휴무로
 * 등록된 가이드가 있으면 이름을 한 줄로 알려줄 뿐이다. 오늘 쉬기로 한 사람이
 * 그래도 나가기로 하는 결정은 현장에서 사람이 한다 — 시스템이 대신 판단하면
 * 사람들은 휴무를 아예 등록하지 않게 되고, 그러면 이 데이터 자체가 죽는다.
 *
 * 조용히 실패한다: 가이드 원장이 아직 비어 있거나 조회가 실패하면 아무것도 그리지
 * 않는다. 관제 화면의 주 업무(룸·링크)를 부가 정보가 방해해선 안 된다.
 */

import { useEffect, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';

interface Recommendation {
  guide: { id: string; name: string };
  unavailable: boolean;
}

export default function GuideRestNotice({ date }: { date: string }) {
  const [resting, setResting] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getOpsToken();
        const res = await fetch(`/api/admin/guides/recommend?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        const names = ((json.data ?? []) as Recommendation[])
          .filter((r) => r.unavailable)
          .map((r) => r.guide.name);
        if (!cancelled) setResting(names);
      } catch {
        // 부가 정보다 — 실패는 조용히 넘긴다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (resting.length === 0) return null;

  return (
    <p
      className="mx-auto mb-2 flex w-full max-w-3xl items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-700 dark:text-amber-300"
      data-testid="guide-rest-notice"
    >
      <CalendarOff className="mt-0.5 size-3.5 shrink-0" />
      <span>
        이 날짜 휴무: <strong className="font-bold">{resting.join(', ')}</strong>
        <span className="ml-1 font-normal opacity-80">— 배정은 가능합니다(참고용).</span>
      </span>
    </p>
  );
}
