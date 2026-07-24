/**
 * §K B0.3b — 채널 중립 템플릿 계약.
 *
 * 🔴 이 스위트의 요점은 **wa.me와 이메일이 같은 어휘를 쓴다**는 것이다.
 * 이전에는 wa.me가 `{guest_name}`, 이메일이 `{guestName}`을 썼다 — 같은 것을
 * 두 이름으로 부르는 상태였고, 문구를 고칠 때 한쪽만 고쳐지는 드리프트가
 * 예약돼 있었다(B0-D1b가 경고한 것).
 */

import {
  TEMPLATE_TOKEN_LIST,
  missingRequired,
  renderTemplate,
  tokensUsed,
  unknownTokens,
  type MessageVars,
} from '../template';
import { renderWaTemplate } from '@/lib/ops/whatsapp/wa-deep-link';
import { buildInviteEmail } from '@/lib/ops/seating/inviteEmailCopy';

const vars: MessageVars = {
  guestName: 'Massimo',
  tourName: 'Jeju Grand Highlights',
  tourDate: '2026-08-17',
  pickupPoint: 'Lotte Hotel',
  pickupTime: '08:00',
  roomLink: 'https://atockorea.com/tour-mode/room/b1?rt=tok',
  passLink: 'https://atockorea.com/pass',
  operatorName: 'AtoC Korea',
};

describe('renderTemplate', () => {
  it('계약 토큰을 전부 채운다', () => {
    for (const token of TEMPLATE_TOKEN_LIST) {
      expect(renderTemplate(token, vars)).not.toBe(token);
    }
  });

  it('{pickup}은 장소+시각을 합친다', () => {
    expect(renderTemplate('{pickup}', vars)).toBe('Lotte Hotel 08:00');
  });

  it('픽업 시각이 없으면 장소만', () => {
    expect(renderTemplate('{pickup}', { ...vars, pickupTime: null })).toBe('Lotte Hotel');
  });

  it('🔴 모르는 토큰은 그대로 남는다 — 조용히 지우면 정보 빠진 메시지가 나간다', () => {
    expect(renderTemplate('{typo_here}', vars)).toBe('{typo_here}');
  });

  it('값이 없는 토큰은 빈 문자열이지 "null"이 아니다', () => {
    expect(renderTemplate('[{room_link}]', { guestName: 'A' })).toBe('[]');
  });

  it('{operator}는 기본값이 있다 — 발신자 이름이 빈 채로 나가면 안 된다', () => {
    expect(renderTemplate('{operator}', { guestName: 'A' })).toBe('AtoC Korea');
  });
});

describe('🔴 wa.me와 이메일이 같은 어휘를 쓴다 (B0-D1b)', () => {
  it('wa 렌더러는 채널 중립 렌더러와 같은 결과를 낸다', () => {
    const body = '{guest_name}님, {tour_date} {tour_name} — {room_link}';
    expect(renderWaTemplate(body, vars)).toBe(renderTemplate(body, vars));
  });

  it('초대 메일이 wa.me와 같은 토큰으로 채워진다 (camelCase 토큰이 남아 있지 않다)', () => {
    const mail = buildInviteEmail('en', {
      guestName: 'Massimo',
      tourTitle: 'Jeju Grand Highlights',
      tourDate: '2026-08-17',
      inviteUrl: 'https://atockorea.com/tour-mode/room/b1?rt=tok',
    });
    const all = `${mail.subject} ${mail.html} ${mail.text}`;
    // 값이 실제로 들어갔다
    expect(all).toContain('Massimo');
    expect(all).toContain('Jeju Grand Highlights');
    expect(all).toContain('2026-08-17');
    // 🔴 옛 어휘가 치환되지 않은 채 남아 있지 않다
    expect(all).not.toContain('{guestName}');
    expect(all).not.toContain('{tourTitle}');
    expect(all).not.toContain('{tourDate}');
    expect(all).not.toContain('{inviteUrl}');
    // 새 어휘도 미치환으로 남지 않았다
    expect(all).not.toContain('{guest_name}');
    expect(all).not.toContain('{tour_name}');
    expect(all).not.toContain('{room_link}');
  });

  it('5로케일 전부 같은 계약으로 렌더된다', () => {
    for (const locale of ['en', 'ko', 'zh', 'ja', 'es']) {
      const mail = buildInviteEmail(locale, {
        guestName: '홍길동',
        tourTitle: '제주 하이라이트',
        tourDate: '2026-08-17',
        inviteUrl: 'https://atockorea.com/x',
      });
      expect(`${mail.subject} ${mail.text}`).not.toMatch(/\{[a-z_A-Z]+\}/);
    }
  });
});

describe('템플릿 편집 보조', () => {
  it('본문이 실제로 쓰는 토큰만 돌려준다', () => {
    expect(tokensUsed('{guest_name} / {room_link}').sort()).toEqual(['{guest_name}', '{room_link}']);
  });

  it('계약 밖 토큰을 짚어준다 — "이건 안 채워집니다"라고 말할 수 있게', () => {
    expect(unknownTokens('{guest_name} {seat_number} {seat_number}')).toEqual(['{seat_number}']);
  });

  it('🔴 채우지 못한 필수 변수를 잡는다 — 링크 자리가 빈 메시지가 가장 흔한 사고다', () => {
    expect(missingRequired('{guest_name} {room_link}', { guestName: 'Massimo' })).toEqual(['{room_link}']);
    expect(missingRequired('{guest_name} {room_link}', vars)).toEqual([]);
  });
});
