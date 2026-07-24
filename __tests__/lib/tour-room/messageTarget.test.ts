/**
 * §K B3 — 발송 대상. 오발송 방지가 이 스위트의 유일한 목적이다.
 *
 * B3.5가 요구하는 두 방향을 모두 본다:
 *   ① 대상 미선택/해제 상태에서 **전체로 새지 않는다**
 *   ② 개인 대상에서 **전체 버튼이 자동 선택되지 않는다**
 */

import {
  ALL_TARGET,
  clearTarget,
  guestLabel,
  isTargeted,
  pruneTarget,
  sendButtonLabel,
  targetChipLabel,
  targetMany,
  targetOne,
  targetPayload,
  targetTone,
  toggleTarget,
  type MessageTarget,
  type TargetRoster,
} from '@/lib/tour-room/messageTarget';

const roster: TargetRoster = {
  total: 12,
  guests: [
    { bookingId: 'b1', name: 'Massimo', seat: 3 },
    { bookingId: 'b2', name: 'Yuki', seat: 7 },
    { bookingId: 'b3', name: null, seat: null },
  ],
};

describe('칩 문구 — 대상이 화면에서 사라지는 상태가 없다', () => {
  it('전체', () => {
    expect(targetChipLabel(ALL_TARGET, roster)).toBe('전체 12명');
  });

  it('개인은 좌석+이름으로 — 가이드는 좌석으로 사람을 찾는다', () => {
    expect(targetChipLabel(targetOne('b1'), roster)).toBe('3번 Massimo');
  });

  it('좌석이 없으면 이름만', () => {
    expect(guestLabel({ bookingId: 'b3', name: 'Chen', seat: null })).toBe('Chen');
  });

  it('이름도 없으면 빈칸이 아니라 "이름 미상" — 빈 칩은 대상이 없어 보인다', () => {
    expect(targetChipLabel(targetOne('b3'), roster)).toBe('이름 미상');
  });

  it('복수는 인원수로', () => {
    expect(targetChipLabel(targetMany(['b1', 'b2']), roster)).toBe('선택 2명');
  });
});

describe('전송 버튼 라벨 — 칩만 바뀌고 버튼이 그대로면 손가락은 버튼만 본다', () => {
  it('전체', () => {
    expect(sendButtonLabel(ALL_TARGET, roster)).toBe('전체에게 보내기');
  });

  it('개인은 이름을 말한다', () => {
    expect(sendButtonLabel(targetOne('b1'), roster)).toBe('Massimo에게 보내기');
  });

  it('복수는 인원을 말한다', () => {
    expect(sendButtonLabel(targetMany(['b1', 'b2']), roster)).toBe('2명에게 보내기');
  });
});

describe('톤 — 전체와 개인이 같은 색이면 안 된다 (B3-D3)', () => {
  it('세 상태가 서로 다르다', () => {
    const tones = [
      targetTone(ALL_TARGET),
      targetTone(targetOne('b1')),
      targetTone(targetMany(['b1', 'b2'])),
    ];
    expect(new Set(tones).size).toBe(3);
    expect(tones).toEqual(['all', 'direct', 'selected']);
  });
});

describe('🔴 B3.5 오발송 방지 — 두 방향', () => {
  it('① 전체 대상은 bookingIds를 아예 안 보낸다 = 기존 팬아웃과 완전 동일', () => {
    expect(targetPayload(ALL_TARGET)).toEqual({});
  });

  it('① 선택 상태인데 배열이 비었으면 빈 배열을 보낸다 — 서버가 거절하게 한다', () => {
    // "대상을 못 찾았으니 전체로 보낸다"는 폴백이 바로 이 트랙이 막는 사고다.
    const empty: MessageTarget = { kind: 'selected', bookingIds: [] };
    expect(targetPayload(empty)).toEqual({ bookingIds: [] });
    expect(targetPayload(empty)).not.toEqual({});
  });

  it('② 개인 대상에서 다른 사람을 눌러도 전체로 뒤집히지 않는다', () => {
    const t = toggleTarget(targetOne('b1'), 'b2');
    expect(t).toEqual({ kind: 'selected', bookingIds: ['b1', 'b2'] });
    expect(isTargeted(t)).toBe(true);
  });

  it('마지막 한 명을 빼면 명시적으로 전체로 돌아간다 — 칩이 바뀌므로 가이드가 본다', () => {
    const t = toggleTarget(targetOne('b1'), 'b1');
    expect(t).toEqual(ALL_TARGET);
    expect(targetChipLabel(t, roster)).toBe('전체 12명');
  });

  it('같은 사람을 두 번 넣어도 중복되지 않는다', () => {
    const t = toggleTarget(toggleTarget(ALL_TARGET, 'b1'), 'b1');
    expect(t).toEqual(ALL_TARGET);
    expect(targetMany(['b1', 'b1', 'b2'])).toEqual({ kind: 'selected', bookingIds: ['b1', 'b2'] });
  });

  it('빈 bookingId는 무시한다 — 유령 대상이 생기지 않는다', () => {
    expect(toggleTarget(ALL_TARGET, '')).toEqual(ALL_TARGET);
    expect(targetOne('')).toEqual(ALL_TARGET);
    expect(targetMany([])).toEqual(ALL_TARGET);
  });
});

describe('B3-D4 — 전송 후 대상은 유지되고, ✕와 명단 이탈로만 풀린다', () => {
  it('✕는 전체로 되돌린다', () => {
    expect(clearTarget()).toEqual(ALL_TARGET);
  });

  it('명단에서 사라진 예약은 대상에서 빠진다 — 유령 이름을 칩에 띄우지 않는다', () => {
    const t = pruneTarget({ kind: 'selected', bookingIds: ['b1', 'gone'] }, roster);
    expect(t).toEqual({ kind: 'selected', bookingIds: ['b1'] });
  });

  it('전부 사라지면 전체로 돌아간다', () => {
    expect(pruneTarget({ kind: 'selected', bookingIds: ['gone'] }, roster)).toEqual(ALL_TARGET);
  });

  it('전부 살아 있으면 같은 객체를 그대로 준다 (불필요한 리렌더 방지)', () => {
    const t: MessageTarget = { kind: 'selected', bookingIds: ['b1', 'b2'] };
    expect(pruneTarget(t, roster)).toBe(t);
  });
});
