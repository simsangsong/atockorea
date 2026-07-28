/**
 * 나비게이션 브랜드 버튼 계약 (사용자 지시 2026-07-28).
 *
 * 두 가지를 고정한다:
 *
 * ① **잉크는 브랜드색과 함께 다닌다.** 콕핏 NavRow는 티맵 파랑·네이버 초록을
 *    칠하고 라벨을 `--tr-ink`로 썼다 — 라이트 모드에서 그건 거의 검정이고,
 *    콕핏은 자기 헤더에서 라이트로 뒤집을 수 있다. 어두운 파랑 위 검정 글자는
 *    읽히지 않는다. 브랜드색에 맞는 잉크는 하나뿐이고 그건 호출부가 아니라
 *    색 옆에 있어야 한다.
 *
 * ② **시각은 글자에 맞추되 히트 영역은 44px을 지킨다.** `app/globals.css`의
 *    전역 `button, a { min-height:44px; min-width:44px }`가 11px 라벨을 44×44
 *    연회색 덩어리로 부풀렸고, 글자는 좌상단에 붙었다(사장님 스크린샷).
 *    44px은 §E 불가침이므로 없애지 않는다 — 컴팩트 스위치와 같은 처방으로
 *    **색은 안쪽 span**이 갖고, 앵커는 투명한 히트 영역으로 남는다.
 */
import { render, screen } from '@testing-library/react';
import NavBrandButton from '@/components/tour-mode/NavBrandButton';
import { NAV_BRAND, navBrandForKey } from '@/lib/tour-room/navBrand';

describe('nav brand buttons', () => {
  it.each([
    ['kakao-navi', 'kakao'],
    ['kakao-web', 'kakao'],
    ['tmap', 'tmap'],
    ['naver-car', 'naver'],
    ['google-dir', 'google'],
  ])('%s maps to the %s brand', (key, expected) => {
    expect(navBrandForKey(key)).toBe(expected);
  });

  it('paints the pill in the brand colour with the brand ink — never a theme token', () => {
    render(<NavBrandButton chipKey="tmap" label="티맵" href="#" testId="nav-tmap" />);
    const pill = screen.getByTestId('nav-tmap').querySelector('span');
    expect(pill).toHaveStyle({ backgroundColor: NAV_BRAND.tmap.bg, color: NAV_BRAND.tmap.ink });
    // The regression this guards: a theme token as the ink.
    expect(pill?.getAttribute('style') ?? '').not.toContain('--tr-ink');
  });

  it('every branded fill carries an explicit ink, not a token', () => {
    for (const key of ['kakao', 'tmap', 'naver'] as const) {
      expect(NAV_BRAND[key].ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(NAV_BRAND[key].bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('leaves Google neutral rather than inventing a brand colour for it', () => {
    expect(NAV_BRAND.google.bg).toContain('var(--tr-');
  });

  it('keeps the label on one line — a wrapped brand name is the CJK failure', () => {
    render(<NavBrandButton chipKey="kakao-navi" label="카카오내비" href="#" testId="nav-kakao" />);
    expect(screen.getByTestId('nav-kakao').querySelector('span')).toHaveClass('text-cjk-safe');
  });
});
