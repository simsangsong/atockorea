import {
  buildPatternFromTemplate,
  buildSlotMap,
  buildPostprocess,
  patternFingerprint,
  isMineable,
  buildRuleFromCluster,
} from '../mining'
import { tryCompile } from '../rules'

describe('mining — buildPatternFromTemplate', () => {
  it('escapes regex metacharacters in literal text', () => {
    expect(buildPatternFromTemplate('a (b) c')).toBe('a \\(b\\) c')
    // Hyphen is NOT a regex metacharacter outside character classes — left alone.
    expect(buildPatternFromTemplate('1. 남쪽 - Lotte')).toBe('1\\. 남쪽 - Lotte')
  })

  it('preserves {{TOKEN}} placeholders verbatim', () => {
    expect(buildPatternFromTemplate('{{NAME}} ({{N}} 명)')).toBe('{{NAME}} \\({{N}} 명\\)')
  })

  it('round-trips through rules.tryCompile to a valid RegExp', () => {
    const tpl = '인천항-일반 / {{NAME}} ( 비아토르 - BR-{{PHONE}} ) / {{N}} 명'
    const pattern = buildPatternFromTemplate(tpl)
    const re = tryCompile(pattern)
    expect(re).not.toBeNull()
  })

  it('compiled regex actually matches a representative input', () => {
    const tpl = '인천항-일반 / {{NAME}} ( 비아토르 - BR-{{PHONE}} ) / {{N}} 명'
    const pattern = buildPatternFromTemplate(tpl)
    const re = tryCompile(pattern)
    expect(re).not.toBeNull()
    const m = '인천항-일반 / Alice Wong ( 비아토르 - BR-1230125029 ) / 3 명'.match(re!)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('Alice Wong')
    expect(m![3]).toBe('3')
  })
})

describe('mining — buildSlotMap', () => {
  it('assigns 0-based indexes in order of token appearance', () => {
    const tpl = '{{NAME}} / {{EMAIL}} / {{PHONE}}'
    expect(buildSlotMap(tpl)).toEqual({
      name: 0,
      email: 1,
      phone: 2,
    })
  })

  it('maps {{N}} followed by 명 to party_size', () => {
    expect(buildSlotMap('{{NAME}} ({{N}} 명)')).toEqual({
      name: 0,
      party_size: 1,
    })
  })

  it('maps {{N}} followed by 대 to vehicle_capacity', () => {
    expect(buildSlotMap('{{NAME}} / {{N}} 대')).toEqual({
      name: 0,
      vehicle_capacity: 1,
    })
  })

  it('maps leading {{N}}. to seq when preceded by line start', () => {
    const tpl = '{{N}}. 남쪽 - {{LOCATION}}\n{{NAME}} ({{N}} 명)'
    const sm = buildSlotMap(tpl)
    expect(sm.seq).toBe(0)
    expect(sm.pickup_location).toBe(1)
    expect(sm.name).toBe(2)
    expect(sm.party_size).toBe(3)
  })

  it('disambiguates repeated tokens with _2 suffix', () => {
    const tpl = '{{LOCATION}} ... {{LOCATION}}'
    expect(buildSlotMap(tpl)).toEqual({
      pickup_location: 0,
      pickup_location_2: 1,
    })
  })
})

describe('mining — buildPostprocess', () => {
  it('detects cancellation prefix', () => {
    expect(buildPostprocess('취소됨 !!!! {{NAME}} ...')).toEqual({
      set_booking_status: 'cancelled',
    })
  })

  it('detects platform aliases in literal text', () => {
    const pp = buildPostprocess('{{NAME}} ( 비아토르 - {{EXTID}} ) / {{N}} 명')
    expect(pp).not.toBeNull()
    expect(pp!.platform_normalize).toEqual({ '비아토르': 'viator' })
  })

  it('detects multiple platform aliases', () => {
    const pp = buildPostprocess('{{NAME}} - 클룩 or 비아토르 - {{EXTID}}')
    expect(pp!.platform_normalize).toMatchObject({
      '클룩': 'klook',
      '비아토르': 'viator',
    })
  })

  it('returns null when no postprocess hints are detected', () => {
    expect(buildPostprocess('{{NAME}} | {{N}} pax | {{EXTID}}')).toBeNull()
  })
})

