/**
 * X20 — the operations corpus: what guests ask, and what a guide actually said.
 *
 * 사장님 결정 (2026-07-29):
 *
 *   개인화(두 번째 투어에서 아는 척)     ❌ 안 한다
 *   집합 데이터(무엇을 묻고 무엇이 통했나) ✅ 모은다 — "남들이 못 따라올 운영데이터 해자"
 *
 * That split is the whole design. Personalisation startles a guest and carries
 * a privacy cost; "guests ask about toilets most in east Jeju" startles nobody
 * and cannot be bought. So this collects the second and is built so it CANNOT
 * produce the first — identifiers are dropped at construction, not filtered out
 * later.
 *
 * 🔴 What was already covered, checked rather than assumed: the marketing
 * chatbot and the in-room AI concierge both land in `chat_messages` (the
 * concierge route calls `logChatTurn`), and `harvestQaCandidates` already mines
 * that. So the gap is not "AI answers" — it is the HUMAN ones. A guide's reply
 * is the half no competitor has, and it was going nowhere.
 *
 * This widens the existing flywheel rather than starting a second one: same
 * `qa_pairs` table, same `review_status: 'draft'`, same admin review. The
 * decision said so explicitly, and a second corpus would be a second thing to
 * keep in sync.
 *
 * ⚠ What this does NOT touch: the `needs` 30-day purge (P-D11). That is
 * personal data about one guest's requirements and it keeps expiring. What
 * survives here is a question with nobody attached to it.
 */

/** A room message as the harvester needs it. Nothing here identifies a person. */
export interface RoomTurn {
  id: string;
  roomId: string;
  senderRole: string | null;
  /** Present in the source rows; deliberately never copied into a candidate. */
  senderParticipantId?: string | null;
  text: string | null;
  locale?: string | null;
  createdAt: string;
  /** System capsule kind, when the row is a capsule rather than a typed message. */
  kind?: string | null;
  /** `spot_arrival` capsules carry the POI they announced. */
  poiKey?: string | null;
}

export interface RoomQaCandidate {
  question: string;
  answer: string;
  questionLocale: string;
  answerLocale: string;
  /** Where in the day it was asked — the hour, never the date. See below. */
  hourOfDay: number | null;
  /** The stop the room had most recently arrived at, if any. */
  poiKey: string | null;
  tags: string[];
  /**
   * A stable, one-way fingerprint of the source message, so a re-run does not
   * re-propose the same pair. It points at a MESSAGE and never leaves this
   * process attached to anything that points back at a person.
   */
  fingerprint: string;
}

export interface RoomHarvestOptions {
  /** How long after a question a staff reply still counts as its answer. */
  answerWindowMs?: number;
  /** Product slug for the room, if the caller knows it. Not guest-specific. */
  tourSlug?: string | null;
}

const DEFAULT_ANSWER_WINDOW_MS = 15 * 60 * 1000;
const MIN_QUESTION_CHARS = 6;
const MIN_ANSWER_CHARS = 12;

const STAFF_ROLES = new Set(['guide', 'driver']);

/**
 * Which capsule kinds may be an ANSWER.
 *
 * A `kind` usually means the app is talking, not a person — arrival cards,
 * rally notices, quick replies. Harvesting those would fill the corpus with our
 * own copy and teach us what we already wrote.
 *
 * `caption` is the exception and the reason this is an allowlist rather than a
 * blanket skip: it is the transcription of the guide's own voice. In the live
 * table it is the single most common thing a guide produces. Excluding it would
 * have thrown away most of the human half — the half this ticket exists for.
 *
 * A question is held to the stricter rule: any `kind` disqualifies it. A guest
 * `quick_reply` is our sentence, not theirs, so "learning" from it is circular.
 */
const ANSWER_KINDS = new Set(['caption']);

/**
 * Redaction, applied to both sides before anything else looks at the text.
 *
 * Guests type phone numbers and hotel room numbers into chat, and guides type
 * them back. A corpus that keeps those is not a corpus, it is a leak with a
 * search index on it. Done here rather than at review time because a reviewer
 * reading a hundred drafts is the wrong place to notice one phone number.
 */
/*
 * 🔴 Order matters, and it is not cosmetic.
 *
 * The phone pattern matches a run of digits and separators, which is also what
 * the tail of a UUID looks like. With phone first, `d8e12b1d-1111-2222-3333-
 * 444455556666` came out as `d8e12b1d-[phone]` — the booking id's first segment
 * survived, in a corpus we were about to call de-identified. Caught by a test
 * that asserted the whole id was gone rather than that "a redaction happened".
 *
 * So: the specific, structured things first; the greedy digit run last.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  // UUIDs — booking ids, room ids, participant ids pasted into a message.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  // Anything that looks like a token from one of our own links.
  [/\brt=[A-Za-z0-9._-]{16,}/g, 'rt=[token]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  // International, Korean mobile, and hyphen/space separated runs of 9+ digits.
  [/\+?\d[\d\s().-]{7,}\d/g, '[phone]'],
];

export function redactForCorpus(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Is this guest message a question?
 *
 * Deliberately generous on punctuation and narrow on keywords. A guest writing
 * in Japanese may end with 「か」 and no question mark; a guest writing in
 * Russian may use none of our interrogatives. Punctuation catches most of it
 * across scripts, and the keyword list only has to catch what punctuation
 * misses — it is not a language detector and should not grow into one.
 */
