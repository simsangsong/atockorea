/**
 * @jest-environment node
 *
 * 상설 게이트 — `user_profiles.language_preference` 가 쓸 수 있는 값은
 * **사이트 로케일 목록과 같아야 한다**.
 *
 * 왜 필요한가 (2026-07-28 전수대조에서 확정된 라이브 결함):
 * fr/de/it/ru 를 열었을 때 `lib/locale.ts` 와 생성 타입(`lib/supabase.ts`)은
 * 10개로 늘었지만 **DB CHECK 는 원래의 6개 그대로였다.** `lib/i18n.ts` 의
 * `setLocale()` 은 고른 로케일을 그대로 UPDATE 하고 그 UPDATE 를
 * `catch { console.error }` 로 감싸므로, 네 로케일의 손님은
 *   ① 화면은 프랑스어로 바뀌고
 *   ② 계정에는 저장되지 않고
 *   ③ 아무 에러도 보지 못한 채
 *   ④ 다른 기기에서 다시 영어로 돌아왔다.
 * 라이브 15행 중 fr/de/it/ru 가 0건인 것이 그 지문이었다.
 *
 * 같은 유형(코드 유니온 ⊃ DB CHECK)이 `tour_day_plans.status` 에서도 나왔고
 * (`guest_submitted` 누락 → "가이드에게 보내기"가 프로덕션에서 한 번도 성공한 적
 * 없었다), 둘 다 **타입 검사도 테스트도 잡지 못했다** — CHECK 는 DB에만 있고
 * 실패는 런타임에 삼켜지기 때문이다. 그래서 텍스트 게이트로 승격한다.
 *
 * 한계는 정직하게: 이 테스트는 **레포의 마이그레이션**을 검사하지 라이브 DB를
 * 검사하지 않는다. 이번 사고의 다른 절반이 "레포에 파일이 있는데 라이브에 적용된
 * 적이 없었다"였으므로, 로케일을 추가할 때는 이 게이트 통과 + 실제 적용 확인
 * (`select pg_get_constraintdef(...)`) 두 가지가 모두 필요하다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { locales } from '@/lib/locale';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const CONSTRAINT = 'user_profiles_language_preference_check';

/** The last migration that (re)defines the constraint — later files win. */
function latestConstraintMigration(): { file: string; body: string } {
  const hits = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, body: readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8') }))
    .filter(({ body }) => body.includes(CONSTRAINT) && /add\s+constraint/i.test(body));
  return hits[hits.length - 1];
}

/** Pull the quoted values out of the constraint's array literal. */
function allowedValues(body: string): string[] {
  const addIdx = body.toLowerCase().lastIndexOf('add constraint');
  const tail = body.slice(addIdx);
  const arrayMatch = /array\s*\[([\s\S]*?)\]/i.exec(tail);
  if (!arrayMatch) return [];
  return [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('language_preference ↔ site locales parity', () => {
  it('a migration defines the constraint at all', () => {
    expect(latestConstraintMigration()).toBeDefined();
  });

  it('the constraint allows exactly the site locales — no more, no fewer', () => {
    const { file, body } = latestConstraintMigration();
    const allowed = new Set(allowedValues(body));
    const expected = new Set<string>(locales);

    const missing = [...expected].filter((l) => !allowed.has(l));
    const extra = [...allowed].filter((l) => !expected.has(l));

    expect({ file, missing, extra }).toEqual({ file, missing: [], extra: [] });
  });

  it('no route restates the allowlist instead of deriving it from lib/locale', () => {
    // The API route froze at six because it kept its own copy. A literal set of
    // locale strings next to `language_preference` is the shape of that bug.
    const route = readFileSync(
      path.join(process.cwd(), 'app', 'api', 'auth', 'update-profile', 'route.ts'),
      'utf8',
    );
    expect(route).toContain("from '@/lib/locale'");
    expect(route).not.toMatch(/new Set\(\s*\[\s*'en'/);
  });
});
