/**
 * @jest-environment node
 *
 * 가이드 PII 암호화 — kursoflow `src/lib/crypto/__tests__/guide-pii.test.ts`의
 * 테스트 벡터를 그대로 가져왔다(vitest → jest 변환만). 봉투 포맷·마스킹 결과가
 * 두 시스템에서 동일해야 나중에 데이터를 서로 읽을 수 있다.
 *
 * 추가한 것: 키가 없을 때 encrypt/decrypt가 던지는지 (§6.9 fail-closed 결정 1) —
 * kursoflow에는 없던 검사인데, 여기서는 "키 없으면 저장 거부"가 바인딩 결정이라
 * 회귀 방지 가치가 크다.
 */

import * as pii from '@/lib/ops/guides/pii';

const KEY_ENV = 'OPS_GUIDE_PII_ENC_KEY';
const FALLBACK_ENV = 'GUIDE_PII_ENC_KEY';

/** 모듈은 키를 호출 시점에 읽는다(캐시하지 않는다) — 그래서 env를 바꾼 뒤
 *  다시 import할 필요 없이 같은 모듈을 계속 쓰면 된다. */
function loadModule() {
  return pii;
}

describe('guide PII encryption', () => {
  const PREV = process.env[KEY_ENV];
  const PREV_FALLBACK = process.env[FALLBACK_ENV];

  beforeEach(() => {
    process.env[KEY_ENV] = 'test-secret-passphrase-123';
    delete process.env[FALLBACK_ENV];
  });

  afterAll(() => {
    if (PREV === undefined) delete process.env[KEY_ENV];
    else process.env[KEY_ENV] = PREV;
    if (PREV_FALLBACK === undefined) delete process.env[FALLBACK_ENV];
    else process.env[FALLBACK_ENV] = PREV_FALLBACK;
  });

  it('round-trips a value through the v1 envelope', () => {
    const { encryptGuidePii, decryptGuidePii } = loadModule();
    const env = encryptGuidePii('900101-1234567');
    expect(env).toMatch(/^v1\./);
    expect(env).not.toContain('900101'); // ciphertext, not cleartext
    expect(decryptGuidePii(env)).toBe('900101-1234567');
  });

  it('produces the four-part envelope the DB CHECK expects', () => {
    const { encryptGuidePii } = loadModule();
    const env = encryptGuidePii('110-1234-5678')!;
    expect(env.split('.')).toHaveLength(4);
    // 마이그레이션의 CHECK 정규식과 같은 형태여야 INSERT가 통과한다.
    expect(env).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  });

  it('treats empty/blank as null on both directions', () => {
    const { encryptGuidePii, decryptGuidePii } = loadModule();
    expect(encryptGuidePii('')).toBeNull();
    expect(encryptGuidePii('   ')).toBeNull();
    expect(encryptGuidePii(null)).toBeNull();
    expect(decryptGuidePii(null)).toBeNull();
    expect(decryptGuidePii('')).toBeNull();
  });

  it('produces a different envelope each time (random IV)', () => {
    const { encryptGuidePii } = loadModule();
    expect(encryptGuidePii('110-1234-5678')).not.toBe(encryptGuidePii('110-1234-5678'));
  });

  it('rejects a tampered ciphertext (GCM auth)', () => {
    const { encryptGuidePii, decryptGuidePii } = loadModule();
    const env = encryptGuidePii('123456')!;
    const parts = env.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptGuidePii(parts.join('.'))).toThrow();
  });

  it('rejects a malformed envelope', () => {
    const { decryptGuidePii } = loadModule();
    expect(() => decryptGuidePii('not-an-envelope')).toThrow(/Malformed/);
    expect(() => decryptGuidePii('v2.a.b.c')).toThrow(/Malformed/);
  });

  it('cannot be decrypted with a different key', () => {
    const { encryptGuidePii } = loadModule();
    const env = encryptGuidePii('900101-1234567')!;
    process.env[KEY_ENV] = 'a-completely-different-key';
    const { decryptGuidePii } = loadModule();
    expect(() => decryptGuidePii(env)).toThrow();
  });

  it('reports availability from the env var', () => {
    expect(loadModule().piiEncryptionAvailable()).toBe(true);
  });

  it('accepts the kursoflow env name as a fallback', () => {
    delete process.env[KEY_ENV];
    process.env[FALLBACK_ENV] = 'ported-from-kursoflow';
    const mod = loadModule();
    expect(mod.piiEncryptionAvailable()).toBe(true);
    expect(mod.decryptGuidePii(mod.encryptGuidePii('123-456'))).toBe('123-456');
  });

  // 바인딩 결정 1 — 키가 없으면 평문 저장이 아니라 거부다.
  it('throws instead of storing plaintext when no key is configured', () => {
    delete process.env[KEY_ENV];
    delete process.env[FALLBACK_ENV];
    const { encryptGuidePii, decryptGuidePii, piiEncryptionAvailable, GuidePiiKeyMissingError } = loadModule();
    expect(piiEncryptionAvailable()).toBe(false);
    expect(() => encryptGuidePii('900101-1234567')).toThrow(GuidePiiKeyMissingError);
    expect(() => decryptGuidePii('v1.a.b.c')).toThrow(GuidePiiKeyMissingError);
    // 빈 값은 키가 없어도 조용히 null (저장할 게 없으니 거부할 것도 없다).
    expect(encryptGuidePii('')).toBeNull();
  });
});

describe('guide PII masking', () => {
  it('masks a resident number to birthdate + gender digit', () => {
    const { maskResidentNumber } = loadModule();
    expect(maskResidentNumber('900101-1234567')).toBe('900101-1******');
    expect(maskResidentNumber('9001011234567')).toBe('900101-1******');
  });

  it('masks a bank account to the last 4 digits', () => {
    const { maskBankAccount } = loadModule();
    expect(maskBankAccount('123456-78-901234')).toBe('••••1234');
    expect(maskBankAccount('110 123 456789')).toBe('••••6789');
  });

  it('never leaks the tail of a resident number', () => {
    const { maskResidentNumber } = loadModule();
    expect(maskResidentNumber('900101-1234567')).not.toContain('234567');
  });

  it('returns null for empty input', () => {
    const { maskResidentNumber, maskBankAccount } = loadModule();
    expect(maskResidentNumber('')).toBeNull();
    expect(maskBankAccount(null)).toBeNull();
  });

  it('masks without needing an encryption key (display-only path)', () => {
    const PREV = process.env[KEY_ENV];
    delete process.env[KEY_ENV];
    const { maskResidentNumber } = loadModule();
    expect(maskResidentNumber('900101-1234567')).toBe('900101-1******');
    if (PREV !== undefined) process.env[KEY_ENV] = PREV;
  });
});
