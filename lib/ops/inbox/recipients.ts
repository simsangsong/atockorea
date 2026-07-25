// AtoC 통합 — 인박스 수신자 게이트 (plan §3 A-1 보강).
//
// 왜 필요한가: Resend 인바운드는 도메인 catch-all이고, 웹훅은 계정 단위라
// 주소별 라우팅이 없다. 즉 `/api/inbound/email`을 등록하면 support@ 로 오는
// 고객 문의까지 전부 OTA 파서로 들어온다. classify.ts는 인용문에 남은
// "AtoC Korea"/A2C-######## 만으로 channel='atoc'를 잡고, "cancel"/"취소"
// 한 단어로 intent='cancel'을 잡는다 — 고객이 확정메일에 "취소하고 싶어요"
// 라고 답장하면 실제 예약이 soft-cancel 될 수 있다. 그래서 파서는 전용
// 주소로 온 메일만 처리한다.
//
// 대비되는 기존 동작: support 라우트(app/api/webhooks/resend)는
// SUPPORT_INBOUND_ADDRESSES 필터가 있어 bookings@ 메일을 무시한다 —
// 두 라우트가 같은 웹훅 이벤트를 받아도 서로 침범하지 않는다.
//
// 수신자를 페이로드에서 읽어내는 일 자체는 support 라우트와 공유한다
// (lib/email/inbound-recipients.ts) — 같은 누락(bcc)이 두 라우트에서 각각
// 났기 때문에 구현이 하나여야 한다.
//
// 이 모듈은 PURE — I/O 없음, 전량 단위 테스트 가능.

import { collectRecipients, parseAddressList } from '@/lib/email/inbound-recipients'

export { collectRecipients }

/** OPS_INBOUND_ADDRESSES 미설정 시의 기본 수신 주소 (plan §3 A-1). */
export const DEFAULT_OPS_INBOUND_ADDRESSES = ['bookings@atockorea.com']

/** 명시적 오프스위치: OPS_INBOUND_ADDRESSES='*' 면 게이트를 통과시킨다. */
const WILDCARD = '*'

/** null = 와일드카드(모든 수신자 허용). */
export function opsInboundAddresses(): Set<string> | null {
  const configured = process.env.OPS_INBOUND_ADDRESSES
  const allowed = parseAddressList(configured || DEFAULT_OPS_INBOUND_ADDRESSES.join(','))
  if (allowed.has(WILDCARD)) return null
  return allowed
}

export interface RecipientGateResult {
  accepted: boolean
  /** 관측된 수신자 전체 — 게이트가 오작동할 때 응답으로 되돌려 진단에 쓴다. */
  recipients: string[]
  /** 매치된 전용 주소 (accepted일 때만). */
  matched: string | null
}

/**
 * fail-closed: 허용 목록에 매치되는 수신자가 하나도 없으면 거부한다.
 * 수신자를 아예 못 읽어낸 경우도 거부 — 파서가 도는 것보다 안 도는 쪽이
 * 안전하다(예약 오취소 > 미처리). 진단은 recipients 배열로 노출된다.
 */
export function checkOpsInboundRecipient(data: Record<string, unknown>): RecipientGateResult {
  const recipients = collectRecipients(data)
  const allowed = opsInboundAddresses()
  if (allowed === null) return { accepted: true, recipients, matched: WILDCARD }
  const matched = recipients.find((email) => allowed.has(email)) ?? null
  return { accepted: matched !== null, recipients, matched }
}
