/**
 * 가이드 PII 애플리케이션 레벨 암호화 — AtoC 통합 플랜 §6.9.
 *
 * kursoflow의 검증된 구현(`src/lib/crypto/guide-pii.ts`)을 포팅한 것이다. 봉투
 * 포맷·키 파생·마스킹 규칙을 그대로 유지한다 — 두 시스템이 같은 데이터를 같은
 * 형태로 다뤄야 나중에 이관·대조가 가능하다. 바뀐 것은 env 키 이름(ops_* 슬라이스
 * 컨벤션에 맞춰 OPS_GUIDE_PII_ENC_KEY, kursoflow 이름은 폴백으로 수용)뿐이다.
 *
 * 봉투 포맷 (전부 base64, 점 구분):  v1.<iv>.<authTag>.<ciphertext>
 *
 * 개인정보보호법 §24-2 ③은 주민등록번호를 암호화해 보관하도록 요구한다. 이 파일이
 * 그 이행 수단이고, DB에는 봉투만 들어간다(마이그레이션의 CHECK가 평문 유입을 한 번
 * 더 막는다). 복호화는 admin 인증된 서버 코드에서만 — reveal 라우트와 (다음
 * 슬라이스의) 세무 서식 생성기.
 *
 * `server-only`: 이 모듈이 클라이언트 번들에 들어가는 순간 키 파생 코드가 브라우저로
 * 새어 나간다. 빌드가 깨지는 편이 낫다.
 */

import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/**
 * 키 env 이름. primary는 ops_* 슬라이스 컨벤션을 따르고, kursoflow에서 값을 그대로
 * 옮겨오는 경우를 위해 그쪽 이름도 폴백으로 읽는다(둘 다 있으면 primary 우선).
 */
export const GUIDE_PII_KEY_ENV = 'OPS_GUIDE_PII_ENC_KEY';
export const GUIDE_PII_KEY_ENV_FALLBACK = 'GUIDE_PII_ENC_KEY';

/** 키가 없을 때 던지는 에러 — 라우트가 이걸 잡아 400 pii_key_missing으로 바꾼다. */
export class GuidePiiKeyMissingError extends Error {
  readonly code = 'pii_key_missing';

  constructor() {
    super(
      `${GUIDE_PII_KEY_ENV} is not set — 주민번호·계좌는 암호화 없이 저장할 수 없습니다`,
    );
    this.name = 'GuidePiiKeyMissingError';
  }
}

function rawKey(): string | null {
  const primary = process.env[GUIDE_PII_KEY_ENV]?.trim();
  if (primary) return primary;
  const fallback = process.env[GUIDE_PII_KEY_ENV_FALLBACK]?.trim();
  return fallback || null;
}

/**
 * 키는 아무 문자열이나 받아 SHA-256으로 32바이트를 파생한다 — 운영자가 패스프레이즈든
 * base64든 hex든 쓸 수 있게. (kursoflow와 동일해야 봉투 호환이 유지된다.)
 */
function getKey(): Buffer {
  const raw = rawKey();
  if (!raw) throw new GuidePiiKeyMissingError();
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** 서버가 민감 필드를 다룰 수 있게 설정되어 있는가 (fail-closed 판정용). */
export function piiEncryptionAvailable(): boolean {
  return rawKey() !== null;
}

/** 평문 → 봉투. 빈 값/공백은 null (저장 안 함). */
export function encryptGuidePii(plain: string | null | undefined): string | null {
  const value = plain?.trim();
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

/**
 * 봉투 → 평문. null/빈 값은 null. 포맷이 깨졌거나 변조된 봉투는 throw한다
 * (GCM 인증 실패) — 조용히 쓰레기를 돌려주면 세무 서식에 그대로 실린다.
 */
export function decryptGuidePii(envelope: string | null | undefined): string | null {
  const value = envelope?.trim();
  if (!value) return null;
  const [version, ivB64, tagB64, dataB64] = value.split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed guide PII ciphertext envelope');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * 주민등록번호 표시용 마스크: 생년월일 6자리 + 성별 1자리만 남기고 가린다.
 * 예) 900101-1****** . 비표준 입력은 앞 6자만. 빈 입력은 null.
 */
export function maskResidentNumber(plain: string | null | undefined): string | null {
  const value = plain?.replace(/\s/g, '');
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length >= 7) {
    return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
  }
  return `${value.slice(0, 6)}…`;
}

/** 계좌번호 표시용 마스크 — 뒤 4자리만 남긴다. */
export function maskBankAccount(plain: string | null | undefined): string | null {
  const value = plain?.trim();
  if (!value) return null;
  const tail = value.replace(/[^0-9]/g, '').slice(-4);
  return tail ? `••••${tail}` : '••••';
}
