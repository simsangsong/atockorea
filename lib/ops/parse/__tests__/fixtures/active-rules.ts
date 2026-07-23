// Phase 27 / Sprint 27.F — shared active-rules fixture.
// Extracted from bulk-jeju-coverage.test.ts so the CI corpus test and the
// local PII coverage test assert against ONE source of truth (the 12 active
// rules in prod, backfilled + governed by 27.E migration parse_rule_governance).
import type { ActiveRule } from '../../rules'

export const SIX_REMAINING_ACTIVE_RULES: ActiveRule[] = [
  {
    id: '74ee1941-af0d-4714-9e93-706be4d1a46c',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}} / {{NAME}} \\( 겟유가이드 - {{EXTID}} \\) / / {{N}} 명 / / / {{EMAIL}} / {{PHONE}} / .*({{SHIP}}|Norwegian Spirit|NCL Spirit|Diamond Princess).*',
    slot_map: { product: 0, name: 1, external_booking_id: 2, party_size: 3, email: 4, phone: 5, ship_inferred: 6 },
    postprocess: { ship_to_port: { 'NCL Spirit': 'north', 'Norwegian Spirit': 'north', 'Diamond Princess': 'south' }, default_port: 'north' },
    source: 'imported',
    match_count: 20,
    success_count: 20,
  },
  {
    id: 'c203cdce-cf1f-4e8b-98da-15243c953fd5',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}} / {{NAME}} \\( 비아토르 - {{EXTID}} \\) / {{LANG}}? / {{N}} 명 /.*/ {{PHONE}} / 크루즈선: {{SHIP}} 하선 시간: {{TIME}}.*하차 위치: {{LOCATION}}',
    slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, party_size: 4, phone: 5, cruise_ship: 6, dock_time: 7, pickup_location: 8 },
    postprocess: { platform_normalize: { '비아토르': 'viator' }, cruise_ship_normalize: { 'Norwegian Spirit': 'NCL Spirit', 'Norwegian Cruise Line (Spirit)': 'NCL Spirit' } },
    source: 'imported',
    match_count: 5,
    success_count: 5,
  },
  {
    id: '198a539a-d885-46f0-8e3a-f97b9c9c54fb',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}} / {{NAME}} \\( 클룩 - {{EXTID}} \\) /.*Departure location: {{LOCATION}}.*Flight number: {{SHIP}}.*Pick-up time: {{TIME}}',
    slot_map: { product: 0, name: 1, external_booking_id: 2, pickup_location: 3, ship: 4, pickup_time: 5 },
    postprocess: { explicit_pickup_wins: true },
    source: 'imported',
    match_count: 5,
    success_count: 5,
  },
  {
    id: '0968247f-1455-4068-b66e-a73cf9dfbe47',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}} / {{NAME}} \\( 비아토르 - {{EXTID}} \\) / {{LANG}} / {{N}} 대 / 만남의 장소: {{LOCATION}}.*도착 정보:.*크루즈선: {{SHIP}}.*하선 시간: {{TIME}}.*하차 위치: {{LOCATION}}.*출발 정보:.*픽업 위치: {{LOCATION}}.*탑승 시간: {{TIME}}.*출발일: {{DATE_FREE}}',
    slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, vehicle_capacity: 4, meet_loc: 5, ship: 6, dock_time: 7, dropoff_loc: 8, pickup_loc: 9, pickup_time: 10, depart_date: 11 },
    postprocess: { dual_port_capture: 'arrive+depart_can_differ', platform_normalize: { '비아토르': 'viator' } },
    source: 'imported',
    match_count: 4,
    success_count: 4,
  },
  {
    id: '65091af8-3dbd-4ca1-bee9-95d27b94cbb4',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}} / {{NAME}} \\( 겟유가이드 - {{EXTID}} \\) / {{LANG}} / {{N}} 명 / / / {{EMAIL}} / {{PHONE}} / {{PHONE}}.*',
    slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, party_size: 4, email: 5, phone: 6 },
    postprocess: { proxy_email_flag: 'reply.getyourguide.com', platform_normalize: { '겟유가이드': 'gyg' } },
    source: 'imported',
    match_count: 4,
    success_count: 4,
  },
  {
    id: 'c8e1b906-e9a2-4875-8fca-0d7ff6bfc2ff',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '^취소됨\\s*!+\\s*{{PRODUCT}} / {{NAME}} .*',
    slot_map: { product: 0, name: 1 },
    postprocess: { set_booking_status: 'cancelled' },
    source: 'imported',
    match_count: 2,
    success_count: 2,
  },
  // ── 2026-05-19 — new slash-cruise rules (production-inserted) ────────────
  {
    id: '7f24bfc7-5bf5-465d-b241-a51a7912b107',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    // Phase 26 §44.5 — appended ` / {{LOCATION_OPT}} /` to capture the pickup
    // field after "{{N}} 명". The literal ([^/]*?) language group is replaced
    // by {{LANG_OPT}} (same shape, convention-compliant).
    template_pattern: '{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*\\(\\s*[^-)]+?\\s*-\\s*{{EXTID}}\\s*\\)\\s*/\\s*{{LANG_OPT}}\\s*/\\s*[^/]*?{{N}}\\s*명(?:\\s*/\\s*{{LOCATION_OPT}}\\s*/)?',
    slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, party_size: 4, pickup_location: 5 },
    postprocess: null,
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
  {
    id: 'e2383ac1-f3a2-443a-afd6-02e5dd461bd6',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern: '{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*\\(\\s*[^-)]+?\\s*-\\s*{{EXTID}}\\s*\\)\\s*/\\s*{{LANG_OPT}}\\s*/\\s*[^/]*?{{N}}\\s*대(?:\\s*/\\s*{{LOCATION_OPT}}\\s*/)?',
    slot_map: { product: 0, name: 1, external_booking_id: 2, language: 3, vehicle_capacity: 4, pickup_location: 5 },
    postprocess: null,
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
  // ── 2026-05-20 — v3 KakaoTalk-export-derived rules (production-inserted) ────
  // Convention-compliant: no literal (...) capture groups in template_pattern,
  // only {{TOKEN}} captures + (?:...) non-capturing groups.
  {
    id: '489b7039-1501-40b5-a308-43999c14bb2f',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern:
      '(?:동쪽|남쪽|서남쪽|북쪽|동남쪽|서북쪽|동북쪽|제주항|강정항|부산항|인천항)(?:-(?:일반|프라이빗))?\\s*/\\s*{{NAME}}\\s*/\\s*(?:{{LANG_OPT}}\\s*/\\s*)?[^/]*?{{N}}\\s*명',
    slot_map: { name: 0, language: 1, party_size: 2 },
    postprocess: null,
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
  {
    id: '9a0530d3-2c36-4e76-b0e1-de41b7cd487e',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern:
      '{{PRODUCT}}\\s*/\\s*{{DATE}}\\s*/\\s*{{NAME}}\\s*/\\s*{{EXTID}}\\s*/\\s*{{PRODUCT}}\\s*/\\s*Adult\\s+[xX×]\\s*{{N}}',
    slot_map: { product: 0, tour_date: 1, name: 2, external_booking_id: 3, product_detail: 4, party_size: 5 },
    postprocess: null,
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
  {
    id: '7f03457e-b86d-4f9c-ae95-2e0137c93269',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern:
      '{{DATE}}\\s*/\\s*{{PRODUCT}}\\s*/\\s*{{NAME}}\\s*/\\s*{{PLATFORM}}\\s+{{EXTID}}\\s*/\\s*.*?{{N}}\\s*명',
    slot_map: { tour_date: 0, product: 1, name: 2, platform: 3, external_booking_id: 4, party_size: 5 },
    postprocess: { platform_normalize: { '비아토르': 'viator', '클룩': 'klook', '겟유가이드': 'gyg', 'kkday': 'kkday' } },
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
  // ── 2026-05-20 — v4 rule: same as 7f03457e but WITHOUT a leading date.
  // Catches operator's "PRODUCT / NAME / PLATFORM EXTID / ... / N명" rows where
  // platform-EXTID is space-separated (no parens) — common in 6/26+ pastes.
  // NAME uses NAME_NOPAREN (forbids `(`) to prevent collision with 7f24bfc7.
  {
    id: 'ebdfc0c1-6247-4621-864c-4409c072aa4e',
    tenant_id: '71a4560e-29f6-4b25-9722-8b8f284f6e1d',
    scope: 'tenant',
    template_pattern:
      '{{PRODUCT}}\\s*/\\s*{{NAME_NOPAREN}}\\s*/\\s*{{PLATFORM}}\\s+{{EXTID}}\\s*/\\s*.*?{{N}}\\s*명',
    slot_map: { product: 0, name: 1, platform: 2, external_booking_id: 3, party_size: 4 },
    postprocess: { platform_normalize: { '비아토르': 'viator', '클룩': 'klook', '겟유가이드': 'gyg', 'kkday': 'kkday', 'Kkday': 'kkday' } },
    source: 'manual',
    match_count: 0,
    success_count: 0,
  },
]
