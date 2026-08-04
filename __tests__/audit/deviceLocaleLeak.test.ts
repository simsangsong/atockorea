/**
 * 상설 게이트 — 손님 화면의 날짜·시각은 **방의 로케일**로 찍어야 한다.
 * 기기 로케일로 새면 안 된다.
 *
 * 🔴 왜 있는가: PR #715 의 서랍 대화 검색이 `toLocaleTimeString([], …)` 로
 * 시각을 찍었다. `[]` 는 "브라우저 기본값" = **기기 로케일 · 기기 타임존**이다.
 * 실렌더로 보니 영어 방(라벨·상품명·역할 전부 영어)의 검색 결과에만
 * **「오후 08:00」** 이 한국어로 찍혀 있었다.
 *
 * 그리고 로케일보다 타임존이 더 나쁘다: 폰이 아직 고향 시간대인 손님은
 * **검색 결과의 시각과, 그 결과를 눌러 도착한 말풍선의 시각이 서로 다르게** 보인다.
 *
 * 이건 이 레포의 전형적 결함 모양이다 — **이미 있는 것을 새 소비처가 안 읽었다.**
 * `lib/tour-room/timeFormat.ts` 의 `formatBubbleTime(iso, locale)` 이 바로 이 일을
 * 하고 `ChatFeed` 는 그걸 쓴다. 서랍 검색만 우회했다.
 *
 * 규칙: 로케일 인자를 **명시**하라. 상수 태그(`'ko-KR'`)든 변수든 좋다 —
 * 콕핏은 기사 전용이라 `'ko-KR'` + `Asia/Seoul` 을 일부러 못 박고 있고 그건 정답이다.
 * 금지하는 건 **비워 두는 것**뿐이다: `[]` · `undefined` · 인자 없음.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIRS = [
  path.join(ROOT, 'components', 'tour-mode'),
  path.join(ROOT, 'components', 'admin'),
  path.join(ROOT, 'lib', 'tour-room'),
];

/**
 * `.toLocaleTimeString()` / `.toLocaleDateString()` with no locale, `undefined`,
 * or an empty array as the first argument.
 *
 * ⚠ Deliberately NOT `.toLocaleString()`. On a Number that is thousands
 * grouping, not a clock — a different and much smaller problem (a German phone
 * would render `₩1.234.567`), and changing how money prints is not a thing to
 * do blind from a lint. One site exists today,
 * `components/tour-mode/plan/PlanEditorClient.tsx` (KRW surcharge). Reported
 * here so it is not forgotten; not judged.
 */
const DEVICE_LOCALE_CALL = /\.toLocale(?:Time|Date)String\(\s*(?:\)|undefined\s*[,)]|\[\s*\]\s*[,)])/g;

/**
 * 🔴 Blank out comments before scanning, keeping line numbers.
 *
 * The first run of this gate flagged **its own fix**: the note left at the
 * repaired line in `RoomDrawer` quotes `toLocaleTimeString([])` to explain what
 * was wrong, inside a multi-line `{/* … *\/}` JSX comment. A line-by-line
 * comment strip cannot see that the line sits inside a block. Prose beside the
 * code breaking the gate is a failure mode this repo has hit from the quiet
 * direction; this is the loud one.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
  };
  DIRS.forEach(walk);
  return out;
}

type Hit = { file: string; line: number; text: string };

function leaks(): Hit[] {
  const out: Hit[] = [];
  for (const f of sourceFiles()) {
    const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
    lines.forEach((code, i) => {
      DEVICE_LOCALE_CALL.lastIndex = 0;
      if (DEVICE_LOCALE_CALL.test(code)) {
        const l = code;
        out.push({
          file: path.relative(ROOT, f).split(path.sep).join('/'),
          line: i + 1,
          text: l.trim().slice(0, 100),
        });
      }
    });
  }
  return out;
}

describe('🔴 손님 화면의 시각은 기기 로케일로 새면 안 된다', () => {
  const files = sourceFiles();

  it('소스를 실제로 읽었다 (비-공허)', () => {
    expect(files.length).toBeGreaterThan(50);
    // 이 레포는 실제로 `toLocale*String` 을 쓴다. 하나도 못 찾으면 정규식이 죽은 것이다.
    const anyCall = files.filter((f) => /\.toLocale(Time|Date)?String\(/.test(fs.readFileSync(f, 'utf8')));
    expect(anyCall.length).toBeGreaterThan(0);
  });

  it('로케일 인자를 비운 호출이 없다', () => {
    expect(leaks().map((h) => `${h.file}:${h.line}  ${h.text}`)).toEqual([]);
  });

  it('뮤테이션 — 검사기가 세 가지 빈 인자 형태를 모두 잡는다', () => {
    const bad = [
      `x.toLocaleTimeString([], { hour: '2-digit' })`,
      `x.toLocaleDateString()`,
      `x.toLocaleDateString(undefined, { month: 'short' })`,
    ];
    for (const b of bad) {
      DEVICE_LOCALE_CALL.lastIndex = 0;
      expect(DEVICE_LOCALE_CALL.test(b)).toBe(true);
    }
    // 명시된 로케일은 통과해야 한다 — 콕핏의 'ko-KR' 고정이 정답인 사례다.
    const good = [
      `x.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })`,
      `x.toLocaleDateString(LOCALE_TAG[locale])`,
      // Number grouping is out of scope on purpose — see the note on the regex.
      `Number(krw).toLocaleString()`,
    ];
    for (const g of good) {
      DEVICE_LOCALE_CALL.lastIndex = 0;
      expect(DEVICE_LOCALE_CALL.test(g)).toBe(false);
    }
  });
});
