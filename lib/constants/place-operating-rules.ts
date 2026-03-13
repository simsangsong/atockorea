/**
 * 관광지 운영 규칙 데이터
 *
 * - PERMANENTLY_CLOSED: 영구 폐쇄 또는 장기 폐쇄 중인 장소 (AI 일정에서 완전 제외)
 * - CLOSED_ON_WEEKDAYS: 특정 요일 휴장 장소
 * - SEASONAL_CLOSURE: 계절/기간 한정 폐쇄
 *
 * 장소 이름은 AI가 생성하는 한국어/영어 표기를 모두 포함 (부분 매칭으로 필터링).
 */

/** 요일 (0=일요일, 1=월요일, ..., 6=토요일) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlaceOperatingRule {
  /** 매칭에 사용할 이름 키워드 목록 (대소문자 무관, 부분 일치) */
  keywords: string[];
  /** 휴장 요일 목록 */
  closedOnWeekdays?: Weekday[];
  /** 영구/장기 폐쇄 여부 (true이면 일정에서 완전 제외) */
  permanentlyClosed?: boolean;
  /** 운영 중단 사유 (로그/디버그용) */
  reason?: string;
}

/**
 * 장소 운영 규칙 목록.
 * 새로운 폐쇄 정보가 생기면 여기에 추가.
 */