describe('mining — patternFingerprint', () => {
  it('treats {{TOKEN}} variants as equivalent shapes', () => {
    const a = patternFingerprint('{{NAME}} / {{N}} 명')
    const b = patternFingerprint('{{NAME}}\t/ {{N}} 명')
    expect(a).toBe(b)
  })

  it('treats escaped and unescaped literal parens as the same shape', () => {
    const a = patternFingerprint('\\(인원수 x {{N}} 명\\)')
    const b = patternFingerprint('(인원수 x {{N}} 명)')
    expect(a).toBe(b)
  })

  it('is case-insensitive', () => {
    expect(patternFingerprint('Hello {{NAME}}')).toBe(patternFingerprint('HELLO {{NAME}}'))
  })
})

describe('mining — isMineable', () => {
  it('rejects templates without {{NAME}}', () => {
    expect(isMineable('blah {{N}} blah').ok).toBe(false)
  })

  it('rejects too-short templates', () => {
    expect(isMineable('{{NAME}}').ok).toBe(false)
  })

  it('accepts a typical Viator cluster template', () => {
    const tpl = '인천항-일반 / {{NAME}} ( 비아토르 - BR-{{PHONE}} ) / 영어 / {{N}} 명'
    expect(isMineable(tpl).ok).toBe(true)
  })
})

describe('mining — buildRuleFromCluster (end-to-end)', () => {
  it('produces a usable shadow rule from a real production cluster template', () => {
    const cluster = {
      tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
      template_hash: '2e6fc8157f3c9a152897b1f76d30c47375c4be0dabbb0c8845fc0ffbdcdc929a',
      raw_line_template:
        '인천항-일반 / {{NAME}} ( 비아토르 - BR-{{PHONE}} ) / 영어 / {{N}} 명 / 만남의 장소: {{LOCATION}} / / / {{PHONE}} / ',
      cluster_size: 3,
    }
    const r = buildRuleFromCluster(cluster)
    expect(r.candidate).toBeDefined()
    const c = r.candidate!
    expect(c.status).toBe('shadow')
    expect(c.source).toBe('auto_mined')
    // match/success start at 0 (unvalidated) — shadow scoring accrues them from
    // live traffic. Cluster size is preserved in the diagnostic field instead.
    expect(c.match_count).toBe(0)
    expect(c.success_count).toBe(0)
    expect(c.source_cluster_size).toBe(3)
    expect(c.slot_map.name).toBe(0)
    expect(c.slot_map.phone).toBe(1)
    expect(c.slot_map.party_size).toBe(2)
    expect(c.slot_map.pickup_location).toBe(3)
    expect(c.slot_map.phone_2).toBe(4)
    expect(c.postprocess?.platform_normalize).toEqual({ '비아토르': 'viator' })

    // Compiles via the same path the funnel uses.
    const re = tryCompile(c.template_pattern)
    expect(re).not.toBeNull()
  })

  it('skips a template missing {{NAME}}', () => {
    const cluster = {
      tenant_id: 't1',
      template_hash: 'abc',
      raw_line_template: '제주 크루즈 - 버스투어 / {{N}} 명 / {{EMAIL}}',
      cluster_size: 5,
    }
    const r = buildRuleFromCluster(cluster)
    expect(r.skip).toBeDefined()
    expect(r.skip!.reason).toBe('no_name_token')
  })

  it('detects cancellation rules', () => {
    const cluster = {
      tenant_id: 't1',
      template_hash: 'cxl',
      raw_line_template:
        '취소됨 !!!! 제주 크루즈 - 버스투어 / {{NAME}} ( 겟유가이드 - {{EXTID}} ) / / {{N}} 명',
      cluster_size: 5,
    }
    const r = buildRuleFromCluster(cluster)
    expect(r.candidate).toBeDefined()
    expect(r.candidate!.postprocess?.set_booking_status).toBe('cancelled')
    expect(r.candidate!.postprocess?.platform_normalize).toMatchObject({ '겟유가이드': 'gyg' })
  })
})
