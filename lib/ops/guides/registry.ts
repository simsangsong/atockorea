/**
 * 가이드 프로필 원장 헬퍼 — AtoC 통합 플랜 §6.9.
 *
 * 이 파일의 존재 이유는 딱 하나: **평문 PII가 응답에 실리는 경로를 구조적으로
 * 없애는 것**. 그래서
 *   · GUIDE_SELECT_COLUMNS 에 `*_enc` 컬럼이 아예 없다. 라우트가 select('*')를
 *     쓰지 않고 이 상수만 쓰면 봉투는 애초에 메모리에 올라오지도 않는다.
 *   · buildGuideWrite()가 저장 직전 유일한 관문이다. 평문을 받으면 봉투 + 마스크를
 *     동시에 만들고, 키가 없으면 GuidePiiKeyMissingError로 거부한다(fail-closed).
 *     나머지 필드(이름·언어·유형·활성)는 키가 없어도 저장된다 — 키 설정 전에도
 *     원장을 쓸 수 있어야 도입이 막히지 않는다.
 *
 * 복호화는 이 파일에 없다. reveal 라우트와 (다음 슬라이스의) 세무 서식 생성기가
 * pii.ts를 직접 부르고, 그때마다 ops_guide_pii_access_log에 1행이 남는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  encryptGuidePii,
  maskBankAccount,
  maskResidentNumber,
  piiEncryptionAvailable,
  GuidePiiKeyMissingError,
} from './pii';

export const GUIDES_TENANT_ID = 'atockorea';

/**
 * API가 돌려주는 컬럼 목록 — `rrn_enc` / `bank_account_enc` 부재가 이 상수의
 * 요점이다. 회귀 테스트가 이 문자열에 봉투 컬럼이 없음을 직접 검사한다.
 */
export const GUIDE_SELECT_COLUMNS =
  'id, name, phone, email, languages, guide_type, rrn_masked, bank_name, bank_holder, bank_account_masked, certified, active, note, created_at, updated_at';

export const GUIDE_TYPES = ['driver', 'bus_guide', 'both'] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

/** 응답에 나갈 수 있는 필드의 전부. 여기 없는 것은 나가지 않는다. */
const RESPONSE_FIELDS = [
  'id',
  'name',
  'phone',
  'email',
  'languages',
  'guide_type',
  'rrn_masked',
  'bank_name',
  'bank_holder',
  'bank_account_masked',
  'certified',
  'active',
  'note',
  'created_at',
  'updated_at',
] as const;

/**
 * 응답 직전 화이트리스트 투영 — 두 번째 방어선.
 *
 * GUIDE_SELECT_COLUMNS만으로도 봉투는 조회되지 않지만, 언젠가 누군가
 * `select('*')`를 쓰거나 조인으로 컬럼이 늘어나면 스프레드가 그대로 새어 나간다.
 * PII는 "규칙을 지키면 안전"보다 "어겨도 안전"이어야 해서 한 겹 더 둔다.
 */
export function toGuideResponse<T extends Record<string, unknown>>(row: T): GuideRow {
  const out: Record<string, unknown> = {};
  for (const key of RESPONSE_FIELDS) {
    if (key in row) out[key] = row[key];
  }
  return out as unknown as GuideRow;
}

export interface GuideRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  languages: string[] | null;
  guide_type: string | null;
  rrn_masked: string | null;
  bank_name: string | null;
  bank_holder: string | null;
  bank_account_masked: string | null;
  certified: boolean;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuideWriteInput {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  languages?: unknown;
  guideType?: unknown;
  /** 평문 주민등록번호. 저장되지 않는다 — 봉투 + 마스크로 변환된다. */
  residentNumber?: unknown;
  bankName?: unknown;
  bankHolder?: unknown;
  /** 평문 계좌번호. 저장되지 않는다 — 봉투 + 마스크로 변환된다. */
  bankAccount?: unknown;
  certified?: unknown;
  active?: unknown;
  note?: unknown;
}

export type GuideWriteError =
  | 'name_required'
  | 'guide_type_invalid'
  | 'languages_invalid'
  | 'pii_key_missing';

export type GuideWriteResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; code: GuideWriteError; message: string };

