import { maskLine } from '../mask'

describe('maskLine — NAME_LABEL_RX collision', () => {
  it('does not mistake "customer-<hash>@reply..." for a labeled name', () => {
    // The pre-fix regex captured everything after "customer-" because [:\-]?
    // permitted the dash. Now masking only fires on explicit colon.
    const raw = 'customer-mgu6iizmvxgingwv@reply.getyourguide.com'
    const r = maskLine(raw, [])
    // Email is still masked, but the {{NAME}} substitution must NOT replace
    // the email hash portion before the email mask gets to it.
    expect(r.masked).toBe('{{EMAIL}}')
  })

  it('does mask explicit labeled names', () => {
    const raw = 'Lead Guest: John Doe'
    const r = maskLine(raw, [])
    expect(r.masked).toBe('Lead Guest: {{NAME}}')
  })
})
