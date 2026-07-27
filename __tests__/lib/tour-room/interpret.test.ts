/**
 * V1 대면 통역 — 방향 결정과 숫자 감시.
 */
import {
  INTERPRET_LOCAL_LOCALE,
  droppedNumbers,
  extractNumericTokens,
  interpretDirection,
  isNoopDirection,
  normalizeInterpretSide,
} from '@/lib/tour-room/interpret';

describe('normalizeInterpretSide', () => {
  it('두 면만 받는다', () => {
    expect(normalizeInterpretSide('guest')).toBe('guest');
    expect(normalizeInterpretSide('local')).toBe('local');
  });

  it('그 외에는 null — 라우트가 400 을 내야 한다', () => {
    for (const bad of ['GUEST', 'driver', '', null, undefined, 1, {}]) {
      expect(normalizeInterpretSide(bad)).toBeNull();
    }
  });
});

describe('interpretDirection', () => {
  it('손님이 말하면 눈앞의 한국인 언어로', () => {
    expect(interpretDirection('guest', 'en')).toEqual({ from: 'en', to: 'ko' });
  });

  it('한국인이 말하면 손님 언어로', () => {
    expect(interpretDirection('local', 'ja')).toEqual({ from: 'ko', to: 'ja' });
  });

  it('상대 언어는 기본이 한국어지만 열려 있다', () => {
    expect(INTERPRET_LOCAL_LOCALE).toBe('ko');
    expect(interpretDirection('guest', 'en', 'ja')).toEqual({ from: 'en', to: 'ja' });
  });

  it('손님 로케일이 비면 영어로 떨어진다 (빈 문자열로 번역하지 않는다)', () => {
    expect(interpretDirection('guest', '')).toEqual({ from: 'en', to: 'ko' });
    expect(interpretDirection('local', '   ')).toEqual({ from: 'ko', to: 'en' });
  });

  it('대소문자·공백을 정규화한다', () => {
    expect(interpretDirection('guest', ' EN ')).toEqual({ from: 'en', to: 'ko' });
  });

  it('한국어 손님이면 옮길 것이 없다고 알린다 — 유료 호출을 아낀다', () => {
    expect(isNoopDirection(interpretDirection('guest', 'ko'))).toBe(true);
    expect(isNoopDirection(interpretDirection('local', 'ko'))).toBe(true);
    expect(isNoopDirection(interpretDirection('guest', 'en'))).toBe(false);
  });
});

describe('extractNumericTokens', () => {
  it('시간·금액·인원을 뽑는다', () => {
    expect(extractNumericTokens('3시 30분에 4명이서 25,000원')).toEqual(['3', '30', '4', '25,000']);
  });

  it('꼬리 구분자는 숫자의 일부가 아니다', () => {
    expect(extractNumericTokens('가격은 3,000, 시간은 14:30.')).toEqual(['3,000', '14:30']);
  });

  it('표기만 다른 같은 수는 한 번만 (3,000 과 3.000)', () => {
    expect(extractNumericTokens('3,000원 = 3.000 KRW')).toEqual(['3,000']);
  });

  it('숫자가 없으면 빈 배열', () => {
    expect(extractNumericTokens('안녕하세요')).toEqual([]);
  });
});

describe('droppedNumbers', () => {
  it('번역이 숫자를 지켰으면 경고 없음', () => {
    expect(droppedNumbers('3시 30분에 만나요', "Let's meet at 3:30")).toEqual([]);
  });

  it('구분자 표기가 달라도 같은 수로 본다', () => {
    expect(droppedNumbers('25,000원입니다', 'It is 25.000 won')).toEqual([]);
  });

  it('🔴 번역에서 증발한 숫자를 잡아낸다 — 이게 대면 통역 최대 사고 지점이다', () => {
    expect(droppedNumbers('4명이서 3시 30분에', "We'll meet at 3:30")).toEqual(['4']);
  });

  it('시각이 합쳐지는 표기를 유실로 오탐하지 않는다 (3시 30분 → 3:30)', () => {
    expect(droppedNumbers('3시 30분에 만나요', 'Meet at 3:30')).toEqual([]);
    expect(droppedNumbers('14시 30분', 'at 14:30')).toEqual([]);
  });

  it('비슷한 숫자에 헛맞지 않는다', () => {
    expect(droppedNumbers('3명', 'party of 13')).toEqual(['3']);
    expect(droppedNumbers('30분', 'about 25,300 won')).toEqual(['30']);
  });

  it('번역이 비면 원문 숫자가 전부 유실로 잡힌다 (라우트는 이때 호출하지 않는다)', () => {
    expect(droppedNumbers('3시 30분', '')).toEqual(['3', '30']);
  });
});
