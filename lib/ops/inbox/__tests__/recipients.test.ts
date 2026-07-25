/**
 * @jest-environment node
 *
 * 인박스 수신자 게이트 (plan §3 A-1 보강) — PURE, 네트워크 0.
 */
import { checkOpsInboundRecipient, collectRecipients, opsInboundAddresses } from '../recipients'

const saved = process.env.OPS_INBOUND_ADDRESSES

beforeEach(() => {
  delete process.env.OPS_INBOUND_ADDRESSES
})

afterAll(() => {
  if (saved === undefined) delete process.env.OPS_INBOUND_ADDRESSES
  else process.env.OPS_INBOUND_ADDRESSES = saved
})

describe('opsInboundAddresses', () => {
  it('defaults to bookings@atockorea.com', () => {
    expect(opsInboundAddresses()).toEqual(new Set(['bookings@atockorea.com']))
  })

  it('parses a comma-separated override and lowercases it', () => {
    process.env.OPS_INBOUND_ADDRESSES = ' OTA@Example.com , bookings@atockorea.com '
    expect(opsInboundAddresses()).toEqual(new Set(['ota@example.com', 'bookings@atockorea.com']))
  })

  it('returns null (wildcard) for "*"', () => {
    process.env.OPS_INBOUND_ADDRESSES = '*'
    expect(opsInboundAddresses()).toBeNull()
  })
})

describe('collectRecipients', () => {
  it('reads a bare string', () => {
    expect(collectRecipients({ to: 'Bookings <bookings@atockorea.com>' })).toEqual(['bookings@atockorea.com'])
  })

  it('reads arrays and address objects', () => {
    expect(collectRecipients({ to: ['a@x.com', { email: 'B@X.com' }] })).toEqual(['a@x.com', 'b@x.com'])
  })

  it('splits a comma-joined header value', () => {
    expect(collectRecipients({ to: 'a@x.com, Name <b@x.com>' })).toEqual(['a@x.com', 'b@x.com'])
  })

  it('reads {name,value}[] headers and {name:value} headers alike', () => {
    const asArray = collectRecipients({ headers: [{ name: 'X-Forwarded-To', value: 'bookings@atockorea.com' }] })
    const asMap = collectRecipients({ headers: { 'x-forwarded-to': 'bookings@atockorea.com' } })
    expect(asArray).toEqual(['bookings@atockorea.com'])
    expect(asMap).toEqual(['bookings@atockorea.com'])
  })

  it('unions envelope + Delivered-To + cc and dedupes', () => {
    const found = collectRecipients({
      to: 'jason@gmail.com',
      cc: 'ops@atockorea.com',
      headers: { 'Delivered-To': 'jason@gmail.com', 'X-Forwarded-To': 'bookings@atockorea.com' },
    })
    expect(new Set(found)).toEqual(new Set(['jason@gmail.com', 'ops@atockorea.com', 'bookings@atockorea.com']))
  })

  it('reads the envelope recipient Resend parks in bcc (라이브 페이로드 형태)', () => {
    // 실제 실패 이벤트 형태: To:는 다른 주소, 봉투 수신자는 bcc 배열에.
    const found = collectRecipients({
      to: 'noreply@klook.com',
      bcc: ['bookings@atockorea.com'],
      attachments: [],
    })
    expect(found).toContain('bookings@atockorea.com')
  })

  it('drops values that are not addresses', () => {
    expect(collectRecipients({ to: 'undisclosed-recipients', recipients: 42 })).toEqual([])
  })
})

describe('checkOpsInboundRecipient', () => {
  it('accepts the dedicated address', () => {
    const r = checkOpsInboundRecipient({ to: 'bookings@atockorea.com' })
    expect(r.accepted).toBe(true)
    expect(r.matched).toBe('bookings@atockorea.com')
  })

  it('rejects the support inbox — the whole point of the gate', () => {
    expect(checkOpsInboundRecipient({ to: 'support@atockorea.com' }).accepted).toBe(false)
  })

  it('accepts a Gmail forward whose To: header is still the original OTA recipient', () => {
    const r = checkOpsInboundRecipient({
      to: 'jason@gmail.com',
      headers: { 'X-Forwarded-To': 'bookings@atockorea.com' },
    })
    expect(r.accepted).toBe(true)
  })

  it('fails closed on an unreadable payload and reports what it saw', () => {
    const r = checkOpsInboundRecipient({})
    expect(r.accepted).toBe(false)
    expect(r.recipients).toEqual([])
  })

  it('lets "*" through as an explicit escape hatch', () => {
    process.env.OPS_INBOUND_ADDRESSES = '*'
    expect(checkOpsInboundRecipient({ to: 'anyone@anywhere.com' }).accepted).toBe(true)
  })
})
