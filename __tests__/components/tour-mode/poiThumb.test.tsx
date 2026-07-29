/**
 * P7.1 — the thumbnail's two behaviours, proved deterministically.
 *
 * Why a render test and not a browser walk: the swatch is the state for 49 of
 * 124 POIs, but the seeded Jeju region happens to return 25 POIs that ALL have
 * photos, so a browser walk over the picker can never reach it. And the
 * dead-URL recovery needs a load failure, which a walk cannot force on demand.
 * Both are one `fireEvent.error` away here.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { PoiThumb } from '@/components/tour-mode/plan/PoiThumb';
import { avatarColorFor } from '@/lib/tour-room/avatarColor';

describe('PoiThumb', () => {
  it('shows the curated photo when there is one', () => {
    render(
      <PoiThumb
        poi={{ default_image_url: '/curated.webp', images: ['/other.webp'] }}
        seed="jeju_stone_park"
        name="Jeju Stone Park"
      />,
    );
    const thumb = screen.getByTestId('plan-poi-thumb');
    expect(thumb).toHaveAttribute('data-thumb', 'photo');
    expect(thumb.querySelector('img')).toHaveAttribute('src', '/curated.webp');
  });

  /**
   * 🔴 The measured case. `sanbangsan_mountain` shipped a dead images[0] with a
   * live images[1]; before this component, that POI showed nothing at all.
   */
  it('advances to the next candidate when one fails to load', () => {
    render(
      <PoiThumb
        poi={{ default_image_url: null, images: ['/dead.webp', '/live.webp'] }}
        seed="sanbangsan_mountain"
        name="Sanbangsan"
      />,
    );
    const img = () => screen.getByTestId('plan-poi-thumb').querySelector('img');
    expect(img()).toHaveAttribute('src', '/dead.webp');

    fireEvent.error(img()!);

    expect(screen.getByTestId('plan-poi-thumb')).toHaveAttribute('data-thumb', 'photo');
    expect(img()).toHaveAttribute('src', '/live.webp');
  });

  it('falls to the swatch only after every candidate has failed', () => {
    render(
      <PoiThumb
        poi={{ default_image_url: '/a.webp', images: ['/b.webp'] }}
        seed="yongmeori_coast"
        name="Yongmeori Coast"
      />,
    );
    fireEvent.error(screen.getByTestId('plan-poi-thumb').querySelector('img')!);
    fireEvent.error(screen.getByTestId('plan-poi-thumb').querySelector('img')!);

    const thumb = screen.getByTestId('plan-poi-thumb');
    expect(thumb).toHaveAttribute('data-thumb', 'swatch');
    expect(thumb).toHaveTextContent('Y');
  });

  /**
   * The empty state is a PLACE, not a hole — 49 POIs live here permanently.
   * An empty square reads as "unfinished screen"; an initial on a tint reads as
   * "this place has no photo yet".
   */
  it('renders an initial on a tinted ground when there is no photo at all', () => {
    render(<PoiThumb poi={{ default_image_url: null, images: [] }} seed="udo_island" name="Udo Island" />);
    const thumb = screen.getByTestId('plan-poi-thumb');
    expect(thumb).toHaveAttribute('data-thumb', 'swatch');
    expect(thumb).toHaveTextContent('U');
    expect(thumb.querySelector('img')).toBeNull();
    /**
     * Paired bg/ink from the shared palette, not an ad-hoc colour.
     * ⚠ Compare VALUES, not notation — jsdom serialises `#E0E7FF` as
     * `rgb(224, 231, 255)`, so a substring match on the hex fails while the
     * colour is perfectly correct. (This repo has a standing note about
     * exactly this class of mistake in its locale review gates.)
     */
    const tint = avatarColorFor('udo_island');
    expect(thumb).toHaveStyle({ backgroundColor: tint.bg, color: tint.ink });
  });

  it('survives a POI that is missing entirely (Google Places stops have no match_pois row)', () => {
    render(<PoiThumb poi={undefined} seed="stop-123" name="Some Cafe" />);
    expect(screen.getByTestId('plan-poi-thumb')).toHaveAttribute('data-thumb', 'swatch');
    expect(screen.getByTestId('plan-poi-thumb')).toHaveTextContent('S');
  });

  /**
   * The tint is seeded on poi_key, never on the display name — otherwise a
   * place changes colour when the guest changes language, which is exactly the
   * kind of instability that makes a UI feel unreliable.
   */
  it('keeps the same tint across locales because it is seeded on the key', () => {
    const { rerender } = render(
      <PoiThumb poi={null} seed="seongsan_ilchulbong" name="Seongsan Ilchulbong" />,
    );
    const first = screen.getByTestId('plan-poi-thumb').getAttribute('style');
    rerender(<PoiThumb poi={null} seed="seongsan_ilchulbong" name="성산일출봉" />);
    expect(screen.getByTestId('plan-poi-thumb').getAttribute('style')).toBe(first);
  });

  it('is decorative — the name is always rendered beside it', () => {
    render(<PoiThumb poi={null} seed="k" name="Somewhere" />);
    expect(screen.getByTestId('plan-poi-thumb')).toHaveAttribute('aria-hidden', 'true');
  });
});