const QUESTION_MARKS = /[?？¿؟]/;

/**
 * Latin-script interrogatives, with word boundaries.
 *
 * `\b` is ASCII-only in JavaScript, which is why Cyrillic and CJK live in the
 * pattern below instead of here. `\bгде\b` never matches: `г` is not a `\w`
 * character, so there is no boundary for `\b` to find. A Russian guest asking
 * "Где туалет" scored as a statement until a test asked for it by name.
 */
const INTERROGATIVE =
  /\b(where|when|what|which|how|can i|could i|is there|are there|do you|does it|dónde|cuándo|cómo|puedo|où|quand|comment|est-ce|wo|wann|wie|kann ich|dove|quando|come|posso)\b/i;

/** Scripts where `\b` does not work, matched as plain substrings. */
const NON_LATIN_INTERROGATIVE =
  /(어디|언제|어떻게|얼마|되나요|될까요|있나요|없나요|인가요|나요|ますか|ですか|どこ|いつ|どう|哪|什么|怎么|多少|嗎|吗|可以|где|когда|как|можно|сколько|куда)/i;

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_QUESTION_CHARS) return false;
  return QUESTION_MARKS.test(t) || INTERROGATIVE.test(t) || NON_LATIN_INTERROGATIVE.test(t);
}

/** FNV-1a, hex. Enough to dedupe; one-way, and never stored beside a person. */
export function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Pair guest questions with the staff reply that followed them.
 *
 * Turns must be for ONE room and in chronological order. The pairing is
 * deliberately conservative — one answer per question, the first staff message
 * after it, and nothing at all if another guest speaks first. A corpus of
 * confidently-wrong pairs is worse than a smaller one, because a reviewer
 * approving drafts trusts the pairing and only reads the text.
 */
export function roomQaCandidates(
  turns: readonly RoomTurn[],
  options: RoomHarvestOptions = {},
): RoomQaCandidate[] {
  const windowMs = options.answerWindowMs ?? DEFAULT_ANSWER_WINDOW_MS;
  const out: RoomQaCandidate[] = [];

  // The stop the room had most recently arrived at. Carried as context because
  // "what do guests ask AT Seongsan" is the question the corpus exists to
  // answer, and it says nothing about who asked.
  let currentPoi: string | null = null;

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    if (turn.kind === 'spot_arrival' && turn.poiKey) currentPoi = turn.poiKey;

    if (turn.senderRole !== 'customer') continue;
    if (turn.kind) continue; // a capsule, not something a guest typed
    const rawQuestion = (turn.text ?? '').trim();
    if (!rawQuestion || !looksLikeQuestion(rawQuestion)) continue;

    const askedAt = Date.parse(turn.createdAt);
    if (!Number.isFinite(askedAt)) continue;

    let answerTurn: RoomTurn | null = null;
    for (let j = i + 1; j < turns.length; j += 1) {
      const next = turns[j];
      const at = Date.parse(next.createdAt);
      if (!Number.isFinite(at) || at - askedAt > windowMs) break;
      // Another guest speaking first means we cannot tell which question the
      // staff reply answers. Drop it rather than guess.
      if (next.senderRole === 'customer') break;
      if (next.kind && !ANSWER_KINDS.has(next.kind)) continue;
      if (!next.senderRole || !STAFF_ROLES.has(next.senderRole)) continue;
      const text = (next.text ?? '').trim();
      if (!text) continue;
      answerTurn = next;
      break;
    }
    if (!answerTurn) continue;

    const question = redactForCorpus(rawQuestion);
    const answer = redactForCorpus((answerTurn.text ?? '').trim());
    if (question.length < MIN_QUESTION_CHARS || answer.length < MIN_ANSWER_CHARS) continue;

    /**
     * The hour, not the date.
     *
     * "Guests ask this at 11am" is operations. "A guest asked this on 4 August"
     * is a pointer: one date plus one tour is often one small roster, and the
     * roster is a name. Dropping the date costs the corpus nothing it is for.
     */
    const hourOfDay = new Date(askedAt).getUTCHours();

    const tags = ['source:room_message'];
    if (options.tourSlug) tags.push(`tour:${options.tourSlug}`);
    if (currentPoi) tags.push(`poi:${currentPoi}`);
    if (answerTurn.senderRole) tags.push(`answered_by:${answerTurn.senderRole}`);

    out.push({
      question,
      answer,
      questionLocale: turn.locale || 'en',
      answerLocale: answerTurn.locale || turn.locale || 'en',
      hourOfDay,
      poiKey: currentPoi,
      tags,
      fingerprint: fingerprint(`${turn.id}|${answerTurn.id}`),
    });
  }

  return out;
}
