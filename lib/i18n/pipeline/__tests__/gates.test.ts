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
  romanNumeralValues,
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
    expect(f.some((x) => x.severity === 'fail' && x.message.includes('소실'))).toBe(true);
  });

  it('통화 자릿수가 잘리면 fail — ₩70,000 → €70', () => {
    const f = checkNumbers('₩70,000 per person', '€70 pro Person', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });

  it('시각 표기는 값이 유지되면 통과', () => {
    expect(checkNumbers('Meet at 09:30', 'Treffpunkt 09:30 Uhr', '/p')).toEqual([]);
  });

  it('날짜 현지화(월 이름 → 숫자)는 fail이 아니라 flag', () => {
    // `12 Oct 2009` → `12.10.2009`. 월이 숫자가 되며 10이 새로 생기지만 사실은 그대로다.
    const f = checkNumbers('designated 12 Oct 2009', 'ausgewiesen am 12.10.2009', '/p');
    expect(f.every((x) => x.severity === 'flag')).toBe(true);
    expect(f[0].message).toContain('숫자 추가');
  });

  it('천단위 구분기호는 합치고 날짜 구분점은 합치지 않는다', () => {
    expect(numberMultiset('1.100 m')).toEqual(['1100']);
    // 날짜는 여전히 세 개의 값으로 남는다(구분점을 합치지 않는다).
    // 선행 0은 값이 아니라 서식이므로 정규화된다 — 아래 케이스가 그 이유다.
    expect(numberMultiset('02.07.2007')).toEqual(['2', '2007', '7']);
  });

  it('날짜를 현지 표기로 다시 써도 값 소실로 보지 않는다', () => {
    // 2026-07-28 실측: 원문 `6/18–7/5`(en) → `18/06–05/07`(fr). 같은 값인데
    // `06`≠`6` 문자열 비교 때문에 4개 언어에서 동시에 G3 fail이 났다.
    const f = checkNumbers('festival 6/18–7/5', 'festival du 18/06 au 05/07', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
  });

  // ── 시각 표기 현지화 (2026-08-07 실측) ──────────────────────────────────────
  // 프랑스어·이탈리아어 fail 의 대부분이 이것이었다. 값이 아니라 서식이다.

  it('정각의 분을 생략한 프랑스어 표기를 값 소실로 보지 않는다', () => {
    const f = checkNumbers('open 09:00–18:00 daily', 'ouvert de 9 h à 18 h tous les jours', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
  });

  it('12시제 → 24시제 변환을 값 소실로 보지 않는다', () => {
    const f = checkNumbers('we arrive around 2 pm', 'wir kommen gegen 14:00 Uhr an', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
  });

  // 🔴 아래 셋이 이 완화의 안전판이다. 면제 범위를 넓히면 여기가 먼저 깨진다.

  it('면제는 원문이 쓴 횟수까지다 — 시각 하나에 0 두 개를 면제하지 않는다', () => {
    // 원문에 정각이 하나뿐인데 번역이 `0` 을 두 개 잃었다면 하나는 진짜 소실이다.
    const f = checkNumbers('open 09:00, 40 people, 0 pets', 'ouvert 9 h, 40 personnes, aucun animal', '/p');
    expect(f.some((x) => x.gate === 'G3' && x.severity === 'fail')).toBe(true);
  });

  it('시각을 면제해도 잘린 번역은 여전히 fail', () => {
    // 실측 케이스의 축약: 정각 표기는 살아 있지만 뒤 문장이 통째로 사라졌다.
    const f = checkNumbers(
      'Open 09:00. The name dates to 2017 and the walk takes 20 minutes.',
      'Ouvert 9 h.',
      '/p',
    );
    expect(f.some((x) => x.gate === 'G3' && x.severity === 'fail')).toBe(true);
  });

  it('시각이 아닌 수치 변조는 그대로 fail — 09:00 이 있어도', () => {
    const f = checkNumbers('open 09:00, ₩70,000 per person', 'ouvert 9 h, 50 000 ₩ par personne', '/p');
    expect(f.some((x) => x.gate === 'G3' && x.severity === 'fail')).toBe(true);
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

  it('원문의 약어 `mi` 도 단위로 센다', () => {
    // 2026-08-07 실측: 영어 원문이 `0.6 mi` 였는데 약어를 세지 않아, 정상적인
    // 프랑스어 `0,6 mile` 이 "원문에 없는 야드파운드"로 잡혔다.
    expect(checkCurrencyAndUnits('stairs 0.6 mi to the temple', 'escaliers sur 0,6 mile', '/p')).toEqual([]);
  });

  it('통화 기호 반복 횟수는 서식이다 — 종류가 같으면 통과', () => {
    // 프랑스어는 기호를 숫자 뒤에 두고 범위마다 되풀이하지 않는다. 금액은 그대로다.
    expect(
      checkCurrencyAndUnits('≈₩15,000–₩25,000', '≈15 000–25 000 ₩', '/p').filter(
        (x) => x.severity === 'fail',
      ),
    ).toHaveLength(0);
  });

  it('통화가 통째로 사라지면 여전히 fail — 반복 면제가 소실까지 덮지 않는다', () => {
    const f = checkCurrencyAndUnits('admission ₩5,000', 'entrée comprise', '/p');
    expect(f.some((x) => x.gate === 'G4' && x.severity === 'fail')).toBe(true);
  });

  it('원문의 하이픈 결합 단위도 인식한다 — "0.4-mile"', () => {
    // 하이픈을 수치·단위 사이 구분자로 세지 않으면 원문 쪽이 0으로 세어져
    // 정상 번역이 "변환"으로 오탐된다. 실측 케이스.
    expect(checkCurrencyAndUnits('a 0.4-mile loop trail', 'ein 0,4 Meilen langer Rundweg', '/p')).toEqual([]);
  });

  it('독일어 합성어를 야드파운드로 오탐하지 않는다 — Fußweg ≠ foot', () => {
    // JS `\b`는 ASCII 기준이라 `ß` 뒤에 가짜 경계가 생긴다. 실측 오탐 케이스.
    expect(checkCurrencyAndUnits('Walk to lunch venue — ~5 min', 'Fußweg zum Mittagslokal — ca. 5 Min.', '/p')).toEqual([]);
    expect(checkCurrencyAndUnits('a short walk', 'ein kurzer Fußmarsch zum Zollhaus', '/p')).toEqual([]);
  });

  it('숫자 없는 Fuß 는 단위가 아니다 — "밑동"·"걸어서"', () => {
    expect(checkCurrencyAndUnits('a 5 m base pool', 'ein 5 m großes Becken am Fuß', '/p')).toEqual([]);
    expect(checkCurrencyAndUnits('avoid uphill walking', 'Anstiege zu Fuß vermeiden', '/p')).toEqual([]);
  });

  it('숫자를 동반한 야드파운드 단위는 여전히 잡는다', () => {
    const f = checkCurrencyAndUnits('a 3 m drop', 'ein Sturz von 10 Fuß', '/p');
    expect(f.some((x) => x.message.includes('단위 변환'))).toBe(true);
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
  it('원문에 없던 CJK가 번역에 생기면 fail', () => {
    const f = checkCharset('Besuchen Sie 甘泉文化村', '/p', 'de', 'Visit Gamcheon Culture Village');
    expect(f.some((x) => x.gate === 'G10' && x.severity === 'fail')).toBe(true);
  });

  it('원문에 이미 있던 한국어 병기는 보존해도 통과 — 규칙 1', () => {
    // 이 상품 원문에는 `haenyeo (해녀, women divers)` 같은 병기가 흔하다.
    const src = 'Local **haenyeo (해녀, women divers)** sell fresh catches';
    const tgt = 'Einheimische **haenyeo (해녀, Taucherinnen)** verkaufen frischen Fang';
    expect(checkCharset(tgt, '/p', 'de', src)).toEqual([]);
  });

  it('독일어에 키릴이 섞이면 fail', () => {
    const f = checkCharset('Besuchen Sie Камчхон', '/p', 'de');
    expect(f.some((x) => x.message.includes('키릴'))).toBe(true);
  });

  it('러시아어가 키릴이면 통과', () => {
    expect(checkCharset('Посетите деревню Камчхон утром', '/p', 'ru')).toEqual([]);
  });

  it('러시아어인데 라틴문자만이면 fail', () => {
    // 문구가 아니라 판정을 고정한다 — 키릴이 0자인 경우는 비율이 아니라
    // "한 자도 없다"로 보고되지만, 어느 쪽이든 G10 fail이어야 한다.
    const f = checkCharset('Visit Gamcheon village at dawn', '/p', 'ru');
    expect(f.some((x) => x.gate === 'G10' && x.severity === 'fail')).toBe(true);
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

describe('G3 연대 축약 (2026-07-28 실측)', () => {
  it('4자리 연도가 두 자리로 줄어든 것은 fail이 아니라 flag', () => {
    // `1970s-1980s`(en) → `anni '70-'80`(it). gemini·openai 둘 다 이렇게 쓴다.
    const f = checkNumbers('boom of the 1970s-1980s', 'boom degli anni \u201970-\u201980', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
    expect(f.some((x) => x.message.includes('연대 축약'))).toBe(true);
  });

  it('연도가 아닌 값이 사라지면 여전히 fail', () => {
    // 좁게 열었다는 확인 — 가격·거리·시간은 그대로 막힌다.
    const f = checkNumbers('open 24 hours, 5000 won', 'aperto tutto il giorno', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });

  it('두 자리가 번역에 없으면 진짜 소실이므로 fail', () => {
    const f = checkNumbers('built in 1970', 'costruito di recente', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });
});

describe('G4 통화 표기 정규화 (2026-07-28 실측)', () => {
  it('ISO 코드 ↔ 기호는 같은 통화로 본다 — KRW → ₩', () => {
    expect(checkCurrencyAndUnits('entry KRW 5,000', 'entrée 5 000 ₩', '/p')).toEqual([]);
    expect(checkCurrencyAndUnits('₩5,000', 'KRW 5.000', '/p')).toEqual([]);
  });

  it('통화가 실제로 바뀌면 여전히 fail', () => {
    const f = checkCurrencyAndUnits('KRW 70,000', '€70,000', '/p');
    expect(f.some((x) => x.gate === 'G4' && x.severity === 'fail')).toBe(true);
  });

  it('통화가 통째로 사라지면 여전히 fail', () => {
    const f = checkCurrencyAndUnits('entry KRW 5,000', 'ingresso 5.000 won', '/p');
    expect(f.some((x) => x.gate === 'G4' && x.severity === 'fail')).toBe(true);
  });
});

describe('G3 로마 숫자 세기 (2026-07-28 실측)', () => {
  it('세기를 로마 숫자로 쓴 것은 값 소실이 아니다', () => {
    // `15th-17th century` → `XV-XVII secolo`. 이탈리아어·프랑스어의 정상 표기.
    const f = checkNumbers('built 15th-17th century', 'costruito tra il XV e il XVII secolo', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
  });

  it('프랑스어 서수 접미사도 인식한다 — XVe', () => {
    const f = checkNumbers('the 15th century hall', 'la salle du XVe siècle', '/p');
    expect(f.filter((x) => x.severity === 'fail')).toHaveLength(0);
  });

  it('한 글자 로마자는 세지 않는다 — 관사·머리글자 오탐 방지', () => {
    // `I` 가 1로 읽히면 원문의 1이 사라져도 통과해버린다.
    expect(romanNumeralValues('I giardini di D. Kim')).toEqual(new Set());
    const f = checkNumbers('1 free shuttle', 'navetta gratuita', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });

  it('로마 숫자와 무관한 값 소실은 여전히 fail', () => {
    const f = checkNumbers('XV secolo, 5000 won', 'XV secolo', '/p');
    expect(f.some((x) => x.severity === 'fail')).toBe(true);
  });

  it('값을 읽는다', () => {
    expect(romanNumeralValues('XV, XVII, IX, MMXX')).toEqual(new Set(['15', '17', '9', '2020']));
  });
});

describe('G10 키릴 비율 — 고유명사 공제 (2026-07-28 실측)', () => {
  const src = 'Lost Valley **Audi Q5 safari** + Zoo-Topia';

  it('고유명사가 빽빽한 문구는 올바른 번역도 60%에 못 닿는다 — 통과시킨다', () => {
    // 실측: everland 26%, arte_museum 40%. 어떤 정답도 통과 못 하던 입력이다.
    const f = checkCharset('Сафари Audi Q5 в Lost Valley + Zoo-Topia', '/p', 'ru', src);
    expect(f).toEqual([]);
  });

  it('영어를 그대로 되돌려주면 여전히 fail — 공제가 연 구멍을 막는다', () => {
    const f = checkCharset(src, '/p', 'ru', src);
    expect(f.some((x) => x.gate === 'G10' && x.severity === 'fail')).toBe(true);
  });

  it('원문에 없던 라틴어가 대량으로 남으면 여전히 fail', () => {
    const f = checkCharset(
      'The garden is open every day and the walk takes about twenty minutes',
      '/p',
      'ru',
      'Сад открыт ежедневно',
    );
    expect(f.some((x) => x.gate === 'G10' && x.severity === 'fail')).toBe(true);
  });

  it('평범한 러시아어 산문은 통과한다', () => {
    const f = checkCharset('Сад открыт ежедневно с девяти утра', '/p', 'ru', 'The garden opens daily at nine');
    expect(f).toEqual([]);
  });
});
