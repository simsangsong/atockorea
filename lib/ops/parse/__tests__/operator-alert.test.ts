// Parser Autopilot — operator-alert gate (real-time anti-churn lever).

import { shouldAlertOperator } from '../operator-alert'

describe('shouldAlertOperator', () => {
  it('alerts when more extractable rows dropped than parsed (largely failed)', () => {
    expect(shouldAlertOperator({ signalPresentLeftovers: 10, totalBookings: 2 })).toBe(true)
  })

  it('alerts on a total failure (parsed 0)', () => {
    expect(shouldAlertOperator({ signalPresentLeftovers: 27, totalBookings: 0 })).toBe(true)
  })

  it('does NOT alert on a mostly-successful import with a few partials', () => {
    expect(shouldAlertOperator({ signalPresentLeftovers: 3, totalBookings: 60 })).toBe(false)
  })

  it('does NOT alert below the floor (stray line)', () => {
    expect(shouldAlertOperator({ signalPresentLeftovers: 2, totalBookings: 0 })).toBe(false)
  })
})
