/**
 * G1~G11 검증기 테스트.
 *
 * 이 테스트가 지키는 것: **번역 파이프라인이 조용히 사실을 바꾸지 못한다.**
 * 각 케이스는 플랜 v2.2 §6의 할루시네이션 유형(H1~H8)에 대응한다.
 */
import {
  checkBannedTerms,
  checkCharset,
  checkCurrencyAndUnits,
  checkGlossaryTokens,
  checkLengthRatio,
  checkMarkup,
  checkNumbers,
  checkPlaceholders,
  checkStructure,
  checkUntranslated,
  checkVerbatim,
  numberMultiset,
  verifyUnit,
} from '../gates';

describe('G1 구조 — 누락·추가·병합 검출 (H3)', () => {
  it('포인터 누락을 fail로 잡는다', () => {
    const f = checkStructure(
      { segments: { '/hero/title': 'A', '/hero/sub': 'B' } },
      { segments: { '/hero/title': 'A' } },
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ gate: 'G1', severity: 'fail', pointer: '/hero/sub' });
  });

  it('입력에 없는 포인터 추가를 fail로 잡는다', () => {
    const f = checkStructure(
      { segments: { '/hero/title': 'A' } },
      { segments: { '/hero/title': 'A', '/hero/bonus': '창작' } },
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ gate: 'G1', severity: 'fail', pointer: '/hero/bonus' });
  });

  it('일치하면 아무 것도 보고하지 않는다', () => {
    expect(checkStructure({ segments: { '/a': 'x' } }, { segments: { '/a': 'y' } })).toEqual([]);
  });
});

describe('G2 글로서리 토큰 — 마스킹 방어 (H1)', () => {
  it('토큰이 번역되어 사라지면 fail', () => {
    const f = checkGlossaryTokens('Visit ⟦G0⟧ at dawn', 'Besuchen Sie Gamcheon im Morgengrauen', '/p');
    expect(f[0]).toMatchObject({ gate: 'G2', severity: 'fail' });
  });

  it('토큰이 보존되면 통과', () => {
    expect(checkGlossaryTokens('Visit ⟦G0⟧', 'Besuchen Sie ⟦G0⟧', '/p')).toEqual([]);
  });

  it('토큰 개수가 늘어나도 fail', () => {
    const f = checkGlossaryTokens('⟦G0⟧', '⟦G0⟧ und ⟦G1⟧', '/p');
    expect(f[0]).toMatchObject({ gate: 'G2', severity: 'fail' });
  });
});

describe('G3 숫자 — 값 변조 검출, 서식 변경 허용 (H2)', () => {
  it('서식만 바뀐 자릿수 구분기호는 통과한다', () => {
    expect(numberMultiset('1,234.5')).toEqual(numberMultiset('1.234,5'));
    expect(checkNumbers('Total 1,234.5 km', 'Insgesamt 1.234,5 km', '/p')).toEqual([]);
  });

  it('좁은 비분리 공백(FR/RU 관례)도 구분기호로 인정한다', () => {
    expect(checkNumbers('1,234 people', '1 234 personnes', '/p')).toEqual([]);
  });

  it('값이 바뀌면 fail — 40분 → 30분', () => {
    const f = checkNumbers('about 40 minutes', 'etwa 30 Minuten', '/p');
    expect(f[0]).toMatchObject({ gate: 'G3', severity: 'fail' });
  });

  it('통화 자릿수가 잘리면 fail — ₩70,000 → €70', () => {
    const f = checkNumbers('₩70,000 per person', '€70 pro Person', '/p');
    expect(f[0]).toMatchObject({ gate: 'G3', severity: 'fail' });
  });

  it('시각 표기는 값이 유지되면 통과', () => {
    expect(checkNumbers('Meet at 09:30', 'Treffpunkt 09:30 Uhr', '/p')).toEqual([]);
  });
});

describe('G4 통화·단위', () => {
  it('통화 기호가 바뀌면 fail', () => {
    const f = checkCurrencyAndUnits('₩70,000', '€70,000', '/p');
    expect(f.some((x) => x.gate === 'G4' && x.severity === 'fail')).toBe(true);
  });

  it('km → mile 변환을 fail로 잡는다', () => {
    const f = checkCurrencyAndUnits('12 km drive', '12 miles drive', '/p');
    expect(f.some((x) => x.message.includes('단위 변환'))).toBe(true);
  });

  it('원문에 이미 mile이 있으면 통과', () => {
    expect(checkCurrencyAndUnits('2 miles', '2 Meilen', '/p')).toEqual([]);
  });
});

describe('G5 플레이스홀더', () => {
  it('{count} 가 사라지면 fail', () => {
    const f = checkPlaceholders('{count} stops', 'Haltestellen', '/p');
    expect(f[0]).toMatchObject({ gate: 'G5', severity: 'fail' });
  });

  it('순서가 바뀌어도 집합이 같으면 통과', () => {
    expect(checkPlaceholders('{a} then {b}', '{b} dann {a}', '/p')).toEqual([]);
  });

  it('%s 와 {{x}} 도 센다', () => {
    expect(checkPlaceholders('%s and {{name}}', '%s und {{name}}', '/p')).toEqual([]);
    expect(checkPlaceholders('%s', 'nichts', '/p')[0].gate).toBe('G5');
  });
});

