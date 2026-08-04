/**
 * gen-uiux-coverage — generates `docs/audit/UIUX-COVERAGE.md` (U1).
 *
 * 🔴 Why this is not a percentage.
 *
 * The combination space is 10 locales x 2 themes x 10 skins x 5 text scales
 * x 2 widths = 2,000 per surface-state. Full coverage is not a goal anyone
 * can hold, so "we test 4.8%" is a number that shames without informing.
 *
 * The useful question is: **does the tested subset contain the worst case on
 * every axis?** A grid that runs 96 combos but includes the longest locale,
 * the most divergent skin, the largest text step and the narrowest width is
 * worth more than one that runs 500 combos clustered in the safe middle.
 *
 * So this script reports, per axis: which members are tested, which are NOT,
 * and it leaves the extremes named so a human can see at a glance whether the
 * dangerous end of each axis is inside or outside the net.
 *
 * Every axis is read from its source of truth, never restated here, so the
 * doc cannot drift from the code the way `tour-room-theme.css` did (its
 * comment says "Six skins"; `TOUR_SKINS` has ten).
 *
 * Usage:
 *   node scripts/gen-uiux-coverage.mjs           # write the doc
 *   node scripts/gen-uiux-coverage.mjs --check   # fail if the doc is stale
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs/audit/UIUX-COVERAGE.md');
const CHECK = process.argv.includes('--check');

const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/** Pull `['a', 'b', ...]` out of `export const NAME = [...]`. */
function constArray(file, name) {
  const src = read(file);
  const m = src.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  if (!m) throw new Error(`gen-uiux-coverage: ${name} not found in ${file}`);
  const items = [...m[1].matchAll(/'([^']+)'|"([^"]+)"|(\d+)/g)].map((x) => x[1] ?? x[2] ?? x[3]);
  // 🔴 A collector that measures nothing must fail loudly, not report a
  //    cheerful zero. This trap has already been merged once on this track.
  if (items.length === 0) throw new Error(`gen-uiux-coverage: ${name} parsed to 0 members in ${file}`);
  return items;
}

/** Pull the members of a string union type: `type X = 'a' | 'b';` */
function unionMembers(file, name) {
  const src = read(file);
  const m = src.match(new RegExp(`type\\s+${name}\\s*=\\s*([^;]+);`, 'm'));
  if (!m) throw new Error(`gen-uiux-coverage: type ${name} not found in ${file}`);
  const items = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (items.length === 0) throw new Error(`gen-uiux-coverage: type ${name} parsed to 0 members`);
  return items;
}

/** Every page.tsx under a route root, as its URL path. */
function surfaces(dir) {
  const found = [];
  const walk = (d) => {
    for (const e of readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name === 'page.tsx') {
        found.push('/' + rel.replace(/^app\/\([a-z]+\)\//, '').replace(/\/page\.tsx$/, ''));
      }
    }
  };
  walk(dir);
  if (found.length === 0) throw new Error(`gen-uiux-coverage: no page.tsx under ${dir}`);
  return found.sort();
}

// ── Axis sources of truth ────────────────────────────────────────────────
const AXES = {
  locale: {
    members: constArray('lib/tour-room/snapshot.ts', 'ROOM_LOCALES'),
    sot: 'lib/tour-room/snapshot.ts ROOM_LOCALES',
    extremeNote: '가장 긴 불가분 토큰을 가진 로케일이 위험단. `npm run locale:fit` 이 판정한다.',
  },
  skin: {
    members: constArray('hooks/useTourRoomSettings.ts', 'TOUR_SKINS'),
    sot: 'hooks/useTourRoomSettings.ts TOUR_SKINS',
    extremeNote: '`contrast` 가 대비 극단, 어두운 계열(`forest`·`busan`)이 다크와 겹칠 때 위험단.',
  },
  textScale: {
    members: constArray('hooks/useTourRoomSettings.ts', 'TEXT_SCALE_STEPS'),
    sot: 'hooks/useTourRoomSettings.ts TEXT_SCALE_STEPS',
    extremeNote: '5 가 노안 최대. 레이아웃 붕괴는 여기서만 보인다.',
  },
  rallyStage: {
    members: unionMembers('lib/tour-room/notices.ts', 'RallyStage'),
    sot: 'lib/tour-room/notices.ts RallyStage',
    extremeNote: '`overdue`·`contact` 가 공지 배너를 전면 점유한다 — 다른 카드를 덮는 유일한 상태.',
  },
  theme: { members: ['light', 'dark'], sot: '고정 — .dark 캐스케이드', extremeNote: 'dark × 밝은 스킨이 캐스케이드 누수 지점.' },
};

// ── What the harnesses actually test ─────────────────────────────────────
const HARNESS = [
  { file: 'scripts/qa-hero-grid.mjs', axes: { locale: 'LOCALES', theme: 'SCHEMES', skin: 'SKINS', textScale: 'SCALES' } },
  // rallyStage was the only axis with nothing in the net (0/5) — and the one
  // that decides whether other cards render at all (P-D8). qa-rally-stages
  // seeds one meeting notice per band and renders each.
  { file: 'scripts/qa-rally-stages.mjs', axes: { rallyStage: 'RALLY_STAGES' } },
];
for (const h of HARNESS) {
  h.tested = {};
  for (const [axis, name] of Object.entries(h.axes)) {
    try {
      h.tested[axis] = constArray(h.file, name).map(String);
    } catch {
      h.tested[axis] = [];
    }
  }
  const src = read(h.file);
  h.routes = [...new Set([...src.matchAll(/\/tour-mode\/[a-zA-Z0-9\-\[\]$/{}.]*/g)].map((m) => m[0]))].sort();
}

// ── Surfaces × harness ───────────────────────────────────────────────────
const PAGES = surfaces('app/(app)/tour-mode');

/**
 * 🔴 The first cut of this matcher was a false-positive machine: it looked for
 * the bare stem, so every script that merely mentioned "tour-mode" claimed to
 * visit `/tour-mode`, and static analysers (`qa-caller-absence`,
 * `qa-route-coverage`) were listed as if they rendered pixels.
 *
 * Two corrections. A surface counts as visited only when its path appears as a
 * URL literal with a boundary after it -- so `/tour-mode` no longer swallows
 * `/tour-mode/driver`. And only harnesses that actually drive a browser count,
 * because a grep over source cannot see a layout.
 */
const routeRe = (p) => {
  const lit = p.replace(/\/\[[^\]]+\]/g, '/'); // `/room/[bookingId]` -> `/room/`
  const esc = lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // must be a URL literal, and must not continue into a deeper segment
  return new RegExp(`${esc}(?![a-zA-Z0-9\\-])`);
};

