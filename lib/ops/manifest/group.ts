// AtoC 통합 Phase 2 — 명단(Roster) 그룹핑 로직 (plan §3.2, kursoflow
// ManifestView/PickupGroup 패턴 참고).
//
// 명단 = 별도 테이블이 아니라 (tour_id, tour_date) 룸에 속한 bookings의 파생
// 뷰. 이 모듈은 PURE (no I/O) — API 응답 rows를 픽업지 canonical 그룹으로
// 묶고 특이사항을 하이라이트 추출한다. 단위 테스트 대상.

export interface ManifestBooking {
  id: string
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  whatsapp?: string | null
  partySize: number
  preferredLanguage: string | null
  status: string | null
  source: string | null
  externalBookingId: string | null
  /** pickup_points.name (자체 주문) 또는 ota_raw_meta.pickup_* (OTA). */
  pickupName: string | null
  pickupTime: string | null
  specialRequests: string | null
  /** ops_whatsapp_send_logs 파생 — 마지막 로그 기준. */
  waOpenedAt?: string | null
  waMarkedSentAt?: string | null
}

export interface ManifestGroup {
  /** normalize된 그룹 키 — 미지정은 'unassigned'. */
  key: string
  /** 그룹 헤더 표시명 (첫 booking의 원문 표기). */
  displayName: string
  /** 그룹 내 최이른 픽업 시각 (HH:MM) — 정렬 기준. */
  firstPickupTime: string | null
  bookings: ManifestBooking[]
  teamCount: number
  paxCount: number
}

export const UNASSIGNED_GROUP_KEY = 'unassigned'

/** kursoflow pickup canonicalization의 경량판: 표기 변형(공백/구두점/대소문자)
 *  통합 키. 사전 기반 canonicalization(Phase 2.5)은 이 키 위에 얹는다. */
export function normalizePickupKey(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().toLowerCase().replace(/[\s\-·,()./']+/g, '')
  return s || UNASSIGNED_GROUP_KEY
}

/** 특이사항 하이라이트 — 알레르기/식단/이동보조/유아 키워드 (plan §3.2). */
const HIGHLIGHT_RULES: Array<{ rx: RegExp; tag: string }> = [
  { rx: /allerg|알레르기|알러지|過敏|アレルギー|alergi/i, tag: 'allergy' },
  { rx: /vegan|vegetarian|halal|kosher|no\s+pork|gluten|채식|비건|할랄|돼지고기|글루텐|素食|ベジタリアン|ハラール/i, tag: 'dietary' },
  { rx: /wheelchair|mobility|휠체어|거동|車椅子|silla de ruedas/i, tag: 'mobility' },
  { rx: /\binfant\b|\bbaby\b|child\s*seat|toddler|유아|아기|카시트|嬰兒|幼児|bebé/i, tag: 'infant' },
]

export function extractHighlights(specialRequests: string | null | undefined): string[] {
  const s = (specialRequests ?? '').trim()
  if (!s) return []
  const tags: string[] = []
  for (const rule of HIGHLIGHT_RULES) {
    if (rule.rx.test(s)) tags.push(rule.tag)
  }
  return tags
}

function timeSortKey(t: string | null): string {
  // HH:MM 우선 정렬 — 시간이 없으면 뒤로.
  return t && /^\d{1,2}:\d{2}/.test(t) ? t.padStart(5, '0') : '99:99'
}

/**
 * 픽업지 그룹핑 (plan §3.2): 같은 canonical 키의 bookings를 한 그룹으로 —
 * 그룹은 픽업 시각 오름차순, "미지정" 그룹은 항상 마지막. 그룹 내부는
 * 이름 알파벳순 (kursoflow Phase 20 패턴 — 명단에서 이름 찾기 최적화).
 */
export function groupBookingsByPickup(bookings: ManifestBooking[]): ManifestGroup[] {
  const byKey = new Map<string, ManifestGroup>()

  for (const booking of bookings) {
    const key = normalizePickupKey(booking.pickupName)
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        displayName: key === UNASSIGNED_GROUP_KEY ? '픽업 미지정' : (booking.pickupName ?? '').trim(),
        firstPickupTime: null,
        bookings: [],
        teamCount: 0,
        paxCount: 0,
      }
      byKey.set(key, group)
    }
    group.bookings.push(booking)
    group.teamCount += 1
    group.paxCount += Math.max(1, booking.partySize || 1)
    if (booking.pickupTime && /^\d{1,2}:\d{2}/.test(booking.pickupTime)) {
      const hhmm = booking.pickupTime.slice(0, 5).padStart(5, '0')
      if (!group.firstPickupTime || hhmm < group.firstPickupTime) group.firstPickupTime = hhmm
    }
  }

  const groups = [...byKey.values()]
  for (const group of groups) {
    group.bookings.sort((a, b) =>
      (a.contactName ?? '').localeCompare(b.contactName ?? '', undefined, { sensitivity: 'base' }),
    )
  }
  groups.sort((a, b) => {
    if (a.key === UNASSIGNED_GROUP_KEY) return 1
    if (b.key === UNASSIGNED_GROUP_KEY) return -1
    const t = timeSortKey(a.firstPickupTime).localeCompare(timeSortKey(b.firstPickupTime))
    if (t !== 0) return t
    return a.displayName.localeCompare(b.displayName)
  })
  return groups
}

export interface ManifestTotals {
  teams: number
  pax: number
  contacted: number // marked_sent 기준 (연락 완료 팀 수)
  uncontacted: number
}

export function manifestTotals(bookings: ManifestBooking[]): ManifestTotals {
  const teams = bookings.length
  const pax = bookings.reduce((s, b) => s + Math.max(1, b.partySize || 1), 0)
  const contacted = bookings.filter((b) => Boolean(b.waMarkedSentAt)).length
  return { teams, pax, contacted, uncontacted: teams - contacted }
}
