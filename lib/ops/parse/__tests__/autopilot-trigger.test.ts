// Parser Autopilot — immediate-trigger gate.

import { shouldTriggerAutopilot } from '../autopilot-trigger'

describe('shouldTriggerAutopilot', () => {
  it('fires on a NOVEL format with enough signal-present leftover', () => {
    expect(shouldTriggerAutopilot({ matchedTemplate: false, signalPresentLeftovers: 5 })).toBe(true)
  })

  it('does NOT fire when a known template matched (working format)', () => {
    expect(shouldTriggerAutopilot({ matchedTemplate: true, signalPresentLeftovers: 50 })).toBe(false)
  })

  it('does NOT fire below the floor (a stray line is not a churn event)', () => {
    expect(shouldTriggerAutopilot({ matchedTemplate: false, signalPresentLeftovers: 2 })).toBe(false)
  })

  it('respects a custom floor', () => {
    expect(shouldTriggerAutopilot({ matchedTemplate: false, signalPresentLeftovers: 1, floor: 1 })).toBe(true)
  })
})
