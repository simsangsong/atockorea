/**
 * 공용 SeatMap SVG 렌더러 검증 — 5개 레이아웃 좌석수, 상태 클래스,
 * 탭/키보드 콜백, readOnly, 하이라이트, 설비 비인터랙션.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import SeatMap from '@/components/ops/SeatMap';
import { VEHICLE_LAYOUT_SEEDS, VEHICLE_MODELS } from '@/lib/ops/seating/layouts';
import type { SeatState } from '@/lib/ops/seating/logic';

const EXPECTED_SEATS = { county_20: 20, solati_16: 13, limo_27: 27, bus_35: 35, bus_45: 45 };

describe('SeatMap', () => {
  describe.each(VEHICLE_MODELS)('%s', (model) => {
    it('renders every seat and fixture of the layout', () => {
      const seed = VEHICLE_LAYOUT_SEEDS[model];
      const { container } = render(<SeatMap layout={seed.layout} />);
      expect(container.querySelectorAll('[data-seat]')).toHaveLength(EXPECTED_SEATS[model]);
      expect(container.querySelectorAll('.sm-fixture')).toHaveLength(seed.layout.fixtures.length);
    });
  });

  it('applies state classes per the §5.3b color protocol', () => {
    const seatStates: Record<number, SeatState> = {
      1: 'mine',
      2: 'taken',
      3: 'checked_in',
      4: 'absent',
      5: 'locked',
    };
    const { container } = render(
      <SeatMap layout={VEHICLE_LAYOUT_SEEDS.bus_45.layout} seatStates={seatStates} />,
    );
    const cls = (n: number) => container.querySelector(`[data-seat="${n}"]`)!.getAttribute('class');
    expect(cls(1)).toContain('sm-seat--mine');
    expect(cls(2)).toContain('sm-seat--taken');
    expect(cls(3)).toContain('sm-seat--checked_in');
    expect(cls(4)).toContain('sm-seat--absent');
    expect(cls(5)).toContain('sm-seat--locked');
    // 상태 미지정 좌석은 available
    expect(cls(6)).toContain('sm-seat--available');
  });

  it('highlights party seats (§5.4b 양방향 내비게이션)', () => {
    const { container } = render(
      <SeatMap layout={VEHICLE_LAYOUT_SEEDS.limo_27.layout} highlightSeats={[3, 4, 5]} />,
    );
    for (const n of [3, 4, 5]) {
      expect(container.querySelector(`[data-seat="${n}"]`)!.getAttribute('class')).toContain(
        'sm-seat--hl',
      );
    }
    expect(container.querySelector('[data-seat="1"]')!.getAttribute('class')).not.toContain(
      'sm-seat--hl',
    );
  });

  it('fires onSeatTap with the seat number (click + keyboard)', () => {
    const onSeatTap = jest.fn();
    const { container } = render(
      <SeatMap layout={VEHICLE_LAYOUT_SEEDS.county_20.layout} onSeatTap={onSeatTap} />,
    );
    fireEvent.click(container.querySelector('[data-seat="7"]')!);
    expect(onSeatTap).toHaveBeenCalledWith(7);
    fireEvent.keyDown(container.querySelector('[data-seat="8"]')!, { key: 'Enter' });
    expect(onSeatTap).toHaveBeenCalledWith(8);
    fireEvent.keyDown(container.querySelector('[data-seat="9"]')!, { key: ' ' });
    expect(onSeatTap).toHaveBeenCalledWith(9);
    expect(onSeatTap).toHaveBeenCalledTimes(3);
  });

  it('still delivers taps on taken seats (가이드 수동 체크인 C-13③ 경로)', () => {
    const onSeatTap = jest.fn();
    const { container } = render(
      <SeatMap
        layout={VEHICLE_LAYOUT_SEEDS.solati_16.layout}
        seatStates={{ 2: 'taken' }}
        onSeatTap={onSeatTap}
      />,
    );
    fireEvent.click(container.querySelector('[data-seat="2"]')!);
    expect(onSeatTap).toHaveBeenCalledWith(2);
  });

  it('is inert in readOnly mode (and without onSeatTap)', () => {
    const onSeatTap = jest.fn();
    const { container, rerender } = render(
      <SeatMap layout={VEHICLE_LAYOUT_SEEDS.bus_35.layout} onSeatTap={onSeatTap} readOnly />,
    );
    const seat = container.querySelector('[data-seat="1"]')!;
    fireEvent.click(seat);
    fireEvent.keyDown(seat, { key: 'Enter' });
    expect(onSeatTap).not.toHaveBeenCalled();
    expect(seat.getAttribute('role')).toBe('img');
    expect(seat.getAttribute('aria-disabled')).toBe('true');
    expect(seat.getAttribute('tabindex')).toBeNull();

    rerender(<SeatMap layout={VEHICLE_LAYOUT_SEEDS.bus_35.layout} />);
    expect(container.querySelector('[data-seat="1"]')!.getAttribute('role')).toBe('img');
  });

  it('exposes interactive seats as buttons with labels (a11y)', () => {
    render(
      <SeatMap
        layout={VEHICLE_LAYOUT_SEEDS.solati_16.layout}
        seatStates={{ 1: 'mine' }}
        seatLabels={{ 1: 'Massimo C.' }}
        onSeatTap={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Massimo C. — seat 1 (mine)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'seat 2 (available)' })).toBeInTheDocument();
  });

  it('keeps fixtures non-interactive and labeled', () => {
    const onSeatTap = jest.fn();
    const { container } = render(
      <SeatMap layout={VEHICLE_LAYOUT_SEEDS.county_20.layout} onSeatTap={onSeatTap} />,
    );
    const fixture = container.querySelector('.sm-fixture--driver')!;
    expect(fixture.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(fixture);
    expect(onSeatTap).not.toHaveBeenCalled();
    expect(fixture.textContent).toContain('운전석');
  });
});
