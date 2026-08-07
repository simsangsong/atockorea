/**
 * gen-grammar-grid — the messenger VERB grid, measured from source (G0).
 *
 * The chat claims KakaoTalk grammar; nobody had a grid of which verbs exist.
 * The plan's hand-written v0 table was wrong within the hour — it filed
 * "jump to bottom" as unknown when ChatFeed has carried a new-message badge
 * (`awayCount`) all along. Hand tables age; this one is generated.
 *
 * Each verb is a PROBE: files + a pattern. Present = the pattern hits.
 * Probes are facts, not judgements — WHY a verb is absent (deliberate,
 * unwired engine, or truly missing) is G1's job and lives in the ledger.
 *
 * UX-000 discipline:
 *  - a probed file that is missing or near-empty is a hard failure, not a
 *    quiet "absent" (0 must prove the target existed)
 *  - the collector self-checks: if fewer than 8 verbs come back present the
 *    grid is broken, because we KNOW the room chat is richer than that
 *
 * Usage:
 *   node scripts/gen-grammar-grid.mjs           # (re)write docs/audit/GRAMMAR-GRID.md
 *   node scripts/gen-grammar-grid.mjs --check   # exit 1 when the committed doc is stale
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'audit', 'GRAMMAR-GRID.md');

const CHAT = 'components/tour-mode/ChatFeed.tsx';
const COMPOSER = 'components/tour-mode/Composer.tsx';
const DRAWER = 'components/tour-mode/RoomDrawer.tsx';
const LIGHTBOX = 'components/tour-mode/Lightbox.tsx';
const COCKPIT = 'components/tour-mode/cockpit/Cockpit.tsx';
const MSG_ROUTE = 'app/api/tour-rooms/[bookingId]/messages/route.ts';
const UNSEND_ROUTE = 'app/api/tour-rooms/[bookingId]/messages/[messageId]/route.ts';
const EMOJI_SET = 'lib/tour-room/emoji.ts';

/**
 * Emoji counts come from the module, not from whichever component happened to
 * hit the probe — the set moved out of ChatFeed on 2026-08-07 and a probe that
 * counts quotes in the *renderer* would have started reporting 0 while the
 * feature was fine. Listing EMOJI_SET in `files` keeps the missing/empty guard
 * on it even when the pattern matches elsewhere.
 */
