/**
 * 크루즈 D-1 프리필 (docs/cruise-jeju-shore-excursion-2026.md 후속).
 * 사용자 확정 3요소가 계약이다: ① 입항 시각 ② 크루즈명 확인 ③ 출항 1시간 전
 * 복귀 보장({cruise_return_by} = depart − 60m).
 */
import {
  cruiseCallLabel,
  cruiseVarsFromCall,
  kstClock,
  pickCruiseCall,
  portOfBerth,
  type CruiseCallRow,
} from '@/lib/ops/cruise/schedule';
import { parseBerthExport } from '@/scripts/sync-cruise-schedule';
import { composeForRecipient } from '@/lib/ops/messaging/guestMessage';
import { getPreset, WA_LOCALES } from '@/lib/ops/whatsapp/presets';

const call = (over: Partial<CruiseCallRow> = {}): CruiseCallRow => ({
  id: 'c1',
  call_date: '2026-08-06',
  berth: '강정2',
  port: 'gangjeong',
  ship: 'MSC Bellissima',
  arrive_at: '2026-08-06T14:30:00+09:00',
  depart_at: '2026-08-06T22:00:00+09:00',
  passengers: 5686,
  ...over,
});

describe('portOfBerth / kstClock', () => {
  it('강정1·강정2 → gangjeong, 제주항 → jeju', () => {
    expect(portOfBerth('강정1')).toBe('gangjeong');
    expect(portOfBerth('강정 2')).toBe('gangjeong');
    expect(portOfBerth('제주항')).toBe('jeju');
  });

  it('kstClock renders the KST wall clock regardless of stored offset', () => {
    expect(kstClock('2026-08-06T14:30:00+09:00')).toBe('14:30');
    expect(kstClock('2026-08-06T05:30:00Z')).toBe('14:30'); // same instant, UTC form
  });
});

describe('cruiseVarsFromCall — 출항 1시간 전 복귀 보장', () => {
  it('return_by = depart − 60 minutes', () => {
    expect(cruiseVarsFromCall(call())).toEqual({
      cruiseShip: 'MSC Bellissima',
      cruiseArrive: '14:30',
      cruiseDepart: '22:00',
      cruiseReturnBy: '21:00',
    });
  });

  it('crosses the hour correctly (16:00 depart → 15:00)', () => {
    expect(cruiseVarsFromCall(call({ depart_at: '2026-08-06T16:00:00+09:00' })).cruiseReturnBy).toBe('15:00');
  });
});

describe('pickCruiseCall — 지어내지 않는다', () => {
  const jeju = call({ id: 'j', berth: '제주항', port: 'jeju', ship: 'Dream', passengers: 2270 });
  const gang1 = call({ id: 'g1' });
  const gang2 = call({ id: 'g2', berth: '강정1', ship: 'Visio', passengers: 3470 });

  it('single call auto-selects', () => {
    expect(pickCruiseCall([jeju], { title: 'Any tour' })?.id).toBe('j');
  });

  it('multiple calls + port hint → that port (largest pax when still plural)', () => {
    expect(pickCruiseCall([jeju, gang1, gang2], { title: 'Gangjeong Shore Tour' })?.id).toBe('g1');
    expect(pickCruiseCall([jeju, gang1], { slug: 'jeju-port-morning-shore' })?.id).toBe('j');
  });

  it('multiple calls with NO hint → null (operator picks; no guessing)', () => {
    expect(pickCruiseCall([jeju, gang1], { title: 'Jeju Highlights' })).toBeNull();
  });

  it('label reads ship · port · window', () => {
    expect(cruiseCallLabel(gang1)).toBe('MSC Bellissima · 강정항(서귀포) 14:30–22:00');
  });
});

describe('cruise_d1 preset — 6 locales carry the three commitments', () => {
  const preset = getPreset('cruise_d1')!;
  it('exists with every locale body', () => {
    expect(preset).toBeTruthy();
    for (const locale of WA_LOCALES) {
      const body = preset.bodies[locale];
      expect(body).toContain('{cruise_ship}');
      expect(body).toContain('{cruise_arrive}');
      expect(body).toContain('{cruise_return_by}');
      expect(body).toContain('{room_link}');
    }
  });

  it('ko body promises the 1-hour-before-departure return in words', () => {
    expect(preset.bodies.ko).toContain('출항 1시간 전');
    expect(preset.bodies.en.toLowerCase()).toContain('one full hour before');
  });
});

describe('composeForRecipient with cruise context', () => {
  const template = { body: getPreset('cruise_d1')!.bodies.ko };
  const recipient = {
    bookingId: 'b1',
    guestName: '김손님',
    locale: 'ko',
    pickupPoint: '강정 크루즈터미널 게이트',
    pickupTime: '15:00',
    roomLink: 'https://atockorea.com/tour-mode/room/b1?rt=x',
  };

  it('fills ship/arrive/return_by and leaves no cruise token missing', () => {
    const out = composeForRecipient(template, recipient, {
      tourName: 'Jeju Sunset Shore',
      tourDate: '2026-08-06',
      operatorName: 'AtoC Korea',
      cruise: cruiseVarsFromCall(call()),
    });
    expect(out.body).toContain('MSC Bellissima');
    expect(out.body).toContain('14:30 입항');
    expect(out.body).toContain('21:00까지 터미널로');
    expect(out.missing).toEqual([]);
  });

  it('without a matched call, cruise tokens surface as MISSING (badge, not silence)', () => {
    const out = composeForRecipient(template, recipient, {
      tourName: 'Jeju Sunset Shore',
      tourDate: '2026-08-06',
      operatorName: 'AtoC Korea',
      cruise: null,
    });
    expect(out.missing).toEqual(
      expect.arrayContaining(['{cruise_ship}', '{cruise_arrive}', '{cruise_return_by}']),
    );
  });
});

describe('parseBerthExport (도청 export 파서)', () => {
  const html = `
    <table><tbody>
      <tr>
        <td>2026</td><td>강정1</td><td>Adora Magic City</td>
        <td>2026-08-05 13:00</td><td>2026-08-05 21:00</td>
        <td>8</td><td>136201</td><td>5246</td>
        <td>Shanghai, CN</td><td>Shanghai, CN</td><td>Busan, KR</td>
      </tr>
      <tr><td>garbage row</td></tr>
    </tbody></table>`;

  it('parses well-formed rows and skips garbage', () => {
    const rows = parseBerthExport(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      call_date: '2026-08-05',
      berth: '강정1',
      port: 'gangjeong',
      ship: 'Adora Magic City',
      arrive_at: '2026-08-05T13:00:00+09:00',
      depart_at: '2026-08-05T21:00:00+09:00',
      passengers: 5246,
      next_port: 'Busan, KR',
    });
  });
});
