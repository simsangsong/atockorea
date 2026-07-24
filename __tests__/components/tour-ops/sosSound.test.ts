/**
 * @jest-environment jsdom
 *
 * A2.3 — the SOS alarm must keep working on a busy day.
 *
 * 🔴 playSosSound() used to create a NEW AudioContext per SOS. Browsers cap
 *    concurrent AudioContexts (~6 in Chrome); after a handful of SOS events the
 *    constructor throws and — swallowed by the best-effort catch — every later
 *    SOS is silent for the rest of the session. On an ops console whose job is
 *    to alert on SOS, that is the worst possible time to go quiet.
 */

let created = 0;
let resumed = 0;

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  constructor() {
    created += 1;
  }
  resume() {
    resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: () => ({ connect: () => undefined }),
      start: () => undefined,
      stop: () => undefined,
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => ({ connect: () => undefined }),
    };
  }
}

/** Fresh module (fresh singleton) per test so the shared context can't leak state. */
async function freshPlaySosSound() {
  jest.resetModules();
  created = 0;
  resumed = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = FakeAudioContext;
  const mod = await import('@/components/tour-ops/opsShared');
  return mod.playSosSound;
}

it('🔴 reuses a single AudioContext across many SOS events (no per-SOS leak)', async () => {
  const playSosSound = await freshPlaySosSound();
  for (let i = 0; i < 12; i += 1) playSosSound();
  expect(created).toBe(1); // was 12 before the fix — and would throw after ~6 in a real browser
});

it('resumes a suspended context so the alarm can recover after a gesture', async () => {
  const playSosSound = await freshPlaySosSound();
  playSosSound();
  expect(resumed).toBeGreaterThanOrEqual(1);
});

it('never throws even if the Web Audio API is absent (sound is best-effort)', async () => {
  jest.resetModules();
  (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
  (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;
  const { playSosSound } = await import('@/components/tour-ops/opsShared');
  expect(() => playSosSound()).not.toThrow();
});
