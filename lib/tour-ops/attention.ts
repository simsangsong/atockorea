/**
 * W4.2 — the ops attention queue: pure rules that surface "this customer
 * wants to talk" moments without an SOS. Three signals, in priority order:
 *
 *   1. need_help — the customer sent the need_help quick-reply preset;
 *   2. keyword   — a customer message contains a distress keyword
 *                  (word-boundary match for Latin words — the chatbot's
 *                  includes() token-boundary bug is the cautionary tale —
 *                  substring match for CJK where \b doesn't exist);
 *   3. unanswered — the room's last message is from the customer and nobody
 *                  (guide/admin) has replied for 5+ minutes.
 *
 * SOS rooms are excluded: they own a louder surface already.
 */

import type { RoomMessage } from '@/hooks/useTourRoomChannel';

export type AttentionReason = 'need_help' | 'keyword' | 'unanswered';

export interface AttentionItem {
  roomId: string;
  reason: AttentionReason;
  excerpt: string;
  created_at: string;
}

export interface RoomAttentionInput {
  roomId: string;
  hasSos: boolean;
  /** Live stream messages (broadcast); may be empty before anything arrives. */
  messages: RoomMessage[];
  /** Aggregate fallback for rooms with no live traffic yet. */
  lastMessage?: { sender_role?: string; source_text?: string; created_at?: string } | null;
}

export const UNANSWERED_AFTER_MS = 5 * 60_000;
export const ATTENTION_WINDOW_MS = 2 * 60 * 60_000;

const LATIN_KEYWORDS = [
  'help', 'urgent', 'emergency', 'police', 'hospital', 'ambulance', 'injured', 'hurt',
  'lost', 'stolen', 'sick', 'accident',
  'ayuda', 'urgente', 'emergencia', 'policia', 'perdido', 'perdida', 'robado', 'herido', 'enfermo',
];
const CJK_KEYWORDS = [
  '도와', '도움', '응급', '급해', '급합', '병원', '경찰', '다쳤', '잃어버', '도난', '아파', '아픕',
  '助けて', '緊急', '病院', '警察', '迷子', '盗まれ', '怪我', '救急',
  '帮助', '紧急', '医院', '受伤', '被偷', '迷路', '生病',
];
// \b keeps "helpful"/"hospitality" from firing; CJK has no \b so substring is right there.
const LATIN_RE = new RegExp(`\\b(?:${LATIN_KEYWORDS.join('|')})\\b`, 'i');

export function matchesAttentionKeyword(text: string): boolean {
  if (!text) return false;
  if (LATIN_RE.test(text)) return true;
  return CJK_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isNeedHelpPreset(message: RoomMessage): boolean {
  const metadata = message.metadata as { kind?: string; preset_key?: string } | undefined;
  return metadata?.kind === 'quick_reply' && metadata?.preset_key === 'need_help';
}

const PRIORITY: Record<AttentionReason, number> = { need_help: 0, keyword: 1, unanswered: 2 };

export function computeAttention(rooms: RoomAttentionInput[], nowMs: number): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const room of rooms) {
    if (room.hasSos) continue;

    let best: AttentionItem | null = null;
    const consider = (candidate: AttentionItem) => {
      if (
        !best ||
        PRIORITY[candidate.reason] < PRIORITY[best.reason] ||
        (PRIORITY[candidate.reason] === PRIORITY[best.reason] && candidate.created_at > best.created_at)
      ) {
        best = candidate;
      }
    };

    for (const message of room.messages) {
      if (message._local || message.sender_role !== 'customer') continue;
      const age = nowMs - Date.parse(message.created_at);
      if (!Number.isFinite(age) || age < 0 || age > ATTENTION_WINDOW_MS) continue;
      if (isNeedHelpPreset(message)) {
        consider({ roomId: room.roomId, reason: 'need_help', excerpt: message.source_text, created_at: message.created_at });
      } else if (matchesAttentionKeyword(message.source_text)) {
        consider({ roomId: room.roomId, reason: 'keyword', excerpt: message.source_text, created_at: message.created_at });
      }
    }

    // Unanswered: judge by the true latest message — live stream tail wins
    // over the aggregate row (which may be stale between drift refreshes).
    const streamLast = [...room.messages].reverse().find((message) => !message._local) ?? null;
    const last =
      streamLast && (!room.lastMessage?.created_at || streamLast.created_at >= room.lastMessage.created_at)
        ? { sender_role: streamLast.sender_role, source_text: streamLast.source_text, created_at: streamLast.created_at }
        : room.lastMessage ?? null;
    if (last?.created_at && last.sender_role === 'customer') {
      const age = nowMs - Date.parse(last.created_at);
      if (Number.isFinite(age) && age >= UNANSWERED_AFTER_MS && age <= ATTENTION_WINDOW_MS) {
        consider({
          roomId: room.roomId,
          reason: 'unanswered',
          excerpt: last.source_text ?? '',
          created_at: last.created_at,
        });
      }
    }

    if (best) items.push(best);
  }

  items.sort((a, b) => {
    if (PRIORITY[a.reason] !== PRIORITY[b.reason]) return PRIORITY[a.reason] - PRIORITY[b.reason];
    return a.created_at > b.created_at ? -1 : 1;
  });
  return items;
}