describe('G6 마크업', () => {
  it('태그가 사라지면 fail', () => {
    const f = checkMarkup('<b>Hot</b> spring', 'Heiße Quelle', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });

  it('태그가 유지되면 통과', () => {
    expect(checkMarkup('<b>Hot</b>', '<b>Heiß</b>', '/p')).toEqual([]);
  });

  it('마크다운 링크 개수가 달라지면 fail', () => {
    const f = checkMarkup('see [docs](http://x.io)', 'siehe docs', '/p');
    expect(f.some((x) => x.gate === 'G6' && x.severity === 'fail')).toBe(true);
  });
});

describe('G7 URL·이메일·전화 — 문자 단위 동일', () => {
  it('URL이 변형되면 fail', () => {
    const f = checkVerbatim('go to https://atockorea.com/a', 'gehe zu https://atockorea.de/a', '/p');
    expect(f[0]).toMatchObject({ gate: 'G7', severity: 'fail' });
  });

  it('이메일이 유지되면 통과', () => {
    expect(checkVerbatim('mail help@atockorea.com', 'E-Mail help@atockorea.com', '/p')).toEqual([]);
  });
});

describe('G8 길이비 — 플래그만', () => {
  const long = 'This tour runs for a full day and covers the eastern coast of the island.';

  it('독일어가 과도하게 길면 플래그', () => {
    const f = checkLengthRatio(long, long.repeat(3), '/p', 'de');
    expect(f[0]).toMatchObject({ gate: 'G8', severity: 'flag' });
  });

  it('짧은 문구는 검사하지 않는다', () => {
    expect(checkLengthRatio('Hi', 'Guten Tag alle zusammen', '/p', 'de')).toEqual([]);
  });

  it('범위 안이면 통과', () => {
    expect(checkLengthRatio(long, `${long} etwas`, '/p', 'de')).toEqual([]);
  });
});

describe('G9 미번역 잔존 — 플래그', () => {
  it('원문과 동일하면 플래그', () => {
    const f = checkUntranslated('Full day tour', 'Full day tour', '/p');
    expect(f[0]).toMatchObject({ gate: 'G9', severity: 'flag' });
  });

  it('keepAsIs 브랜드명은 예외', () => {
    expect(checkUntranslated('Tour Room', 'Tour Room', '/p', ['Tour Room'])).toEqual([]);
  });

  it('글로서리 토큰만으로 된 문자열은 예외', () => {
    expect(checkUntranslated('⟦G0⟧', '⟦G0⟧', '/p')).toEqual([]);
  });
});

describe('G10 문자셋 — 로케일 교차 오염 (H8)', () => {
  it('독일어에 CJK가 섞이면 fail', () => {
    const f = checkCharset('Besuchen Sie 甘泉文化村', '/p', 'de');
    expect(f.some((x) => x.gate === 'G10' && x.severity === 'fail')).toBe(true);
  });

  it('독일어에 키릴이 섞이면 fail', () => {
    const f = checkCharset('Besuchen Sie Камчхон', '/p', 'de');
    expect(f.some((x) => x.message.includes('키릴'))).toBe(true);
  });

  it('러시아어가 키릴이면 통과', () => {
    expect(checkCharset('Посетите деревню Камчхон утром', '/p', 'ru')).toEqual([]);
  });

  it('러시아어인데 라틴문자만이면 fail', () => {
    const f = checkCharset('Visit Gamcheon village at dawn', '/p', 'ru');
    expect(f.some((x) => x.message.includes('키릴 비율'))).toBe(true);
  });

  it('러시아어에 라틴 고유명사가 일부 섞이는 것은 허용', () => {
    expect(checkCharset('Посетите деревню Gamcheon рано утром сегодня', '/p', 'ru')).toEqual([]);
  });
});

describe('G11 금지어·메타언급', () => {
  it('메타언급을 fail로 잡는다', () => {
    const f = checkBannedTerms('Dieser Text wurde von KI übersetzt.', '/p');
    expect(f[0]).toMatchObject({ gate: 'G11', severity: 'fail' });
  });

  it('금지어는 플래그', () => {
    const f = checkBannedTerms('Billigtour nach Jeju', '/p', ['Billigtour']);
    expect(f[0]).toMatchObject({ gate: 'G11', severity: 'flag' });
  });
});

describe('verifyUnit — 통합', () => {
  it('깨끗한 번역은 auto_pass 상태를 만든다', () => {
    const r = verifyUnit(
      { segments: { '/hero/title': 'A full day around ⟦G0⟧ for ₩70,000' } },
      { segments: { '/hero/title': 'Ein ganzer Tag rund um ⟦G0⟧ für ₩70.000' } },
      { locale: 'de' },
    );
    expect(r.failed).toBe(false);
    expect(r.flagged).toBe(false);
    expect(r.findings).toEqual([]);
  });

  it('숫자 변조 + 토큰 소실을 동시에 잡는다', () => {
    const r = verifyUnit(
      { segments: { '/a': 'Visit ⟦G0⟧ for 40 minutes' } },
      { segments: { '/a': 'Besuchen Sie Gamcheon für 30 Minuten' } },
      { locale: 'de' },
    );
    expect(r.failed).toBe(true);
    expect(r.findings.map((f) => f.gate).sort()).toEqual(expect.arrayContaining(['G2', 'G3']));
  });

  it('빈 번역은 플래그이고 fail이 아니다 (규칙 6 안전판)', () => {
    const r = verifyUnit(
      { segments: { '/a': 'Some tricky sentence' } },
      { segments: { '/a': '' } },
      { locale: 'de' },
    );
    expect(r.failed).toBe(false);
    expect(r.flagged).toBe(true);
  });

  it('빈 번역에는 다른 게이트를 돌리지 않는다', () => {
    const r = verifyUnit(
      { segments: { '/a': 'Visit ⟦G0⟧ for 40 minutes' } },
      { segments: { '/a': '   ' } },
      { locale: 'ru' },
    );
    expect(r.findings.map((f) => f.gate)).toEqual(['G1']);
  });
});
