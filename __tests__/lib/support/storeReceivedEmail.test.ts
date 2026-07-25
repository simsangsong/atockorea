/**
 * @jest-environment node
 *
 * support 인박스 저장 규칙 (웹훅 라우트 + 백필 스크립트 공유). Supabase mock.
 */
import { storeReceivedEmail, categorizeEmail, firstEmailAddress } from '@/lib/support/storeReceivedEmail'

interface Captured {
  received: Array<Record<string, unknown>>
  inquiries: Array<Record<string, unknown>>
}

function fakeDb(
  opts: { insertError?: { code?: string; message: string } | null; existingRow?: { id: string } | null } = {},
) {
  const captured: Captured = { received: [], inquiries: [] }
  const db = {
    captured,
    from(table: string) {
      return {
        // dry-run 중복 조회 경로: .select('id').eq('message_id', …).maybeSingle()
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: opts.existingRow ?? null, error: null }) }),
        }),
        insert: (row: Record<string, unknown>) => {
          if (table === 'received_emails') {
            captured.received.push(row)
            return {
              select: () => ({
                single: async () =>
                  opts.insertError
                    ? { data: null, error: opts.insertError }
                    : { data: { id: 'rec-1' }, error: null },
              }),
            }
          }
          captured.inquiries.push(row)
          return Promise.resolve({ error: null })
        },
      }
    },
  }
  return db
}

const savedAddrs = process.env.SUPPORT_INBOUND_ADDRESSES
beforeEach(() => {
  delete process.env.SUPPORT_INBOUND_ADDRESSES
})
afterAll(() => {
  if (savedAddrs === undefined) delete process.env.SUPPORT_INBOUND_ADDRESSES
  else process.env.SUPPORT_INBOUND_ADDRESSES = savedAddrs
})

const base = {
  email_id: 'em_1',
  from: 'Guest <guest@example.com>',
  subject: 'Question about my tour',
  text: 'Hello, I have a question.',
}

describe('storeReceivedEmail — recipient resolution', () => {
  it('stores a plain to: support message', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({ supabase: db as never, data: { ...base, to: ['support@atockorea.com'] } })
    expect(out).toMatchObject({ result: 'stored', toEmail: 'support@atockorea.com' })
    expect(db.captured.received[0]).toMatchObject({
      message_id: 'em_1',
      from_email: 'guest@example.com',
      from_name: 'Guest',
      to_email: 'support@atockorea.com',
    })
    expect(db.captured.inquiries).toHaveLength(1)
  })

  it('🔴 stores a message whose support address is only in bcc (라이브 유실 케이스)', async () => {
    // 2026-05-20 실패 이벤트 형태: To:는 다른 주소, 봉투 수신자는 bcc에.
    // 이전 구현은 bcc를 안 봐서 이 메일을 "not for support inbox"로 버렸다.
    const db = fakeDb()
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: { ...base, to: ['someone-else@example.com'], bcc: ['support@atockorea.com'] },
    })
    expect(out).toMatchObject({ result: 'stored', toEmail: 'support@atockorea.com' })
    expect(db.captured.received).toHaveLength(1)
  })

  it('stores a Gmail-forwarded message found via X-Forwarded-To', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: { ...base, to: 'jason@gmail.com', headers: { 'X-Forwarded-To': 'support@atockorea.com' } },
    })
    expect(out).toMatchObject({ result: 'stored' })
  })

  it('ignores mail for the OTA parser inbox and reports what it saw', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({ supabase: db as never, data: { ...base, to: 'bookings@atockorea.com' } })
    expect(out).toEqual({ result: 'not_support', recipients: ['bookings@atockorea.com'] })
    expect(db.captured.received).toHaveLength(0)
    expect(db.captured.inquiries).toHaveLength(0)
  })

  it('honours SUPPORT_INBOUND_ADDRESSES override', async () => {
    process.env.SUPPORT_INBOUND_ADDRESSES = 'help@atockorea.com'
    const db = fakeDb()
    expect(
      (await storeReceivedEmail({ supabase: db as never, data: { ...base, to: 'support@atockorea.com' } })).result,
    ).toBe('not_support')
    expect(
      (await storeReceivedEmail({ supabase: db as never, data: { ...base, to: 'help@atockorea.com' } })).result,
    ).toBe('stored')
  })
})