const MESSAGES: Record<GuideWriteError, string> = {
  name_required: '이름을 입력해 주세요.',
  guide_type_invalid: '유형은 기사·안내·겸업 중 하나여야 해요.',
  languages_invalid: '언어는 문자열 목록이어야 해요.',
  pii_key_missing:
    '암호화 키가 설정되지 않아 주민번호·계좌번호를 저장할 수 없어요. 서버에 OPS_GUIDE_PII_ENC_KEY를 설정한 뒤 다시 시도해 주세요. (나머지 정보는 지금도 저장할 수 있어요.)',
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** 명시적으로 지워달라는 뜻('')과 "안 건드림"(undefined)을 구분한다. */
function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function boolOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function normalizeLanguages(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!source) return null; // invalid marker
  const out: string[] = [];
  for (const item of source) {
    if (typeof item !== 'string') return null;
    const code = item.trim().toLowerCase();
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * 쓰기 필드 조립 — 평문 PII의 유일한 출구.
 *
 * `mode: 'create'`는 이름을 요구하고, `'update'`는 주어진 필드만 패치한다.
 * 주민번호/계좌를 빈 문자열로 보내면 봉투와 마스크를 함께 지운다(둘 중 하나만
 * 남는 상태는 DB CHECK가 막는다).
 */
export function buildGuideWrite(input: GuideWriteInput, mode: 'create' | 'update'): GuideWriteResult {
  const fields: Record<string, unknown> = {};

  const name = text(input.name);
  if (mode === 'create') {
    if (!name) return { ok: false, code: 'name_required', message: MESSAGES.name_required };
    fields.name = name;
  } else if (input.name !== undefined) {
    if (!name) return { ok: false, code: 'name_required', message: MESSAGES.name_required };
    fields.name = name;
  }

  const phone = nullableText(input.phone);
  if (phone !== undefined) fields.phone = phone;
  const email = nullableText(input.email);
  if (email !== undefined) fields.email = email;
  const bankName = nullableText(input.bankName);
  if (bankName !== undefined) fields.bank_name = bankName;
  const bankHolder = nullableText(input.bankHolder);
  if (bankHolder !== undefined) fields.bank_holder = bankHolder;
  const note = nullableText(input.note);
  if (note !== undefined) fields.note = note;

  if (input.guideType !== undefined) {
    const guideType = text(input.guideType);
    if (guideType && !(GUIDE_TYPES as readonly string[]).includes(guideType)) {
      return { ok: false, code: 'guide_type_invalid', message: MESSAGES.guide_type_invalid };
    }
    fields.guide_type = guideType;
  }

  const languages = normalizeLanguages(input.languages);
  if (languages === null) {
    return { ok: false, code: 'languages_invalid', message: MESSAGES.languages_invalid };
  }
  if (languages !== undefined) fields.languages = languages;

  const certified = boolOrUndefined(input.certified);
  if (certified !== undefined) fields.certified = certified;
  const active = boolOrUndefined(input.active);
  if (active !== undefined) fields.active = active;

  // ── 민감 필드: 여기부터가 fail-closed 구간 ────────────────────────────────
  const rrn = nullableText(input.residentNumber);
  const account = nullableText(input.bankAccount);
  const wantsEncryption = (rrn !== undefined && rrn !== null) || (account !== undefined && account !== null);
  if (wantsEncryption && !piiEncryptionAvailable()) {
    return { ok: false, code: 'pii_key_missing', message: MESSAGES.pii_key_missing };
  }

  try {
    if (rrn !== undefined) {
      fields.rrn_enc = rrn === null ? null : encryptGuidePii(rrn);
      fields.rrn_masked = rrn === null ? null : maskResidentNumber(rrn);
    }
    if (account !== undefined) {
      fields.bank_account_enc = account === null ? null : encryptGuidePii(account);
      fields.bank_account_masked = account === null ? null : maskBankAccount(account);
    }
  } catch (error) {
    if (error instanceof GuidePiiKeyMissingError) {
      return { ok: false, code: 'pii_key_missing', message: MESSAGES.pii_key_missing };
    }
    throw error;
  }

  if (mode === 'update') fields.updated_at = new Date().toISOString();
  return { ok: true, fields };
}

/** PII 원문 열람 감사로그 1행. 기입 실패는 호출부가 복호화를 포기하는 신호다. */
export async function logPiiAccess(
  supabase: SupabaseClient,
  entry: { guideId: string; field: 'rrn' | 'bank_account'; actor: string | null; purpose: string },
): Promise<boolean> {
  const { error } = await supabase.from('ops_guide_pii_access_log').insert({
    tenant_id: GUIDES_TENANT_ID,
    guide_id: entry.guideId,
    field: entry.field,
    actor: entry.actor,
    purpose: entry.purpose,
  });
  if (error) {
    console.error('[ops-guides] PII access log insert failed — reveal aborted:', error);
    return false;
  }
  return true;
}
