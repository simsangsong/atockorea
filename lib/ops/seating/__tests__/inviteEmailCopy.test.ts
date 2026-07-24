/**
 * 룸 초대 이메일 5로케일 문구 — 전 로케일 존재, 변수 치환, en 폴백.
 */
import { buildInviteEmail, resolveInviteLocale } from '@/lib/ops/seating/inviteEmailCopy';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const VARS = {
  guestName: 'Massimo',
  tourTitle: 'Busan Highlights',
  tourDate: '2026-08-17',
  inviteUrl: 'https://atockorea.com/tour-mode/join/abc.def',
};

describe('buildInviteEmail — 5 locales', () => {
  it('returns a distinct subject/html/text for every room locale', () => {
    for (const locale of ROOM_LOCALES) {
      const out = buildInviteEmail(locale, VARS);
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain('<!DOCTYPE html>');
      expect(out.text.length).toBeGreaterThan(0);
      // 투어명은 제목에, 초대 URL은 본문(button href + 텍스트)에 들어간다.
      expect(out.subject).toContain('Busan Highlights');
      expect(out.html).toContain(VARS.inviteUrl);
      expect(out.text).toContain(VARS.inviteUrl);
    }
  });

  it('interpolates guestName/tourDate into the body', () => {
    const en = buildInviteEmail('en', VARS);
    expect(en.html).toContain('Massimo');
    expect(en.text).toContain('Massimo');
    expect(en.html).toContain('2026-08-17');
    const ko = buildInviteEmail('ko', VARS);
    expect(ko.html).toContain('Massimo');
    expect(ko.subject).toContain('조인투어');
  });

  it('falls back to en for an unknown/empty locale', () => {
    const en = buildInviteEmail('en', VARS);
    expect(buildInviteEmail('xx', VARS).subject).toBe(en.subject);
    expect(buildInviteEmail(null, VARS).subject).toBe(en.subject);
    expect(buildInviteEmail('fr-FR', VARS).subject).toBe(en.subject);
    // zh-TW → zh (region stripped).
    expect(resolveInviteLocale('zh-TW')).toBe('zh');
    expect(resolveInviteLocale('pt')).toBe('en');
  });

  it('escapes HTML in interpolated vars (no raw injection)', () => {
    const out = buildInviteEmail('en', { ...VARS, guestName: '<script>x</script>' });
    expect(out.html).not.toContain('<script>x</script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('uses a locale-appropriate default guest name when name is blank', () => {
    expect(buildInviteEmail('en', { ...VARS, guestName: '' }).html).toContain('Guest');
    expect(buildInviteEmail('ko', { ...VARS, guestName: '' }).html).toContain('손님');
  });
});