const emojiCounts = () => {
  const src = readFileSync(path.join(ROOT, EMOJI_SET), 'utf8');
  const quick = (src.match(/export const QUICK_REACTIONS = \[([^\]]*)\]/)?.[1].match(/'/g) ?? []).length / 2;
  // Count the `emoji: [...]` arrays, not the whole EMOJI_GROUPS block — the
  // block also carries a quoted `key:` per shelf, and counting those would
  // report four phantom glyphs. A `...QUICK_REACTIONS` spread contributes its
  // own length.
  const shelves = [...src.matchAll(/emoji:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  const picker = shelves.reduce(
    (sum, body) =>
      sum +
      (body.match(/'/g) ?? []).length / 2 +
      (body.match(/\.\.\.QUICK_REACTIONS/g) ?? []).length * quick,
    0,
  );
  return { quick, picker, shelves: shelves.length };
};

/** verb → probe. `must` marks verbs the self-check requires to be present. */
const VERBS = [
  { name: '답장 (인용 + 원본 점프)', files: [CHAT], pattern: /reply-jump/, must: true },
  {
    name: '반응 이모지 (액션 시트 빠른 세트)',
    files: [CHAT, EMOJI_SET],
    pattern: /data-testid="quick-reactions"/,
    must: true,
    detail: () => `${emojiCounts().quick}종 · 소형 1행 (사장님 2026-08-07)`,
  },
  { name: '복사', files: [CHAT], pattern: /action-copy/, must: true },
  { name: '원문 ↔ 번역 토글', files: [CHAT], pattern: /toggleOriginal/, must: true },
  { name: '삭제 (unsend, 15분 툼스톤)', files: [CHAT, UNSEND_ROUTE], pattern: /action-unsend|UNSEND_WINDOW_MS/, must: true },
  { name: '읽음 표시', files: [CHAT], pattern: /read-mark/, must: true },
  { name: '타이핑 표시', files: [CHAT], pattern: /typingUsers/, must: true },
  { name: '안읽음 구분선', files: [CHAT], pattern: /unreadDividerHere/, must: true },
  { name: '아래로 점프 + 새 메시지 배지', files: [CHAT], pattern: /awayCount/, must: true },
  { name: '음성 메시지 왕복 (STT→번역 / 한국어 TTS)', files: [MSG_ROUTE, COCKPIT], pattern: /transcribeAudioFile|tts\?messageId/, must: true },
  { name: '사진·파일·링크 모아보기 + 더 보기', files: [DRAWER], pattern: /drawer-images-more/, must: true },
  { name: '사진 단건 저장', files: [LIGHTBOX], pattern: /lightbox-download/, must: true },
  // ── the absences the grid must keep watching (a hit here flips the row) ──
  { name: '전달 (forward)', files: [CHAT, COMPOSER], pattern: /forward|전달하기/i },
  { name: '메시지 단위 공유 (텍스트만, §5-2)', files: [CHAT], pattern: /shareTimelineText|action-share/ },
  { name: '채팅 내 검색 (§5-3)', files: [DRAWER], pattern: /drawer-search-input/ },
  {
    name: '컴포저 이모지 피커',
    files: [COMPOSER, EMOJI_SET],
    pattern: /EmojiPicker|emoji-picker/i,
    // 🔴 No "N묶음" here. The set is authored in fours of eight, but the tray
    // shows no captions (사장님 2026-08-07) and this grid records what the UI
    // DOES, not how the constant is written.
    detail: () => `${emojiCounts().picker}종 · 8열 그리드 · 캐럿 삽입`,
  },
  { name: '이미지 붙여넣기 (클립보드, §5-6)', files: [COMPOSER], pattern: /onPaste|clipboardData/ },
  { name: '링크 프리뷰 (텍스트만, §5-4)', files: [CHAT], pattern: /LinkPreviewCard/ },
  { name: '사진 일괄 저장', files: [DRAWER], pattern: /downloadAll|일괄 저장/ },
  { name: '메시지 → 공지 승격 (가이드, §5-6)', files: [CHAT], pattern: /onPromoteToNotice/ },
];

const rows = [];
let present = 0;
for (const verb of VERBS) {
  const hits = [];
  for (const rel of verb.files) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) throw new Error(`grammar-grid: probed file missing — ${rel}`);
    const src = readFileSync(abs, 'utf8');
    if (src.length < 500) throw new Error(`grammar-grid: probed file suspiciously empty — ${rel}`);
    const m = src.match(verb.pattern);
    if (m) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push({ rel, line, src });
    }
  }
  const hit = hits[0] ?? null;
  // `partial` is explicit. It used to be inferred from "has a detail string",
  // which married the two: the moment the reaction row earned its picker and
  // stopped being partial, it would still have printed ◐ purely because it
  // still printed a count.
  const status = hit ? (verb.partial ? '◐' : '✅') : '✗';
  if (hit) present += 1;
  rows.push({
    name: verb.name,
    status,
    evidence: hit
      ? `${hit.rel}:${hit.line}${verb.detail ? ` — ${verb.detail(hit.src)}` : ''}`
      : `0 hits (${verb.files.join(' · ')})`,
  });
}

// Self-check: the collector must find the chat we know exists.
if (present < 8) {
  throw new Error(`grammar-grid: only ${present} verbs present — the collector is broken, not the app`);
}
for (const verb of VERBS.filter((v) => v.must)) {
  const row = rows.find((r) => r.name === verb.name);
  if (row.status === '✗') {
    throw new Error(`grammar-grid: "${verb.name}" probed absent — a verb we know shipped. Fix the probe or investigate the regression.`);
  }
}

const table = rows.map((r) => `| ${r.name} | ${r.status} | \`${r.evidence}\` |`).join('\n');
const content = `# GRAMMAR-GRID — 메신저 동사 격자 (생성물)

> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 — \`scripts/gen-grammar-grid.mjs\` 를 고치고 재생성한다.
> \`__tests__/audit/grammarGrid.test.ts\` 가 낡음을 잡는다.
> 플랜: \`docs/smartapp-grammar-uiux-sweep-plan-2026-08-04.md\` · 판정(왜 없는가)은 원장
> \`docs/audit/GRAMMAR-LEDGER-2026-08.md\` — 이 격자는 **사실만** 적는다.

✗ 는 결함이 아니라 후보다. 하루짜리 투어 방에서 카톡은 baseline 이지 명세가 아니다.

| 동사 | 판정 | 근거 (소스 probe) |
|---|---|---|
${table}

집계: 존재 ${present} / ${VERBS.length}
`;

if (process.argv.includes('--check')) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== content) {
    console.error('GRAMMAR-GRID.md 가 낡았다. `node scripts/gen-grammar-grid.mjs` 로 재생성할 것.');
    process.exit(1);
  }
  console.log(`grammar-grid: in sync (${present}/${VERBS.length} present)`);
} else {
  writeFileSync(OUT, content);
  console.log(`wrote docs/audit/GRAMMAR-GRID.md — ${present}/${VERBS.length} verbs present`);
}
