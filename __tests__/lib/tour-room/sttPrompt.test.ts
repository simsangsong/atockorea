import { buildSttPrompt, scheduleTerms, MAX_STT_PROMPT_CHARS } from '@/lib/tour-room/sttPrompt';

describe('buildSttPrompt', () => {
  it('실측에서 검증된 형태로 만든다 (명령문이 아니라 어휘가 등장하는 문장)', () => {
    const prompt = buildSttPrompt(['성산일출봉', '만장굴', '비자림']);
    expect(prompt).toBe('제주 투어 가이드 안내입니다. 고유명사: 성산일출봉, 만장굴, 비자림.');
  });

  it('용어가 없으면 빈 문자열 — 호출부가 필드를 생략할 수 있어야 한다', () => {
    expect(buildSttPrompt([])).toBe('');
    expect(buildSttPrompt([null, undefined, '', '  '])).toBe('');
  });

  it('1글자 이름은 버린다 (산·굴은 충돌만 유발한다)', () => {
    expect(buildSttPrompt(['산', '굴', '만장굴'])).toBe('제주 투어 가이드 안내입니다. 고유명사: 만장굴.');
  });

  it('쉼표가 든 이름은 목록을 깨뜨리므로 버린다', () => {
    expect(buildSttPrompt(['제주, 성산', '비자림'])).toBe('제주 투어 가이드 안내입니다. 고유명사: 비자림.');
  });

  it('중복은 대소문자 무시하고 한 번만', () => {
    expect(buildSttPrompt(['Bijarim', 'bijarim', '비자림'])).toBe(
      '제주 투어 가이드 안내입니다. 고유명사: Bijarim, 비자림.',
    );
  });

  it('공백을 정규화한다', () => {
    expect(buildSttPrompt(['성산  일출봉'])).toContain('성산 일출봉');
  });

  it('900자를 넘지 않고, 넘치면 뒤에서부터 버린다 (앞이 우선순위)', () => {
    const many = Array.from({ length: 400 }, (_, i) => `관광지${String(i).padStart(3, '0')}`);
    const prompt = buildSttPrompt(many);
    expect(prompt.length).toBeLessThanOrEqual(MAX_STT_PROMPT_CHARS);
    // 앞쪽은 살아남고 뒤쪽은 잘린다.
    expect(prompt).toContain('관광지000');
    expect(prompt).not.toContain('관광지399');
    // 잘린 자리에 깨진 이름이 남으면 안 된다.
    expect(prompt.endsWith('.')).toBe(true);
    expect(prompt).not.toMatch(/, *\.$/);
  });
});

describe('scheduleTerms', () => {
  it('스톱당 이름 하나만, 알려진 키 순서대로 뽑는다', () => {
    expect(
      scheduleTerms([
        { title: '성산일출봉', name: '무시됨' },
        { name: '만장굴' },
        { spot_title: '비자림' },
        { place_name: '해녀박물관' },
      ]),
    ).toEqual(['성산일출봉', '만장굴', '비자림', '해녀박물관']);
  });

  it('이름이 없는 항목은 건너뛴다', () => {
    expect(scheduleTerms([{ time: '09:00' }, {}, { title: '우도' }])).toEqual(['우도']);
  });

  it('스케줄이 비어도 죽지 않는다', () => {
    expect(scheduleTerms([])).toEqual([]);
  });
});
