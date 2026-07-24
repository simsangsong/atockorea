/**
 * §D A4.2 — client/server 경계 정적 검사. 순수부.
 *
 * 🔴 §H-1이 이 저장소의 가장 위험한 함정으로 지목한 부류다:
 * **tsc·jest가 전부 green인데 `next build --webpack`만 깨진다.** client 페이지가
 * `node:*`나 `sharp` 같은 서버 전용 모듈을 (직접이든 전이든) import하면
 * 프로덕션 빌드만 실패하고, 실제로 main을 배포 불가 상태로 만든 적이 있다
 * (§13 `720b466c`).
 *
 * 빌드가 잡아주긴 하지만 **빌드는 느리고 늦다** — 전 파일 컴파일이 끝나야
 * 알려주고, 그때는 이미 커밋이 쌓여 있다. 이 검사는 import 그래프만 훑어
 * 초 단위로 같은 답을 낸다.
 *
 * 순수 함수라 파일 시스템을 모른다 — 호출부가 (경로 → 소스) 맵을 준다.
 */

/** 클라이언트 번들에 들어가면 안 되는 것들. */
export const SERVER_ONLY_PATTERNS: ReadonlyArray<{ id: string; test: (spec: string) => boolean }> = [
  // Node 내장 — 브라우저에 없다.
  { id: 'node-builtin', test: (s) => s.startsWith('node:') },
  { id: 'node-fs', test: (s) => s === 'fs' || s === 'fs/promises' || s === 'path' || s === 'crypto' },
  // 네이티브 바이너리.
  { id: 'sharp', test: (s) => s === 'sharp' },
  // 이 저장소의 규약: `.server` 접미사 = 서버 전용.
  { id: 'dot-server', test: (s) => /\.server$/.test(s) },
];

export interface ModuleSource {
  /** 프로젝트 루트 기준 경로. */
  path: string;
  source: string;
}

/** `'use client'`가 파일 맨 앞에 있는가(주석·빈 줄 허용). */
export function isClientModule(source: string): boolean {
  const head = source.slice(0, 400);
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(head);
}

/**
 * **런타임에 실제로 번들되는** import만 뽑는다.
 *
 * 🔴 `import type` / `export type`은 제외한다. 타입은 컴파일 시점에 지워지므로
 * 번들에 아무것도 남지 않는다. 처음 이 검사를 돌렸을 때 위반 9건이 나왔는데
 * **전부 `import type`이었다** — `snapshot.ts`가 `access.ts`에서 타입만 가져오고
 * `access.ts`가 `node:crypto`를 쓰는 구조였다. 빌드는 멀쩡했고 검사만 틀렸다.
 * 이런 오탐이 섞이면 이 검사는 며칠 만에 무시당한다.
 *
 * 🔴 `await import('...')`도 제외한다. 이 저장소는 서버 전용 모듈을 **동적
 * import로 격리하는 패턴**을 의도적으로 쓴다(`defaultCacheDb`·`usage.server`·
 * `prewarm.server`). 그건 클라이언트 번들에 들어가지 않으므로 위반이 아니고,
 * 잡으면 올바른 패턴을 쓰는 코드가 전부 빨개진다.
 *
 * ⚠ 한계: `import { type A, foo }`는 값 import로 본다(맞다).
 * `import { type A, type B }`는 전부 타입이지만 값으로 오판한다 — 이 저장소에
 * 그 형태가 없어 지금은 무해하고, 오탐이 나오면 지정자 단위로 파싱한다.
 */
export function staticImports(source: string): string[] {
  const out: string[] = [];
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;\n]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (m[1]) continue; // `import type` / `export type` — 컴파일 시 소멸
    const spec = m[2] ?? m[3];
    if (spec) out.push(spec);
  }
  return out;
}


export interface BoundaryViolation {
  /** 위반이 발견된 client 진입 파일. */
  clientFile: string;
  /** client → … → 서버 모듈 경로. */
  chain: string[];
  /** 무엇을 끌어왔나. */
  offender: string;
  patternId: string;
}

function offenderOf(spec: string): { id: string } | null {
  for (const p of SERVER_ONLY_PATTERNS) {
    if (p.test(spec)) return { id: p.id };
  }
  return null;
}

/**
 * client 모듈에서 출발해 정적 import 그래프를 따라가며 서버 전용 모듈을 찾는다.
 *
 * `resolve`는 (importer, spec) → 프로젝트 경로 또는 null(외부 패키지·해석 불가).
 * 외부 패키지는 그래프를 더 타지 않는다 — node_modules까지 훑으면 느리고,
 * 우리가 고칠 수 있는 것도 아니다.
 */
export function findBoundaryViolations(
  modules: Map<string, ModuleSource>,
  resolve: (importer: string, spec: string) => string | null,
  options: { maxDepth?: number } = {},
): BoundaryViolation[] {
  const maxDepth = options.maxDepth ?? 12;
  const violations: BoundaryViolation[] = [];

  for (const [path, mod] of modules) {
    if (!isClientModule(mod.source)) continue;

    const seen = new Set<string>([path]);
    const stack: Array<{ file: string; chain: string[] }> = [{ file: path, chain: [path] }];

    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur.chain.length > maxDepth) continue;
      const source = modules.get(cur.file)?.source;
      if (!source) continue;

      for (const spec of staticImports(source)) {
        const hit = offenderOf(spec);
        if (hit) {
          violations.push({
            clientFile: path,
            chain: cur.chain,
            offender: spec,
            patternId: hit.id,
          });
          continue;
        }
        const next = resolve(cur.file, spec);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        stack.push({ file: next, chain: [...cur.chain, next] });
      }
    }
  }

  // 같은 client 파일 + 같은 위반은 한 번만.
  const uniq = new Map<string, BoundaryViolation>();
  for (const v of violations) uniq.set(`${v.clientFile}|${v.offender}`, v);
  return [...uniq.values()].sort((a, b) => a.clientFile.localeCompare(b.clientFile));
}
