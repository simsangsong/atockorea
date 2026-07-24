/**
 * @jest-environment node
 *
 * §D A4.2 — client/server 경계.
 *
 * 🔴 이 스위트는 **저장소 전체를 실제로 훑는다.** §H-1이 지목한 부류 —
 * tsc·jest는 green인데 `next build --webpack`만 깨지는 — 를 빌드보다 먼저,
 * 초 단위로 잡는다. 실제로 main을 배포 불가로 만든 적이 있는 결함이다.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  findBoundaryViolations,
  isClientModule,
  staticImports,
  type ModuleSource,
} from '@/lib/audit/clientBoundary';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];
const EXT = ['.ts', '.tsx'];

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const rel = path.join(dir, entry);
    const full = path.join(ROOT, rel);
    if (statSync(full).isDirectory()) walk(rel, out);
    else if (EXT.includes(path.extname(entry)) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

/** `@/x` 별칭과 상대 경로를 프로젝트 경로로. 외부 패키지는 null. */
function resolveSpec(importer: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(importer.replace(/\\/g, '/')), spec);
  else return null;

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.posix.join(base, 'index.ts'),
    path.posix.join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(ROOT, c))) return c.replace(/\\/g, '/');
  }
  return null;
}

const files = SCAN_DIRS.flatMap((d) => walk(d));
const modules = new Map<string, ModuleSource>(
  files.map((f) => [f.replace(/\\/g, '/'), { path: f, source: readFileSync(path.join(ROOT, f), 'utf8') }]),
);

describe('스캐너 자체', () => {
  it('저장소를 실제로 읽었다 (경로 오타로 통과하는 것을 막는다)', () => {
    expect(modules.size).toBeGreaterThan(500);
  });

  it("'use client'를 파일 앞에서만 인정한다", () => {
    expect(isClientModule("'use client';\nimport x from 'y'")).toBe(true);
    expect(isClientModule('/** doc */\n\n"use client";')).toBe(true);
    // 본문 중간의 문자열은 지시자가 아니다.
    expect(isClientModule("const s = \"use client\";")).toBe(false);
    expect(isClientModule("import x from 'y'")).toBe(false);
  });

  it('정적 import만 잡는다 — 동적 import는 번들에 안 들어가므로 위반이 아니다', () => {
    expect(staticImports("import a from 'x';\nexport * from 'y';")).toEqual(['x', 'y']);
    // 이 저장소는 서버 모듈을 동적 import로 격리하는 패턴을 의도적으로 쓴다.
    expect(staticImports("const m = await import('./usage.server');")).toEqual([]);
  });
});

describe('🔴 client 번들이 서버 전용 모듈을 끌어오지 않는다', () => {
  const violations = findBoundaryViolations(modules, resolveSpec);

  it('위반 0', () => {
    const report = violations
      .map((v) => `${v.clientFile}\n    ← ${v.offender} (${v.patternId})\n    chain: ${v.chain.join(' → ')}`)
      .join('\n\n');
    expect(report).toBe('');
  });
});

describe('탐지가 실제로 동작한다 (합성 케이스)', () => {
  const mk = (entries: Array<[string, string]>) =>
    new Map<string, ModuleSource>(entries.map(([p, s]) => [p, { path: p, source: s }]));

  it('직접 위반을 잡는다', () => {
    const mods = mk([['components/A.tsx', "'use client';\nimport { readFile } from 'node:fs';"]]);
    const out = findBoundaryViolations(mods, () => null);
    expect(out).toHaveLength(1);
    expect(out[0].offender).toBe('node:fs');
  });

  it('🔴 전이 위반을 잡는다 — 실제로 깨지는 건 대부분 이쪽이다', () => {
    const mods = mk([
      ['components/A.tsx', "'use client';\nimport { helper } from '@/lib/mid';"],
      ['lib/mid.ts', "import sharp from 'sharp';\nexport const helper = 1;"],
    ]);
    const out = findBoundaryViolations(mods, (_i, spec) => (spec === '@/lib/mid' ? 'lib/mid.ts' : null));
    expect(out).toHaveLength(1);
    expect(out[0].offender).toBe('sharp');
    expect(out[0].chain).toEqual(['components/A.tsx', 'lib/mid.ts']);
  });

  it('`.server` 접미사를 위반으로 본다 — 이 저장소의 규약이다', () => {
    const mods = mk([['components/A.tsx', "'use client';\nimport { x } from '@/lib/tour-room/eta.server';"]]);
    expect(findBoundaryViolations(mods, () => null)[0].patternId).toBe('dot-server');
  });

  it('server 컴포넌트는 검사 대상이 아니다 — 거기선 node:fs가 정상이다', () => {
    const mods = mk([['app/page.tsx', "import { readFile } from 'node:fs';"]]);
    expect(findBoundaryViolations(mods, () => null)).toEqual([]);
  });

  it('순환 import에서 멈춘다', () => {
    const mods = mk([
      ['components/A.tsx', "'use client';\nimport '@/lib/a';"],
      ['lib/a.ts', "import '@/lib/b';"],
      ['lib/b.ts', "import '@/lib/a';"],
    ]);
    const resolve = (_i: string, spec: string) =>
      spec === '@/lib/a' ? 'lib/a.ts' : spec === '@/lib/b' ? 'lib/b.ts' : null;
    expect(findBoundaryViolations(mods, resolve)).toEqual([]);
  });
});
