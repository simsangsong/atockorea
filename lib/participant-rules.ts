/**
 * 아동 자격(儿童资格) 규칙 정의.
 * id는 저장용, label은 관리자 UI/상세페이지 표시용. params는 해당 규칙에서 사용하는 placeholder.
 */
export interface ChildEligibilityRuleDef {
  id: string;
  label: string;
  labelKo: string;
  params: ('num' | 'num1' | 'num2' | 'text')[];
}

export const CHILD_ELIGIBILITY_RULES: ChildEligibilityRuleDef[] = [
  { id: 'no_age_limit', label: 'This activity has no age limit', labelKo: '此活动无年龄限制', params: [] },
  { id: 'children_counted', label: 'Note: Infants and children will be counted as passengers', labelKo: '注意:婴幼儿和儿童将被计为乘客人数', params: [] },
  { id: 'min_age_participate', label: 'Must be {{num}} years old to {{text}}', labelKo: '须年满{{num}}岁方可 {{text}}', params: ['num', 'text'] },
  { id: 'free_0_3', label: 'Children 0-3 years old are free', labelKo: '0-3岁儿童免费', params: [] },
  { id: 'free_height_cm', label: 'Children {{num}} cm or under are free', labelKo: '身高{{num}}厘米及以下儿童免费', params: ['num'] },
  { id: 'free_0_3_no_seat', label: 'Children 0-3 years old are free without occupying a separate seat', labelKo: '0-3岁不单独占位的儿童免费', params: [] },
  { id: 'child_with_adult', label: 'Children {{num1}}-{{num2}} years old must be accompanied by a paying adult', labelKo: '{{num1}} - {{num2}}岁儿童须由付费成人陪同', params: ['num1', 'num2'] },
  { id: 'same_price_height', label: 'Children {{num}} cm or above are same price as adults', labelKo: '身高{{num}}厘米(含)以上的儿童与成人同价', params: ['num'] },
  { id: 'same_price_age', label: 'Children over {{num}} years old are same price as adults', labelKo: '{{num}}岁以上儿童与成人同价', params: ['num'] },
  { id: 'other', label: 'Other: {{text}}', labelKo: '{{text}}', params: ['text'] },
  { id: 'free_height_join', label: 'Children {{num}} cm or under can join for free {{text}}', labelKo: '身高{{num}}厘米(含)以下的儿童可免费{{text}}', params: ['num', 'text'] },
  { id: 'free_age_range_no_seat', label: 'Children {{num1}}-{{num2}} years can join for free {{text}}, but do not occupy a separate seat', labelKo: '{{num1}} - {{num2}}岁儿童可免费 {{text}},但不占单独座位', params: ['num1', 'num2', 'text'] },
  { id: 'free_age_range', label: 'Children {{num1}}-{{num2}} years can join for free {{text}}', labelKo: '{{num1}} - {{num2}}岁儿童可免费 {{text}}', params: ['num1', 'num2', 'text'] },
  { id: 'considered_child', label: 'Participants {{num1}}-{{num2}} years old are considered children (ID required)', labelKo: '{{num1}} - {{num2}}岁参与者将被视为儿童(以身份证件为准)', params: ['num1', 'num2'] },
  { id: 'considered_infant', label: 'Participants under {{num}} years old are considered infants (ID required)', labelKo: '{{num}} 岁以下参与者将被视为婴儿(以身份证件为准)', params: ['num'] },
];

export const CHILD_SEAT_OPTIONS: { value: string; label: string; labelKo: string }[] = [
  { value: 'none', label: 'No child seat provided', labelKo: '不提供儿童座椅' },
  { value: 'no_seat', label: 'No child seat', labelKo: '不提供儿童座椅' },
  { value: 'one_free_on_request', label: 'Child seat available upon request (1 free)', labelKo: '可应要求提供儿童座椅 (仅免费提供1个)' },
  { value: 'counted_as_passenger', label: 'If infant/child needs a seat, they are counted as a passenger', labelKo: '如婴儿或儿童需要儿童座椅,则将计入乘客人数' },
  { value: 'custom', label: 'Custom (age num1-num2 or height under num3 cm)', labelKo: '儿童座椅: num1 - num2 岁或身高低于num3厘米的儿童仅提供1个免费的儿童座椅' },
];

export const STROLLER_WHEELCHAIR_OPTIONS: { value: string; label: string; labelKo: string }[] = [
  { value: 'stroller_ok', label: 'This activity is suitable for stroller users', labelKo: '此活动适合婴儿车使用者' },
  { value: 'stroller_not', label: 'This activity is not suitable for stroller users', labelKo: '此活动不适合婴儿车使用者' },
  { value: 'wheelchair_ok', label: 'This activity is suitable for wheelchair users', labelKo: '此活动适合轮椅使用者' },
  { value: 'wheelchair_not', label: 'This activity is not suitable for wheelchair users', labelKo: '此活动不适合轮椅使用者' },
  { value: 'both_ok', label: 'Suitable for stroller and wheelchair users', labelKo: '此活动适合婴儿车和轮椅使用者' },
  { value: 'both_not', label: 'Not suitable for stroller or wheelchair users', labelKo: '此活动不适合婴儿车和轮椅使用者' },
];

/** Format a child eligibility rule for display (use label with placeholders replaced) */
export function formatChildEligibilityRule(
  rule: { id: string; num?: number; num1?: number; num2?: number; num3?: number; text?: string },
  locale: 'ko' | 'en' = 'en'
): string {
  const def = CHILD_ELIGIBILITY_RULES.find((r) => r.id === rule.id);
  if (!def) return rule.id;
  let text = locale === 'ko' ? def.labelKo : def.label;
  text = text.replace(/\{\{num\}\}/g, rule.num != null ? String(rule.num) : '—');
  text = text.replace(/\{\{num1\}\}/g, rule.num1 != null ? String(rule.num1) : '—');
  text = text.replace(/\{\{num2\}\}/g, rule.num2 != null ? String(rule.num2) : '—');
  text = text.replace(/\{\{num3\}\}/g, rule.num3 != null ? String(rule.num3) : '—');
  text = text.replace(/\{\{text\}\}/g, rule.text != null ? rule.text : '—');
  return text;
}
