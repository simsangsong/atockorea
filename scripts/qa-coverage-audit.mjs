/**
 * 나노 단위 커버리지 감사.
 *
 * 라우트를 열거하고, 각각이 ① 프로덕션 하니스에 맞았는지 ② jest 가 부르는지
 * ③ 둘 다 아닌지 를 가른다. "미검증"을 감으로 말하지 않기 위한 것이다.
 *
 * 판정 근거:
 *   prod  — scripts/qa-prod-*.ts 가 그 경로를 친다
 *   jest  — __tests__ 어딘가가 그 route 모듈을 import 한다
 *   (없음) — 아무도 안 부른다
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const routes = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name === 'route.ts') {
      const src = readFileSync(f, 'utf8');
      const verbs = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);
      routes.push({
        file: f,
        url: '/' + path.relative('app', path.dirname(f)).split(path.sep).join('/'),
        verbs: [...new Set(verbs)],
      });
    }
  }
};
walk(path.join('app', 'api'));

// ── prod 하니스가 치는 경로 ──
const harnessSrc = ['scripts/qa-prod-tour-room.ts', 'scripts/qa-prod-surfaces.ts', 'scripts/qa-ops-center-queries.ts']
  .filter(existsSync)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const harnessPaths = new Set(
  [...harnessSrc.matchAll(/\/api\/[a-zA-Z0-9/_${}.\[\]-]+/g)]
    .map((m) => m[0].replace(/\$\{[^}]*\}/g, '*').replace(/\?.*/, '').replace(/\/$/, '')),
);
/**
 * `*` 는 한 세그먼트를 대신한다. 하니스가 `/api/cron/${name}` 처럼 템플릿으로
 * 여러 라우트를 도는 경우가 있어서, 문자열 동일성만 보면 **실제로 검사한
 * 라우트를 미검증으로 세게 된다** — 커버리지 수치를 실제보다 나쁘게 말한다.
 * (반대 방향의 거짓말보다는 낫지만, 어느 쪽이든 틀린 숫자다.)
 */
const segMatch = (pattern, url) => {
  const a = pattern.split('/');
  const b = url.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === '*' || seg === b[i]);
};
const hitByHarness = (url) => {
  const norm = url.replace(/\[[^\]]+\]/g, '*');
  for (const p of harnessPaths) if (segMatch(p, norm) || segMatch(norm, p)) return true;
  return false;
};
const sweepsAdminGet = /adminGetRoutes/.test(harnessSrc);

// ── jest 가 import 하는 route 모듈 ──
const testSrc = [];
const walkTests = (d) => {
  if (!existsSync(d)) return;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walkTests(f);
    else if (/\.(test|spec)\.tsx?$/.test(e.name)) testSrc.push(readFileSync(f, 'utf8'));
  }
};
walkTests('__tests__');
walkTests('lib');
const allTests = testSrc.join('\n');
const hitByJest = (url) => allTests.includes(`@/app${url}/route`);

const rows = routes.map((r) => {
  const prod = hitByHarness(r.url) || (sweepsAdminGet && r.url.startsWith('/api/admin') && r.verbs.includes('GET'));
  const jest = hitByJest(r.url);
  return { ...r, prod, jest };
});

const group = (u) => {
  const p = u.replace('/api/', '').split('/');
  return p[0] === 'admin' ? `admin/${p[1] ?? ''}` : p[0];
};

const untested = rows.filter((r) => !r.prod && !r.jest);
const byGroup = new Map();
for (const r of untested) {
  const g = group(r.url);
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(r);
}

console.log(`총 라우트 ${rows.length}`);
console.log(`  프로덕션 하니스가 침   ${rows.filter((r) => r.prod).length}`);
console.log(`  jest 가 부름           ${rows.filter((r) => r.jest).length}`);
console.log(`  둘 다 아님             ${untested.length}\n`);
console.log('둘 다 아닌 라우트 — 그룹별 (쓰기 동사가 있는 것 ★):\n');
for (const [g, list] of [...byGroup].sort((a, b) => b[1].length - a[1].length)) {
  const writes = list.filter((r) => r.verbs.some((v) => v !== 'GET')).length;
  console.log(`  ${g}  (${list.length}${writes ? `, 쓰기 ${writes}` : ''})`);
  for (const r of list) {
    const star = r.verbs.some((v) => v !== 'GET') ? '★' : ' ';
    console.log(`    ${star} ${r.url}  [${r.verbs.join(',') || '없음'}]`);
  }
}
