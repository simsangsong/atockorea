/**
 * V0.3 회귀 하니스 — 구동 중인 서버에 대고 두 TTS 경로의 "첫 오디오 바이트까지"를 잰다.
 *
 *   PORT=3170 npm run dev            ← 먼저 (dev 스크립트는 --webpack 이다)
 *   npx tsx scripts/qa-tts-latency.ts <baseUrl> <bookingId> <tourDate> <streamMsg> <jsonMsg>
 *
 * `scripts/qa-voice-latency.mjs` 가 **원시 구간**(OpenAI 왕복)을 잰다면 이쪽은
 * **라우트를 통과한 실제 체감**을 잰다. 둘 다 필요하다 — 원시 구간만 보면
 * JSON 경로의 두 번째 왕복(CDN 826~978ms)을 통째로 놓친다. 실제로 그 누락 때문에
 * V0.3 기대값을 -1.0초로 과소평가했고, 실측은 -1.5초였다.
 *
 * 계약 함정 (다시 헤매지 말 것):
 *   · 어드민 링크 발급(`/api/admin/tour-ops/links`)은 `requireAdmin` = **로그인 세션**이
 *     필요하다. `ADMIN_SUPPORT_API_TOKEN` Bearer 는 403 이다. 그래서 여기서는
 *     `signCustomerRoomToken` 으로 직접 서명한다(로컬은 dev 폴백 시크릿이라 자기완결).
 *   · 토큰 만료는 **투어일 종료 + 유예**다 — `tourDate` 가 과거면 join 이 죽는다.
 *   · 세션은 join 응답의 `x-tour-room-auth` 헤더로 온다.
 *   · `<audio>` 는 헤더를 못 실으므로 스트리밍 경로는 `rs` 쿼리 인증을 쓴다.
 *
 * 🔴 측정마다 **미캐시 메시지 2건**이 필요하다. 한쪽이 생성하면 캐시가 데워져
 * 다른 쪽 측정이 오염된다. 같은 메시지로 두 번 재면 두 번째는 302 캐시 히트다.
 * 미캐시 메시지 찾기:
 *   select m.id from tour_room_messages m
 *   where coalesce(m.source_text,'') <> ''
 *     and not exists (select 1 from tour_room_tts_cache c
 *                      where c.message_id = m.id and c.locale = 'ko');
 *
 * ⚠ 부작용: 캐시 미스 경로를 재므로 `tour_room_tts_cache` 행과 tour-audio 객체가
 * 남는다. 앱이 정상 사용 중 만드는 것과 동일한 행이라 해롭지 않고, 다음 청취자에게
 * 이득이다. 지우고 싶으면 위 두 곳에서 해당 message_id 를 제거하면 된다.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { signCustomerRoomToken } from '@/lib/tour-room/token';

const [BASE, BOOKING, TOUR_DATE, STREAM_MSG, JSON_MSG] = process.argv.slice(2);

for (const line of readFileSync('C:/Users/sangsong/atockorea/.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function join(token: string): Promise<string> {
  const res = await fetch(`${BASE}/api/tour-rooms/${BOOKING}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceKey: randomUUID(), token, locale: 'ko', ttsCapable: false }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`join ${res.status}: ${text.slice(0, 400)}`);
  const header = res.headers.get('x-tour-room-auth');
  if (header) return header;
  const body = JSON.parse(text);
  const session = body.session ?? body.roomSession ?? body.sessionToken ?? body.auth;
  if (!session) throw new Error(`session not found. keys=${Object.keys(body).join(',')}`);
  return session;
}

interface Timing { kind: string; [k: string]: unknown }

async function timeStream(url: string): Promise<Timing> {
  const t0 = performance.now();
  const res = await fetch(url, { redirect: 'manual' });
  const headerMs = performance.now() - t0;
  if (res.status === 302 || res.status === 307) {
    const t1 = performance.now();
    const cdn = await fetch(res.headers.get('location')!);
    const r = cdn.body!.getReader();
    await r.read();
    const cdnTtfb = performance.now() - t1;
    await r.cancel();
    return { kind: 'redirect(cache hit)', headerMs, cdnTtfb, total: headerMs + cdnTtfb };
  }
  if (!res.ok) return { kind: 'error', status: res.status, body: (await res.text()).slice(0, 300) };
  const reader = res.body!.getReader();
  let ttfb = 0;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!ttfb) ttfb = performance.now() - t0;
    bytes += value?.length ?? 0;
  }
  return { kind: 'stream', headerMs, ttfb, total: performance.now() - t0, bytes };
}

async function timeJsonPath(url: string, session: string): Promise<Timing> {
  const t0 = performance.now();
  const res = await fetch(url, { headers: { 'x-tour-room-auth': session } });
  if (!res.ok) return { kind: 'error', status: res.status, body: (await res.text()).slice(0, 300) };
  const { url: mp3 } = (await res.json()) as { url: string };
  const jsonMs = performance.now() - t0;
  const t1 = performance.now();
  const cdn = await fetch(mp3);
  const reader = cdn.body!.getReader();
  await reader.read();
  const cdnTtfb = performance.now() - t1;
  await reader.cancel();
  return { kind: 'json', jsonMs, cdnTtfb, total: jsonMs + cdnTtfb };
}

const round = (o: Timing): string =>
  JSON.stringify(
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])),
  );

async function main(): Promise<void> {
  const { token } = signCustomerRoomToken({ bookingId: BOOKING, displayName: 'QA Probe', tourDate: TOUR_DATE });
  const session = await join(token);
  console.log(`세션 확보 · booking=${BOOKING} · tourDate=${TOUR_DATE}\n`);

  console.log('── 스트리밍 경로 (cold) ──');
  const s = await timeStream(
    `${BASE}/api/tour-rooms/${BOOKING}/tts/stream?messageId=${STREAM_MSG}&locale=ko&rs=${encodeURIComponent(session)}`,
  );
  console.log('  ' + round(s));

  console.log('\n── JSON 경로 (cold, 다른 메시지) ──');
  const j = await timeJsonPath(`${BASE}/api/tour-rooms/${BOOKING}/tts?messageId=${JSON_MSG}&locale=ko`, session);
  console.log('  ' + round(j));

  console.log('\n── 스트리밍 경로 (warm 재요청 → 302 기대) ──');
  await new Promise((r) => setTimeout(r, 2500)); // after() 의 캐시 적재를 기다린다
  const w = await timeStream(
    `${BASE}/api/tour-rooms/${BOOKING}/tts/stream?messageId=${STREAM_MSG}&locale=ko&rs=${encodeURIComponent(session)}`,
  );
  console.log('  ' + round(w));

  console.log('\n════ 요약 ════');
  if (s.kind === 'stream' && j.kind === 'json') {
    const saved = (j.total as number) - (s.ttfb as number);
    console.log(`첫 오디오 바이트: 스트리밍 ${Math.round(s.ttfb as number)}ms  vs  JSON경로 ${Math.round(j.total as number)}ms`);
    console.log(`  JSON 내역 = 라우트 ${Math.round(j.jsonMs as number)}ms + CDN 첫바이트 ${Math.round(j.cdnTtfb as number)}ms`);
    console.log(`  → ${Math.round(saved)}ms 절감 (${Math.round((saved / (j.total as number)) * 100)}%)`);
  }
  console.log(`캐시 적재 확인: ${w.kind}`);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
