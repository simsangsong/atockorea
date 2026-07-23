/**
 * @jest-environment node
 *
 * Slice 2 — low-confidence alert gating: OPS_ALERT_EMAIL 부재 시 Resend를
 * 아예 호출하지 않는다 (발송 코드는 존재하되 실발송 없음).
 */
const sendMock = jest.fn(async (_payload: unknown) => ({ data: { id: 'em-1' }, error: null }))
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}))

import { Resend } from 'resend'
import { sendLowConfidenceAlert } from '../alert'

const baseInput = {
  channel: 'klook',
  intent: 'confirm',
  messageId: 'msg-1',
  maskedSamples: ['{{NAME}} · Jeju East · {{DATE}}'],
  failedCount: 1,
  totalCount: 2,
}

const ENV_KEYS = ['OPS_ALERT_EMAIL', 'RESEND_API_KEY'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  jest.clearAllMocks()
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('sendLowConfidenceAlert', () => {
  it('skips entirely without OPS_ALERT_EMAIL — no Resend construction, no send', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const res = await sendLowConfidenceAlert(baseInput)
    expect(res).toEqual({ sent: false, skipped: true })
    expect(Resend).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips without RESEND_API_KEY even when the recipient is set', async () => {
    process.env.OPS_ALERT_EMAIL = 'jason@example.com'
    const res = await sendLowConfidenceAlert(baseInput)
    expect(res.sent).toBe(false)
    expect(res.skipped).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends masked samples when both env vars are present', async () => {
    process.env.OPS_ALERT_EMAIL = 'jason@example.com'
    process.env.RESEND_API_KEY = 're_test'
    const res = await sendLowConfidenceAlert(baseInput)
    expect(res).toEqual({ sent: true, skipped: false })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0] as unknown as { to: string; html: string }
    expect(arg.to).toBe('jason@example.com')
    expect(arg.html).toContain('{{NAME}}')
  })
})
