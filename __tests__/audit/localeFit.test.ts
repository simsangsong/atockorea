/**
 * @jest-environment node
 *
 * §D A0.4 — 로케일 적합성 하니스.
 *
 * 계약:
 *   1. 판정 기준은 문자 수가 아니라 **끊을 수 없는 토큰 길이**다.
 *   2. CJK는 글자 단위로 끊기므로 길어도 위험이 아니다.
 *   3. 좁은 컨테이너와 넓은 산문을 구분한다 — 안 하면 리포트가 산문에 묻힌다.
 *   4. 번역 누락은 그 자리에 영어가 노출되는 것이므로 따로 잡는다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  findFitRisks,
  findMissingKeys,
  flattenMessages,
  longestUnbreakableRun,
  surfaceOf,
} from '@/lib/audit/localeFit';
import { locales } from '@/lib/locale';

describe('longestUnbreakableRun', () => {
  it('공백으로 끊는다', () => {
    expect(longestUnbreakableRun('hello world')).toBe(5);
  });

  it('🔴 독일어 합성어가 실제 위험 — 한 덩어리로 센다', () => {
    expect(longestUnbreakableRun('Benachrichtigungseinstellungen')).toBe(30);
  });

  it('하이픈·슬래시도 줄바꿈 기회다', () => {
    expect(longestUnbreakableRun('anti-inflammatory')).toBe(12); // 'inflammatory'
    expect(longestUnbreakableRun('and/or')).toBe(3);
  });

  it('🔴 CJK는 글자 단위로 끊기므로 길어도 위험이 아니다', () => {
    // 같은 "길이"라도 한국어·중국어·일본어는 컨테이너를 밀지 않는다.
    expect(longestUnbreakableRun('알림설정을저장했습니다')).toBe(0);
    expect(longestUnbreakableRun('通知設定を保存しました')).toBe(0);
  });

  it('빈 문자열은 0', () => {
    expect(longestUnbreakableRun('')).toBe(0);
    expect(longestUnbreakableRun('   ')).toBe(0);
  });
});

describe('surfaceOf — 좁은 컨테이너와 산문을 가른다', () => {
  it('약관·정책 네임스페이스는 산문이다', () => {
    expect(surfaceOf('terms.s14.p3')).toBe('prose');
    expect(surfaceOf('privacy.s10.p1')).toBe('prose');
    expect(surfaceOf('cookiePolicy.s3.li1')).toBe('prose');
  });

  it('문단 꼬리표가 붙은 키도 산문이다', () => {
    expect(surfaceOf('home.hero.description')).toBe('prose');
    expect(surfaceOf('tour.detail.body')).toBe('prose');
  });

  it('버튼·라벨은 좁은 컨테이너다 — 여기가 실제로 터진다', () => {
    expect(surfaceOf('settingsPage.saveNotifications')).toBe('chrome');
    expect(surfaceOf('nav.myPage')).toBe('chrome');
    expect(surfaceOf('home.footer.terms')).toBe('chrome');
  });
});

describe('findFitRisks', () => {
  const bundles = {
    en: { 'nav.save': 'Save notification settings', 'terms.p1': 'A long legal paragraph goes here.' },
    de: {
      'nav.save': 'Benachrichtigungseinstellungen speichern',
      'terms.p1': 'Ein sehr langer Rechtstext mit Benachrichtigungseinstellungen darin.',
    },
    ko: { 'nav.save': '알림 설정 저장', 'terms.p1': '긴 법률 문단이 여기 들어간다.' },
  };

  const risks = findFitRisks(bundles);

  it('긴 무공백 토큰을 잡는다', () => {
    expect(risks.some((r) => r.locale === 'de' && r.key === 'nav.save')).toBe(true);
  });

  it('🔴 좁은 컨테이너가 산문보다 먼저 온다 — 아니면 진짜 위험이 묻힌다', () => {
    expect(risks[0].surface).toBe('chrome');
  });

  it('CJK는 후보가 아니다', () => {
    expect(risks.some((r) => r.locale === 'ko')).toBe(false);
  });

  it('기준 로케일 자신은 후보가 아니다', () => {
    expect(risks.some((r) => r.locale === 'en')).toBe(false);
  });

  it('짧은 문자열은 길이 배수가 튀어도 무시한다 (예: OK → Хорошо)', () => {
    const short = findFitRisks({ en: { 'nav.ok': 'OK' }, ru: { 'nav.ok': 'Хорошо' } });
    expect(short).toEqual([]);
  });
});

describe('findMissingKeys', () => {
  it('누락을 잡는다 — 그 자리엔 영어가 그대로 노출된다', () => {
    const out = findMissingKeys({ en: { a: '1', b: '2' }, de: { a: 'eins' } });
    expect(out).toEqual([{ locale: 'de', missing: ['b'] }]);
  });

  it('누락이 없으면 빈 배열', () => {
    expect(findMissingKeys({ en: { a: '1' }, de: { a: 'eins' } })).toEqual([]);
  });
});

describe('🔴 실제 번들 — 10 로케일 키 누락 0', () => {
  const bundles: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    const file = path.join(process.cwd(), 'messages', `${locale}.json`);
    try {
      bundles[locale] = flattenMessages(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      /* 없는 로케일은 아래 개수 검사에서 드러난다 */
    }
  }

  it('10 로케일 번들이 전부 존재한다', () => {
    expect(Object.keys(bundles).sort()).toEqual([...locales].sort());
  });

  it('실제로 읽었다 (키 2000개 이상)', () => {
    expect(Object.keys(bundles.en ?? {}).length).toBeGreaterThan(2000);
  });

  it('🔴 어느 로케일도 키를 빠뜨리지 않았다', () => {
    const missing = findMissingKeys(bundles);
    expect(missing.map((m) => `${m.locale}: ${m.missing.length}`)).toEqual([]);
  });
});
