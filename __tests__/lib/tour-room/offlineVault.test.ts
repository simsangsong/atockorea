/**
 * @jest-environment node
 *
 * J3 — encrypted offline vault: AES-GCM roundtrip, wrong-session refusal,
 * tamper detection. (docs/join-tour-ticketless-rich-itinerary-master-plan-2026-07-22.md §B-3)
 */
import { webcrypto } from 'crypto';
import { decryptJson, encryptJson } from '@/lib/tour-room/offlineVault';

beforeAll(() => {
  // Node's WebCrypto stands in for the browser implementation.
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const SESSION = 'room-session-token-abc123';
const BOOKING = 'booking-1';
const PAYLOAD = {
  meeting: '15:40 @ the vehicle',
  stops: ['10:00 성산일출봉', '13:00 우도'],
  guidance: '성산일출봉 근처에 도착했어요.\n집합 시간은 15:40입니다.\n이곳 입장권은 성인 1인 ₩5,000이에요.',
  savedAt: 1234567890,
};

describe('offline vault crypto', () => {
  it('roundtrips a payload with the same session', async () => {
    const cipher = await encryptJson(SESSION, BOOKING, PAYLOAD);
    expect(cipher).not.toBeNull();
    const back = await decryptJson<typeof PAYLOAD>(SESSION, BOOKING, cipher!);
    expect(back).toEqual(PAYLOAD);
  });

  it('the ciphertext does not contain the plaintext (content protection)', async () => {
    const cipher = await encryptJson(SESSION, BOOKING, PAYLOAD);
    const asText = Buffer.from(cipher!.data).toString('utf8');
    expect(asText).not.toContain('성산일출봉');
    expect(asText).not.toContain('5,000');
  });

  it('a WRONG session cannot decrypt (competitor with the cache file)', async () => {
    const cipher = await encryptJson(SESSION, BOOKING, PAYLOAD);
    expect(await decryptJson('stolen-or-guessed-session', BOOKING, cipher!)).toBeNull();
  });

  it('a different booking id (HKDF info) cannot decrypt', async () => {
    const cipher = await encryptJson(SESSION, BOOKING, PAYLOAD);
    expect(await decryptJson(SESSION, 'booking-2', cipher!)).toBeNull();
  });

  it('tampered ciphertext fails closed (GCM auth)', async () => {
    const cipher = await encryptJson(SESSION, BOOKING, PAYLOAD);
    cipher!.data[0] ^= 0xff;
    expect(await decryptJson(SESSION, BOOKING, cipher!)).toBeNull();
  });

  it('missing/garbage cipher and empty session degrade to null', async () => {
    expect(await decryptJson(SESSION, BOOKING, null)).toBeNull();
    expect(await decryptJson(SESSION, BOOKING, { iv: new Uint8Array(0), data: new Uint8Array(0) })).toBeNull();
    expect(await encryptJson('', BOOKING, PAYLOAD)).toBeNull();
  });
});
