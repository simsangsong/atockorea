// Phase 26 §44.5.2 — L2 notes preservation (side-channel contact IDs)
// Master plan §44 hard rule #16 — L2 heuristics MUST preserve WeChat/LINE/
// Kakao/Zalo IDs + 비고 lines into `notes` so reachability scoring (§41.2)
// can populate line_id/kakao_id/zalo_id columns and the Step 5 review card
// can display them.

import { heuristicExtract } from '../heuristics'

describe('heuristicExtract — notes side-contact preservation (Phase 26 §44.5.2)', () => {
  it('preserves WeChat ID', () => {
    const paste = [
      'Lead: zhi cheng li',
      'Phone: +1-2086154873',
      'Email: fivem7810@gmail.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: NEQ165332',
      'WeChat: Chen98113',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('wechat=Chen98113')
  })

  it('preserves LINE ID', () => {
    const paste = [
      'Lead: LIU FU MENG',
      'Phone: +886982852439',
      'Email: fm760302@gmail.com',
      'Pickup: Ocean Suites Jeju Hotel',
      'Tour date: 2026-05-20',
      'Booking ID: NMU195861',
      'LINE: fm760302',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('line=fm760302')
  })

  it('preserves Kakao ID', () => {
    const paste = [
      'Lead: 김미진',
      'Phone: +821012345678',
      'Email: kim@example.com',
      'Pickup: LOTTE City Hotel Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: KAK-1',
      'Kakao: kimmijinkr',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('kakao=kimmijinkr')
  })

  it('preserves Zalo ID', () => {
    const paste = [
      'Lead: Nguyen Van A',
      'Phone: +84901234567',
      'Email: nguyen@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: VN-1',
      'Zalo: 0901234567',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('zalo=0901234567')
  })

  it('preserves Korean 위챗 label', () => {
    const paste = [
      'Lead: 张伟',
      'Phone: +8613917586897',
      'Email: zhang@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: CN-1',
      '위챗: tonyjcong',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('wechat=tonyjcong')
  })

  it('joins multiple side-contacts with " | "', () => {
    const paste = [
      'Lead: Wang Xiaoming',
      'Phone: +8613917586897',
      'Email: wang@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: CN-2',
      'WeChat: wang_xiao',
      'LINE: wangline',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    const notes = out.bookings[0].notes ?? ''
    expect(notes).toContain('wechat=wang_xiao')
    expect(notes).toContain('line=wangline')
    expect(notes).toContain(' | ')
  })

  it('preserves 비고 line verbatim', () => {
    const paste = [
      'Lead: ABEGA Test',
      'Phone: +14155551234',
      'Email: abega@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: BG-1',
      '비고: 휠체어 동반, 알레르기 있음',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toContain('휠체어')
  })

  it('returns undefined notes when no side-contact markers present', () => {
    const paste = [
      'Lead: Clean Booking',
      'Phone: +14155551234',
      'Email: clean@example.com',
      'Pickup: Port of Jeju',
      'Tour date: 2026-05-20',
      'Booking ID: CB-1',
    ].join('\n')
    const out = heuristicExtract(paste)
    expect(out.bookings).toHaveLength(1)
    expect(out.bookings[0].notes).toBeUndefined()
  })
})
