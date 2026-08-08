/**
 * 상설 게이트 — 입장 코드 문(entry-code plan 2026-08-08 §E P4).
 *
 * 지키는 불변식 5개:
 *  ① 소스가 쓰는 `sent_via` 리터럴 ⊆ 마이그레이션 CHECK 목록 == INVITE_SENT_VIA.
 *     'onsite-qr'·'ops-bulk-message' 가 코드에 먼저 생기고 CHECK 가 라이브에서
 *     조용히 거부하던 실사고(2026-08-08 발견)의 재발 방지 — 목록은 산출물
 *     (마이그레이션 파일)에서 뽑는다, 내가 관리하는 상수에서가 아니라.
 *  ② 발송 4지점은 345자 토큰 URL 을 손님 문구에 싣지 않는다(짧은 별칭만).
 *  ③ /room·/r/ 는 미들웨어 로케일 우회를 가진다 — 지우면 인쇄된 주소가 404.
 *  ④ D-1 자동 발송은 TOUR_ROOM_AUTO_DISPATCH 뒤에 있다(사장님 결정: 수동만).
 *  ⑤ /r/[code] 라우트는 리다이렉트 전용이다 — 토큰 발급·DB 접근이 생기면
 *     메일 스캐너의 GET 이 토큰을 찍는다(§O-1 ⑦).
 */

import fs from 'node:fs';
import path from 'node:path';
import { INVITE_SENT_VIA } from '@/lib/tour-room/entryCode';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const MIGRATION = 'supabase/migrations/20260808090000_tour_room_entry_codes.sql';

describe('entry-code doors (permanent gate)', () => {
  test('① sent_via literals in source ⊆ migration CHECK ∧ INVITE_SENT_VIA == CHECK', () => {
    const sql = read(MIGRATION);
    const block = /add constraint tour_room_invites_sent_via_check[\s\S]*?\]\)\)/.exec(sql)?.[0];
    expect(block).toBeTruthy();
    const allowed = new Set([...block!.matchAll(/'([a-z-]+)'::text/g)].map((m) => m[1]));
    expect(allowed.size).toBeGreaterThanOrEqual(8);

    // 모듈 상수와 마이그레이션이 같은 집합이어야 한다 — 한쪽만 넓히면 이 게이트가 운다.
    expect(new Set(INVITE_SENT_VIA)).toEqual(allowed);

    // 소스 전체의 sent_via 리터럴 수집 (원장에 insert 하는 쪽만 문제이므로
    // 값 비교 filter 는 제외한다: .eq("sent_via", …) 는 읽기다).
    const files = [
      ...walk(path.join(ROOT, 'app')),
      ...walk(path.join(ROOT, 'lib')),
      ...walk(path.join(ROOT, 'components')),
    ];
    const used = new Map<string, string>();
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/sent_via:\s*'([a-z-]+)'/g)) {
        used.set(m[1], path.relative(ROOT, file));
      }
    }
    for (const [value, file] of used) {
      if (!allowed.has(value)) {
        throw new Error(
          `sent_via '${value}' (${file}) 이 마이그레이션 CHECK 에 없다 — ` +
            `insert 가 라이브에서 조용히 실패한다. CHECK 를 먼저 넓혀라(${MIGRATION}).`,
        );
      }
    }
  });

  test('② 발송 4지점은 토큰 URL 대신 짧은 별칭을 조립한다', () => {
    const sendFiles = [
      'lib/tour-room/dispatch.ts',
      'lib/ops/seating/bulkInvite.ts',
      'app/api/admin/tour-ops/links/route.ts',
      'app/api/admin/tour-ops/manifest/bulk-message/route.ts',
    ];
    for (const rel of sendFiles) {
      const src = read(rel);
      // 손님에게 나가는 룸 URL 에 ?rt= 원시 토큰을 싣는 조립이 되살아나면 실패.
      expect(src).not.toMatch(/tour-mode\/room\/\$\{[^}]+\}\?rt=/);
      expect(src).not.toMatch(/tour-mode\/(guide|driver)\?rt=\$\{/);
      // 별칭 조립은 한 곳(shortLinkUrl)만 쓴다 — 드리프트 방지.
      expect(src).toContain('shortLinkUrl');
      expect(src).toContain('generateInviteShortCode');
    }
  });

  test('③ /room·/r/ 미들웨어 로케일 우회가 살아 있다', () => {
    const src = read('middleware.ts');
    expect(src).toContain("pathname === '/room'");
    expect(src).toContain("pathname.startsWith('/r/')");
  });

  test('④ D-1 자동 발송은 TOUR_ROOM_AUTO_DISPATCH 게이트 뒤에 있다', () => {
    const src = read('app/api/emails/reminders/route.ts');
    expect(src).toContain("process.env.TOUR_ROOM_AUTO_DISPATCH === '1'");
    // 게이트를 실제로 소비해야 한다 — 선언만 하고 안 읽는 형태가 이 레포의
    // 지배 결함 유형이다(declaredButUnread).
    expect(src).toMatch(/!isTourModeEnabled\(\)\s*\|\|\s*!isAutoDispatchEnabled\(\)/);
  });

  test('⑤ /r/[code] 라우트는 리다이렉트 전용(봇 안전) — 상대 Location', () => {
    const src = read('app/(app)/r/[code]/route.ts');
    expect(src).not.toContain('createServerClient');
    expect(src).not.toContain('signCustomerRoomToken');
    expect(src).not.toContain('tour_room_invites');
    expect(src).toContain('status: 307');
    // Location 은 상대 경로여야 한다 — 절대 URL 조립은 호스트를 서버가 맞히는
    // 문제가 되고, dev(-H 0.0.0.0)·프록시에서 오리진 이탈로 깨졌다(2026-08-08).
    expect(src).toMatch(/Location: `\/tour-mode/);
  });
});