export const PLACE_OPERATING_RULES: PlaceOperatingRule[] = [
  // ──────────────────────────────────────────────
  // 영구/장기 폐쇄 (permanentlyClosed: true)
  // ──────────────────────────────────────────────
  {
    keywords: ['만장굴', 'Manjanggul', 'Manjang Cave', 'Manjang Gul'],
    permanentlyClosed: true,
    reason: '만장굴 장기 폐쇄 중 (재개장 일정 미정)',
  },

  // ──────────────────────────────────────────────
  // 월요일 휴장 (closedOnWeekdays: [1])
  // ──────────────────────────────────────────────
  {
    keywords: ['성산일출봉', 'Seongsan Ilchulbong', 'Seongsan Sunrise Peak'],
    closedOnWeekdays: [1],
    reason: '매월 첫째 월요일 휴장 (실제로는 첫째 월요일만이나 안전하게 월요일 전체 제외)',
  },
  {
    keywords: ['돌문화공원', 'Jeju Stone Park', 'Stone Culture Park', '제주돌문화'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['국립제주박물관', 'Jeju National Museum', '제주박물관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주민속자연사박물관', 'Jeju Folklore Natural History Museum', '민속자연사박물관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주항공우주박물관', 'Jeju Air and Space Museum', '항공우주박물관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['테디베어뮤지엄', 'Teddy Bear Museum', 'Teddy Bear Museum Jeju'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['넥슨컴퓨터박물관', 'Nexon Computer Museum', '넥슨 컴퓨터 박물관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주현대미술관', 'Jeju Museum of Contemporary Art', '현대미술관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주도립미술관', 'Jeju Museum of Art', '도립미술관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['김창열미술관', 'Kim Tschang-Yeul Museum'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['이중섭미술관', 'Lee Jung-seob Art Museum', '이중섭 미술관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주해녀박물관', 'Jeju Haenyeo Museum', '해녀박물관'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['추사관', 'Chusa Museum', '추사 김정희'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['제주자연생태공원', 'Jeju Eco Land', '에코랜드'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관 (시즌에 따라 변동 가능)',
  },
  {
    keywords: ['오설록티뮤지엄', "O'Sulloc Tea Museum", 'Osulloc Tea Museum', '오설록 티뮤지엄'],
    closedOnWeekdays: [],
    reason: '연중무휴 (휴장 없음)',
  },

  // ──────────────────────────────────────────────
  // 화요일 휴장
  // ──────────────────────────────────────────────
  {
    keywords: ['본태박물관', 'Bonte Museum'],
    closedOnWeekdays: [2],
    reason: '매주 화요일 휴관',
  },

  // ──────────────────────────────────────────────
  // 서울 주요 월요일 휴관 시설
  // ──────────────────────────────────────────────
  {
    keywords: ['국립중앙박물관', 'National Museum of Korea'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['국립민속박물관', 'National Folk Museum'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['서울역사박물관', 'Seoul Museum of History'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['국립현대미술관', 'National Museum of Modern and Contemporary Art', 'MMCA'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['서울시립미술관', 'Seoul Museum of Art', 'SeMA'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },

  // ──────────────────────────────────────────────
  // 부산 주요 월요일 휴관 시설
  // ──────────────────────────────────────────────
  {
    keywords: ['국립해양박물관', 'National Maritime Museum'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['부산시립미술관', 'Busan Museum of Art'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
  {
    keywords: ['부산박물관', 'Busan Museum'],
    closedOnWeekdays: [1],
    reason: '매주 월요일 휴관',
  },
];

/** 요일 이름 (디버그/로그용) */
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

/**
 * 장소 이름이 특정 규칙에 해당하는지 확인 (부분 문자열 매칭, 대소문자 무관)
 */
function matchesRule(placeName: string, rule: PlaceOperatingRule): boolean {
  const lower = placeName.toLowerCase();
  return rule.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * 장소가 영구/장기 폐쇄 상태인지 확인.
 * true이면 일정에서 완전 제외해야 함.
 */
export function isPermanentlyClosed(placeName: string): boolean {
  return PLACE_OPERATING_RULES.some(
    (rule) => rule.permanentlyClosed && matchesRule(placeName, rule)
  );
}

/**
 * 장소가 특정 요일에 휴장인지 확인.
 * @param placeName 장소 이름
 * @param weekday 0=일, 1=월, ..., 6=토
 */
export function isClosedOnWeekday(placeName: string, weekday: Weekday): boolean {
  return PLACE_OPERATING_RULES.some(
    (rule) =>
      !rule.permanentlyClosed &&
      rule.closedOnWeekdays?.includes(weekday) &&
      matchesRule(placeName, rule)
  );
}

/**
 * 장소가 특정 날짜(Date)에 운영하지 않는지 확인.
 * permanentlyClosed 또는 해당 요일 휴장이면 true.
 */
export function isPlaceUnavailable(placeName: string, date?: Date): boolean {
  if (isPermanentlyClosed(placeName)) return true;
  if (date) {
    const weekday = date.getDay() as Weekday;
    if (isClosedOnWeekday(placeName, weekday)) return true;
  }
  return false;
}

/**
 * 프롬프트에 주입할 운영 규칙 텍스트를 생성.
 * @param tourDate 여행 시작 날짜 (있으면 요일 정보 포함)
 */
export function buildPlaceOperatingRulesPrompt(tourDate?: Date): string {
  const lines: string[] = [];

  // 영구/장기 폐쇄
  const closed = PLACE_OPERATING_RULES.filter((r) => r.permanentlyClosed);
  if (closed.length > 0) {
    lines.push('PERMANENTLY CLOSED — NEVER include these places in any itinerary:');
    closed.forEach((r) => {
      lines.push(`  - ${r.keywords[0]} (${r.reason ?? 'closed'})`);
    });
  }

  // 요일 휴장
  if (tourDate) {
    const weekday = tourDate.getDay() as Weekday;
    const closedToday = PLACE_OPERATING_RULES.filter(
      (r) => !r.permanentlyClosed && r.closedOnWeekdays?.includes(weekday)
    );
    if (closedToday.length > 0) {
      lines.push(`CLOSED ON ${WEEKDAY_NAMES[weekday].toUpperCase()} — Do NOT include these on ${WEEKDAY_NAMES[weekday]} (Day 1 falls on ${WEEKDAY_NAMES[weekday]}):`);
      closedToday.forEach((r) => {
        lines.push(`  - ${r.keywords[0]}`);
      });
    }
  } else {
    // 날짜 미지정 시 월요일 휴장 목록 주의사항으로 포함
    const mondayClosed = PLACE_OPERATING_RULES.filter(
      (r) => !r.permanentlyClosed && r.closedOnWeekdays?.includes(1)
    );
    if (mondayClosed.length > 0) {
      lines.push('CLOSED ON MONDAYS — avoid these if any day falls on Monday:');
      mondayClosed.forEach((r) => {
        lines.push(`  - ${r.keywords[0]}`);
      });
    }
  }

  return lines.join('\n');
}

/**
 * 생성된 일정에서 폐쇄/휴장 장소를 후처리로 제거.
 * - permanentlyClosed 장소는 날짜 무관 제거
 * - 날짜가 주어지면 해당 요일 휴장 장소도 제거
 *
 * @param schedule DaySchedule 배열
 * @param startDate 여행 시작 날짜 (Day 1 기준). 없으면 요일 필터 미적용
 * @returns 필터링된 schedule과 제거된 장소 목록
 */
export function filterUnavailablePlaces<T extends { day: number; places: Array<{ name: string }> }>(
  schedule: T[],
  startDate?: Date
): { filtered: T[]; removed: Array<{ day: number; name: string; reason: string }> } {
  const removed: Array<{ day: number; name: string; reason: string }> = [];

  const filtered = schedule.map((daySchedule) => {
    const date = startDate
      ? new Date(startDate.getTime() + (daySchedule.day - 1) * 86400000)
      : undefined;
    const weekday = date ? (date.getDay() as Weekday) : undefined;

    const filteredPlaces = daySchedule.places.filter((place) => {
      if (isPermanentlyClosed(place.name)) {
        const rule = PLACE_OPERATING_RULES.find(
          (r) => r.permanentlyClosed && r.keywords.some((kw) => place.name.toLowerCase().includes(kw.toLowerCase()))
        );
        removed.push({ day: daySchedule.day, name: place.name, reason: rule?.reason ?? '영구 폐쇄' });
        return false;
      }
      if (weekday !== undefined && isClosedOnWeekday(place.name, weekday)) {
        const rule = PLACE_OPERATING_RULES.find(
          (r) => r.closedOnWeekdays?.includes(weekday) && r.keywords.some((kw) => place.name.toLowerCase().includes(kw.toLowerCase()))
        );
        removed.push({ day: daySchedule.day, name: place.name, reason: rule?.reason ?? `${WEEKDAY_NAMES[weekday]} 휴장` });
        return false;
      }
      return true;
    });

    return { ...daySchedule, places: filteredPlaces };
  });

  return { filtered, removed };
}
