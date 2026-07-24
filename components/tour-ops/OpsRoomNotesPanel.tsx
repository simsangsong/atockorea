'use client';

/**
 * §K B4.4 — 관제 룸 드로어의 명단 메모.
 *
 * 🔴 B4-D4 — 표시 위치 3곳(가이드 명단 행 · 게스트 카드 · **여기**)이 같은
 * 소스를 읽는다. `/api/ops/rooms/[roomId]/notes` 하나뿐이라 세 화면이 어긋날
 * 방법이 없다 — 관제가 자기 테이블을 따로 가지면 그날부터 갈라진다.
 *
 * 🔴 B4-D1 — 손님이 선언한 `needs`와 섞지 않는다. 이 패널은 **운영자가 쓴 것**만
 * 보여준다. 알레르기가 여기 섞여 보이면 누가 말한 건지 알 수 없어지고, 그러면
 * 그 표시를 믿을 수 없게 된다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, StickyNote } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import { GUEST_NOTE_MAX, noteAttribution, type GuestNote } from '@/lib/ops/seating/guestNotes';

interface GuestRow {
  bookingId: string;
  name: string;
}

export default function OpsRoomNotesPanel({ roomId, guests }: { roomId: string; guests: GuestRow[] }) {
  const [notes, setNotes] = useState<Map<string, GuestNote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/ops/rooms/${roomId}/notes`, {
        cache: 'no-store',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return;
      const json = (await res.json()) as { notes?: GuestNote[] };
      setNotes(new Map((json.notes ?? []).map((n) => [n.bookingId, n])));
    } catch {
      /* 메모 없이도 드로어는 그대로 뜬다 */
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (bookingId: string, text: string) => {
      setBusy(true);
      try {
        const token = await getOpsToken();
        const res = await fetch(`/api/ops/rooms/${roomId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          body: JSON.stringify({ bookingId, note: text }),
        });
        if (!res.ok) throw new Error('save_failed');
        setEditing(null);
        await load();
      } catch {
        toast.error('메모를 저장하지 못했어요.');
      } finally {
        setBusy(false);
      }
    },
    [roomId, load],
  );

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <Loader2 className="size-4 animate-spin text-[var(--tr-ink-3)]" />
      </div>
    );
  }

  return (
    <div className="min-h-[160px] flex-1 space-y-2 overflow-y-auto px-4 py-3" data-testid="ops-notes-panel">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tr-ink-3)]">
        <StickyNote className="size-3" />
        운영 메모 <span className="font-normal">(손님에게 보이지 않음 · 투어 후 30일 자동 삭제)</span>
      </p>

      {guests.length === 0 && (
        <p className="py-6 text-center text-[12px] text-[var(--tr-ink-3)]">이 그룹에 손님이 없어요.</p>
      )}

      {guests.map((guest) => {
        const note = notes.get(guest.bookingId) ?? null;
        const isEditing = editing === guest.bookingId;
        return (
          <div
            key={guest.bookingId}
            className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-2.5"
            data-testid="ops-note-row"
          >
            <p className="text-[12px] font-bold text-[var(--tr-ink)]">{guest.name}</p>
            {isEditing ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={GUEST_NOTE_MAX}
                  rows={3}
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-2 text-[12px] text-[var(--tr-ink)]"
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="h-8 rounded-lg px-3 text-[11px] font-medium text-[var(--tr-ink-2)]"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(guest.bookingId, draft)}
                    className="h-8 rounded-lg bg-[var(--tr-accent)] px-3 text-[11px] font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                  >
                    저장
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(note?.note ?? '');
                  setEditing(guest.bookingId);
                }}
                className="mt-1 w-full text-left text-[12px] leading-relaxed text-[var(--tr-ink-2)]"
              >
                {note?.note ? (
                  <>
                    <span className="whitespace-pre-wrap">{note.note}</span>
                    {/* 출처를 지우지 않는다 — 메모는 사실이 아니라 관찰이다. */}
                    <span className="mt-0.5 block text-[10px] text-[var(--tr-ink-3)]">{noteAttribution(note)}</span>
                  </>
                ) : (
                  <span className="text-[var(--tr-ink-3)]">탭해서 메모 추가</span>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