describe('storeReceivedEmail — self-send loopback', () => {
  // ADMIN_BOOKING_NOTIFICATION_EMAILS에 support@가 있고 support@는 인바운드
  // catch-all이라, 우리가 보낸 예약/SOS 알림이 그대로 되돌아온다.
  it('records our own notification but creates no customer inquiry', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: {
        email_id: 'em_self',
        from: 'AtoC Korea <support@atockorea.com>',
        to: 'support@atockorea.com',
        subject: '🆕 새 예약 접수 — Busan Cruise Shore',
        text: '...',
      },
    })
    expect(out).toMatchObject({ result: 'stored_self' })
    expect(db.captured.received).toHaveLength(1)
    expect(db.captured.received[0].category).toBe('self_notification')
    expect(db.captured.inquiries).toHaveLength(0) // 핵심: 가짜 "새 문의"가 생기지 않는다
  })

  it('treats noreply@ and alerts@ as self too', async () => {
    for (const from of ['noreply@atockorea.com', 'AtoC Ops Alerts <alerts@atockorea.com>']) {
      const db = fakeDb()
      const out = await storeReceivedEmail({
        supabase: db as never,
        data: { email_id: `em_${from}`, from, to: 'support@atockorea.com', subject: 's', text: 't' },
      })
      expect(out.result).toBe('stored_self')
      expect(db.captured.inquiries).toHaveLength(0)
    }
  })

  it('still creates an inquiry for a real outside sender', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: { email_id: 'em_ext', from: 'traveller@gmail.com', to: 'support@atockorea.com', subject: 's', text: 't' },
    })
    expect(out.result).toBe('stored')
    expect(db.captured.inquiries).toHaveLength(1)
  })
})

describe('storeReceivedEmail — persistence contract', () => {
  it('reports duplicate on a unique-violation instead of erroring (멱등)', async () => {
    const db = fakeDb({ insertError: { code: '23505', message: 'dup' } })
    const out = await storeReceivedEmail({ supabase: db as never, data: { ...base, to: 'support@atockorea.com' } })
    expect(out).toMatchObject({ result: 'duplicate' })
    expect(db.captured.inquiries).toHaveLength(0)
  })

  it('surfaces a real insert error with its stage', async () => {
    const db = fakeDb({ insertError: { code: '23502', message: 'null value' } })
    const out = await storeReceivedEmail({ supabase: db as never, data: { ...base, to: 'support@atockorea.com' } })
    expect(out).toMatchObject({ result: 'error', stage: 'received_emails' })
  })

  it('falls back to fallbackMessageId and (No Subject)', async () => {
    const db = fakeDb()
    await storeReceivedEmail({
      supabase: db as never,
      data: { to: 'support@atockorea.com', from: 'a@b.com', text: 'x' },
      fallbackMessageId: 'gen-123',
    })
    expect(db.captured.received[0]).toMatchObject({ message_id: 'gen-123', subject: '(No Subject)' })
  })

  it('prefers text, falls back to html for the inquiry body', async () => {
    const db = fakeDb()
    await storeReceivedEmail({
      supabase: db as never,
      data: { ...base, text: '', html: '<p>html only</p>', to: 'support@atockorea.com' },
    })
    expect(db.captured.inquiries[0].message).toBe('<p>html only</p>')
  })

  it('writes nothing in dryRun but still reports the verdict', async () => {
    const db = fakeDb()
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: { ...base, to: 'support@atockorea.com' },
      dryRun: true,
    })
    expect(out).toMatchObject({ result: 'stored', toEmail: 'support@atockorea.com' })
    expect(db.captured.received).toHaveLength(0)
    expect(db.captured.inquiries).toHaveLength(0)
  })

  it('dryRun still detects an already-stored message so the preview count is honest', async () => {
    const db = fakeDb({ existingRow: { id: 'rec-existing' } })
    const out = await storeReceivedEmail({
      supabase: db as never,
      data: { ...base, to: 'support@atockorea.com' },
      dryRun: true,
    })
    expect(out).toMatchObject({ result: 'duplicate' })
  })
})

describe('helpers', () => {
  it('categorizeEmail keeps the original precedence', () => {
    expect(categorizeEmail('Need support', '')).toBe('support')
    expect(categorizeEmail('A question', '')).toBe('inquiry')
    expect(categorizeEmail('Refund please', '')).toBe('complaint')
    expect(categorizeEmail('My booking', '')).toBe('booking')
    expect(categorizeEmail('hello', 'hi')).toBe('other')
  })

  it('firstEmailAddress reads strings, angle form, arrays and objects', () => {
    expect(firstEmailAddress('A B <a@b.com>')).toEqual({ email: 'a@b.com', name: 'A B' })
    expect(firstEmailAddress(['x@y.com'])).toEqual({ email: 'x@y.com', name: null })
    expect(firstEmailAddress({ email: 'Q@R.com', name: 'Q' })).toEqual({ email: 'q@r.com', name: 'Q' })
    expect(firstEmailAddress(null, undefined, '')).toEqual({ email: '', name: null })
  })
})