/**
 * 🔴 Most walks navigate by runtime fixture URL (`fx.room1Url`) or by env var
 * (`COCKPIT_URL`), so a source reader is structurally blind to what they open.
 * That is why `COVERS` exists: the walk declares its surfaces, and the walk
 * itself asserts at runtime that each declared surface became reachable.
 *
 * A render harness with neither a declaration nor a URL literal is reported as
 * **판정 불가**, never as "covered" and never as "not covered" -- guessing in
 * either direction is how a gate ends up reporting a cheerful zero.
 */
const ALL_WALKS = readdirSync(path.join(ROOT, 'scripts'))
  .filter((f) => /^qa-.*\.(mjs|ts)$/.test(f))
  .map((f) => {
    const src = readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    const renders = /from ['"](?:@playwright\/test|playwright)['"]/.test(src);
    let declared = null;
    /**
     * 🔴 The first cut of this regex ended at `\]` non-greedily, so it stopped
     * at the bracket inside `'/tour-mode/room/[bookingId]'` and parsed the whole
     * declaration to zero members -- and then reported that as "no declaration"
     * instead of failing. Two fixes: close on `];`, and refuse to accept an
     * empty parse. A collector that measures nothing must go red, not quiet.
     */
    const m = src.match(/export\s+const\s+COVERS\s*=\s*\[([\s\S]*?)\];/m);
    if (m) {
      declared = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      if (declared.length === 0) throw new Error(`gen-uiux-coverage: ${f} has COVERS but it parsed to 0 members`);
    }
    const literal = PAGES.filter((p) => routeRe(p).test(src));
    return { file: f, renders, declared, literal, surfaces: declared ?? literal };
  });

const WALKS = ALL_WALKS.filter((w) => w.renders && w.surfaces.length > 0);
const UNDECIDABLE = ALL_WALKS.filter((w) => w.renders && !w.declared && w.literal.length === 0);

const coveredSurfaces = new Set(WALKS.flatMap((w) => w.surfaces));
const uncoveredSurfaces = PAGES.filter((p) => !coveredSurfaces.has(p));

// A declaration that names a route which no longer exists is a silent lie.
for (const w of WALKS) {
  for (const s of w.declared ?? []) {
    if (!PAGES.includes(s)) throw new Error(`gen-uiux-coverage: ${w.file} declares COVERS '${s}' — no such page`);
  }
}

// ── Emit ─────────────────────────────────────────────────────────────────
const L = [];
L.push('# UIUX-COVERAGE — 스마트앱 UI/UX 커버리지 (U1 생성물)');
L.push('');
L.push('> 🔴 **생성물이다. 손으로 고치지 마라.** 소유자: `scripts/gen-uiux-coverage.mjs`.');
L.push('> 재생성: `node scripts/gen-uiux-coverage.mjs` · 검증: `node scripts/gen-uiux-coverage.mjs --check`');
L.push('> 플랜: `docs/smartapp-uiux-audit-master-plan-2026-08-03.md` §5 U1');
L.push('');
L.push('## 0. 이 문서가 퍼센트를 안 쓰는 이유');
L.push('');
const space = Object.values(AXES).reduce((n, a) => n * a.members.length, 1);
L.push(`조합 공간은 표면·상태당 **${space.toLocaleString()}** 이다(${Object.entries(AXES).map(([k, a]) => `${k} ${a.members.length}`).join(' × ')}).`);
L.push('전수는 아무도 감당 못 한다. 그래서 이 문서는 비율이 아니라 **"각 축의 위험단이 그물 안에 있는가"** 를 본다.');
L.push('');
L.push('## 1. 축별 커버리지');
L.push('');
for (const [axis, a] of Object.entries(AXES)) {
  const tested = new Set(HARNESS.flatMap((h) => h.tested[axis] ?? []));
  const inNet = a.members.filter((m) => tested.has(String(m)));
  const outNet = a.members.filter((m) => !tested.has(String(m)));
  L.push(`### ${axis} — 그물 안 ${inNet.length} / 전체 ${a.members.length}`);
  L.push('');
  L.push(`- **정본:** \`${a.sot}\``);
  L.push(`- **그물 안:** ${inNet.length ? inNet.map((m) => `\`${m}\``).join(' · ') : '**없음**'}`);
  L.push(`- **그물 밖:** ${outNet.length ? outNet.map((m) => `\`${m}\``).join(' · ') : '없음 ✅'}`);
  L.push(`- **위험단:** ${a.extremeNote}`);
  L.push('');
}
L.push('## 2. 표면 × 하니스');
L.push('');
L.push('실렌더(playwright) 하니스만 센다. 정적 분석 스크립트는 레이아웃을 볼 수 없다.');
L.push('출처 표기: **[선언]** = 하니스의 `COVERS` · **[리터럴]** = 소스의 URL 문자열');
L.push('');
L.push('| 표면 | 방문하는 하니스 |');
L.push('|---|---|');
for (const p of PAGES) {
  const hs = WALKS.filter((w) => w.surfaces.includes(p)).map(
    (w) => `\`${w.file}\`${w.declared ? '[선언]' : '[리터럴]'}`,
  );
  L.push(`| \`${p}\` | ${hs.length ? hs.join(' · ') : '🔴 **없음**'} |`);
}
L.push('');
L.push(`**실렌더 하니스가 한 번도 방문하지 않는 표면: ${uncoveredSurfaces.length}개**` +
  (uncoveredSurfaces.length ? ` — ${uncoveredSurfaces.map((p) => `\`${p}\``).join(' · ')}` : ' ✅'));
L.push('');
L.push(`**판정 불가 — 선언도 리터럴도 없는 실렌더 하니스: ${UNDECIDABLE.length}개**` +
  (UNDECIDABLE.length ? ` — ${UNDECIDABLE.map((w) => `\`${w.file}\``).join(' · ')}` : ' ✅'));
L.push('');
L.push('> 판정 불가는 "커버 안 됨"이 **아니다.** 런타임 URL·환경변수로 이동해서 소스가 볼 수 없다는 뜻이고,');
L.push('> 어느 쪽으로든 추측하면 게이트가 거짓말을 한다. 해소하려면 그 하니스에 `COVERS` 를 선언한다.');
L.push('');
L.push('## 3. 하니스가 선언한 축');
L.push('');
for (const h of HARNESS) {
  L.push(`### \`${h.file}\``);
  L.push('');
  for (const [axis, name] of Object.entries(h.axes)) {
    L.push(`- \`${name}\` (${axis}): ${(h.tested[axis] ?? []).map((m) => `\`${m}\``).join(' · ') || '**파싱 실패**'}`);
  }
  L.push('');
}

const body = L.join('\n') + '\n';

if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== body) {
    console.error('UIUX-COVERAGE.md 가 낡았다. `node scripts/gen-uiux-coverage.mjs` 로 재생성할 것.');
    process.exit(1);
  }
  console.log('UIUX-COVERAGE.md up to date.');
} else {
  writeFileSync(OUT, body, 'utf8');
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
  console.log(`space=${space} surfaces=${PAGES.length} uncovered=${uncoveredSurfaces.length}`);
}
