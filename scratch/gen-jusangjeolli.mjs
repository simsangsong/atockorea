#!/usr/bin/env node
/**
 * daepo-jusangjeolli-cliff 비트 시트 생성기.
 *
 *   node scratch/gen-jusangjeolli.mjs
 *   (그 다음 반드시)  motioncut.mjs → validate.mjs
 *
 * 동선은 촬영 순서가 아니라 **손님이 걷는 순서**다. 소재 4개 중 04(=A, 10:38 촬영)가
 * 주차장→매표소→게이트 접근이고, 01(=B, 10:28)이 공원 안, 03(=C, 10:32)이 데크·주상절리
 * ·복귀·출구다. 즉 A 는 마지막에 찍혔지만 **영상에서는 맨 앞**이다.
 *
 * 🔴 v2 (2026-08-05) — 사장님 반려. v1 의 가위질 세 군데가 **전부 측정된 회전 안쪽**이었다.
 *   *"첫번째 계단에서 내려와서 왼쪽 둘러보는거랑 그 다음 오션뷰 둘러보는거 빨리감기 아니면
 *     건너뛰기 해버린거 같은데?? 그게 하이라이트인데 이상한 직진 영상은 그대로 두고"*
 *   *"입구 들어가기전 오른쪽 비췄을때 거기 화장실이 있잖아, 일부러 비춘건데 휙 지나가 버리네?"*
 *
 *   맞는 지적이다. v1 이 버린 것:
 *     - B 46.0→55.9  = 첫 계단 위에서 소나무 사이로 **바다 전경을 훑는 그 스윙**  → 복원
 *     - B 71.0→74.5  = 데크에서 **용암 바위·수평선 훑기**의 뒷부분           → 복원
 *     - A 33.8→43.4  = 오른쪽으로 돌아 **「→10m 화장실」 표지판**을 잡은 구간  → 복원 + 스톱 신설
 *     - C 48.3→52.5  = 먼 데크에서 바다를 훑는 구간을 **5.0배속**으로 밀어버렸다 → 1배속 복원
 *
 *   🔴 v1 이 왜 틀렸나: 게이트 3d 는 *빨리감기*가 회전을 덮는 것만 막는다. **삭제는 아무도
 *   안 본다.** 그리고 C 48–52 는 turns.mjs 가 "회전 없음"으로 준 구간이라 마음 놓고 5배속을
 *   깔았는데 — **카메라가 안 흔들린 이유가 볼 게 있어서 서 있었기 때문**이었다. 플랫런을
 *   페이싱 신호로 쓰지 말라는 §4 경고가 정확히 이것이다.
 *
 *   대신 진짜 지루한 데를 잘랐다: B 74.5→80.3(텅 빈 데크) · C 52.5→58.5(뒤통수만 있는
 *   전망대) · C 58.5→70.0 과 78.0→92.4(계단 복귀 = 순수 이동).
 *
 * 클레임 원천 = match_pois(daepo_jusangjeolli_cliff).content_locales.en
 * (천연기념물 443호 · 요금 · 운영시간·최종입장 · 5~7각 기둥) + 현장 표지판(화장실 →10m).
 * 지어낸 사실 없음.
 */
import fs from 'node:fs';

const SPEC = 'docs/video-specs/daepo-jusangjeolli-cliff.json';
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const beats = [];

/** 클립 비트. 화면 길이 = (out-in)/speed */
const clip = (id, src, inS, outS, o = {}) => {
  beats.push({ id, kind: 'clip', src, in: inS, out: outS, speed: o.speed ?? 1, ...o });
};
/** 정지 + 타이포(V6-D21). 뒤에 오는 같은 소스 클립은 반드시 at 에서 시작해야 한다(게이트 1a). */
const stop = (id, src, at, hold, o = {}) => {
  beats.push({ id, kind: 'arrow', src, at, hold, ...o });
};
const D = (s) => ({ kind: 'dissolve', seconds: s });

// ─── 콜드 오픈 ─────────────────────────────────────────────────────────────
clip('c1', 'C', 34.9, 38.0, {
  stab: true, mute: true, role: 'title',
  title: 'Lava that cooled into pillars',
  sub: 'Daepo Jusangjeolli — Jungmun, Jeju',
  chapter: 'Daepo Jusangjeolli Cliff',
});
clip('c2', 'E', 3.8, 6.3, { stab: true, mute: true, title: 'Cold open — the whole cliff', transition: D(0.5) });
clip('c3', 'B', 89.0, 91.4, { stab: true, mute: true, title: 'Cold open — the cove below', transition: D(0.5) });

// ─── A · 주차장 → 매표소 → 화장실 → 검표소 ────────────────────────────────
// v2 에서 A 는 0→59.6 이 **한 군데도 안 끊긴다**. 접근 구간은 길찾기 그 자체라
// 건너뛸 데가 없다 — 지루한 직진(상점가)은 삭제가 아니라 2.2배속으로 눌렀다.
clip('01', 'A', 0, 6.0, { stab: true, role: 'promise', title: 'Start at the car park', transition: D(0.8) });
clip('02', 'A', 6.0, 8.9, { stab: true, title: 'Walk toward the booth' });
clip('03', 'A', 8.9, 11.5, { stab: true, turn: true, title: 'The ticket office ahead' });
stop('04', 'A', 11.5, 5.8, {
  title: 'Buy Your Ticket Here',
  sub: 'Adults ₩2,000 · under 7 free',
  caption: 'Card and mobile pay only — the booth takes no cash.',
  chapter: 'Tickets',
});
clip('05', 'A', 11.5, 15.8, { stab: true, turn: true, title: 'Past the booth' });
// v1 은 16.9–20.8 회전을 통째로 잘랐다. 상점 줄을 훑는 시선이라 복원.
clip('06', 'A', 15.8, 20.8, { stab: true, turn: true, title: 'The stalls on your left' });
// 상점가 직진 — 여기가 눌러야 할 곳. v1 의 3.0x 는 진열대가 안 읽혀서 2.2x 로 완화.
clip('07', 'A', 20.8, 31.4, { speed: 2.2, title: 'Along the souvenir stalls', ramp: { seconds: 0.6 } });
clip('08', 'A', 31.4, 33.8, { stab: true, turn: true, title: 'Through the crowd' });
// 🔴 v1 이 33.8→43.4 을 잘라내면서 37.4–39.8 회전 = 사장님이 일부러 잡은 화장실 표지판이
// 통째로 사라졌다. 복원하고 스톱까지 세운다.
clip('09', 'A', 33.8, 39.4, { stab: true, turn: true, title: 'The camera swings right' });
// 39.4s = 회전(37.4–39.8) 피크 38.4 에서 1.0s 뒤. 표지판(→10m 화장실)과 분홍 선이
// 같이 들어오고 앞을 막는 사람이 없다. 스틸 5장 비교 후 선정.
// ⚠ 표지판 자체는 프레임에 있지만 폰에서는 작다. 그래서 카피는 **분명히 보이는 것**
// (분홍 선이 오른쪽으로 꺾이는 지점)에 걸었다 — 표지판의 「→10m」 와 방향이 일치한다.
// 화살표는 안 붙였다(V6-D21 유지). 방향은 문장이 답한다.
stop('10', 'A', 39.4, 5.8, {
  title: 'Toilets, Before The Gate',
  sub: 'Signposted to your right',
  caption: 'Ten metres right, where the pink line turns off.',
  chapter: 'Toilets',
});
clip('11', 'A', 39.4, 43.4, { stab: true, title: 'Back to the blue line' });
clip('12', 'A', 43.4, 49.0, { stab: true, turn: true, title: 'Up to the entrance gate' });
stop('13', 'A', 49.0, 5.8, {
  title: 'The Entrance Gate',
  sub: 'Open year-round, 09:00–18:00',
  caption: 'Last entry is 17:40. The deck loop starts inside.',
});
clip('14', 'A', 49.0, 51.0, { stab: true, turn: true, title: 'Tap in at the turnstile' });
clip('15', 'A', 51.0, 59.6, { speed: 2.4, title: 'Out the far side', ramp: { seconds: 0.6 } });

// ─── B · 공원 안 — 바위정원, 파란 선, 그리고 바다가 열린다 ─────────────────
clip('16', 'B', 0, 3.3, { stab: true, turn: true, title: 'Inside the park', transition: D(0.8) });
clip('17', 'B', 3.3, 8.9, { stab: true, title: 'The lava rock garden' });
clip('18', 'B', 8.9, 16.5, { stab: true, turn: true, title: 'Down the paved path' });
stop('19', 'B', 16.5, 5.6, {
  title: 'Follow The Blue Line',
  sub: 'Painted down the middle',
  caption: 'It runs from the gate all the way to the cliff decks.',
  chapter: 'The blue line',
});
clip('20', 'B', 16.5, 21.3, { stab: true, turn: true, title: 'Under the pines' });
// v1 은 26.0 에서 잘랐는데 28–31 이 소나무 사이로 바다가 처음 보이는 데다. 31.5 까지 복원.
clip('21', 'B', 21.3, 31.5, { stab: true, turn: true, title: 'The first sight of the sea' });
clip('22', 'B', 35.3, 39.9, { speed: 2.0, title: 'Along the coastal pines', ramp: { seconds: 0.6 }, transition: D(0.6) });
// 🔴 여기부터가 사장님이 지목한 하이라이트다. v1 은 46.0→55.9 을 잘라 스윙의 절반을 버렸다.
clip('23', 'B', 39.9, 48.0, { stab: true, turn: true, title: 'The sea opens up', chapter: 'Down to the sea' });
clip('24', 'B', 48.0, 55.9, { stab: true, turn: true, title: 'The whole coast, through the pines' });
clip('25', 'B', 55.9, 63.8, { stab: true, turn: true, title: 'Down the first steps' });
// v1 은 71.0 에서 끊었다 — 용암 바위를 훑는 스윙이 74.5 까지 이어진다. 연장.
clip('26', 'B', 63.8, 74.5, { stab: true, turn: true, title: 'Along the lava stacks' });
// 74.5→80.3 은 텅 빈 데크다. **이런 데가 잘라야 할 곳이다.**
clip('27', 'B', 80.3, 87.4, { speed: 2.2, title: 'Along the boardwalk', ramp: { seconds: 0.6 }, transition: D(0.6) });
clip('28', 'B', 87.4, 91.0, { stab: true, turn: true, title: 'Above the cove' });
stop('29', 'B', 91.0, 5.6, {
  title: 'The Cove Below',
  sub: 'Boulders, not sand',
  caption: 'Clear shallow water where the lava ran into the sea.',
});
clip('30', 'B', 91.0, 95.3, { stab: true, turn: true, title: 'Past the cove' });
clip('31', 'B', 95.3, 113.9, { speed: 5.0, title: 'On around the loop', ramp: { seconds: 0.6 } });
clip('32', 'B', 113.9, 116.3, { stab: true, turn: true, title: 'The deck turns inland' });

// ─── C · 절벽 데크와 주상절리 ──────────────────────────────────────────────
clip('33', 'C', 0, 3.4, { stab: true, title: 'Back out on the cliff', transition: D(0.8) });
clip('34', 'C', 3.4, 10.3, { stab: true, turn: true, title: 'The deck follows the rock' });
clip('35', 'C', 10.3, 29.4, { speed: 5.0, title: 'Out to the far deck', ramp: { seconds: 0.6 } });
clip('36', 'C', 29.4, 34.9, { stab: true, turn: true, title: 'And there they are', chapter: 'The columns' });
stop('37', 'C', 34.9, 6.4, {
  title: 'Jusangjeolli — The Columns',
  sub: 'Natural Monument No. 443',
  caption: 'Cooling lava contracted into five- and six-sided pillars.',
});
clip('38', 'C', 34.9, 41.0, { stab: true, title: 'Stand and look' });
// 🔴 v1 최악의 실수: 48.3–52.5 = 먼 데크에서 바다를 훑는 구간을 5.0배속에 실어 보냈다.
// turns.mjs 가 "회전 없음"이라 준 건 카메라가 **볼 게 있어서 멈춰 있었기** 때문이다.
clip('39', 'C', 43.4, 52.5, { stab: true, turn: true, title: 'The open sea from the far deck', transition: D(0.6) });
// 52.5→58.5 은 뒤통수만 있는 전망대. 잘라낸다. 58.5 부터가 순수 계단 복귀 = 눌러도 되는 곳.
clip('40', 'C', 58.5, 70.0, { speed: 4.5, title: 'Back up the steps', chapter: 'The way back', ramp: { seconds: 0.6 }, transition: D(0.6) });
clip('41', 'C', 78.0, 92.4, { speed: 4.0, title: 'Up through the pines', ramp: { seconds: 0.6 }, transition: D(0.6) });
clip('42', 'C', 92.4, 96.8, { stab: true, turn: true, title: 'The path climbs' });
clip('43', 'C', 101.8, 113.4, { speed: 3.4, title: 'Past the rock garden', ramp: { seconds: 0.6 }, transition: D(0.6) });
clip('44', 'C', 113.4, 115.8, { stab: true, turn: true, title: 'The last bend' });
clip('45', 'C', 115.8, 123.9, { speed: 2.6, title: 'Toward the exit', chapter: 'The way out', ramp: { seconds: 0.6 } });
clip('46', 'C', 128.0, 133.0, { stab: true, turn: true, title: 'The exit gate ahead', transition: D(0.6) });
stop('47', 'C', 133.0, 5.6, {
  title: 'The Way Out',
  sub: 'Turnstiles on the way out too',
  caption: 'Out through the gate, then back past the shops.',
});
clip('48', 'C', 133.0, 140.3, { stab: true, turn: true, title: 'Out through the turnstile' });
clip('49', 'C', 143.8, 151.9, { speed: 2.6, title: 'Back to the plaza', ramp: { seconds: 0.6 }, transition: D(0.6) });
clip('50', 'C', 151.9, 157.3, { stab: true, turn: true, title: 'Where you came in', chapter: 'Where you came in' });
clip('51', 'D', 5.0, 8.0, {
  stab: true, mute: true, role: 'recap', title: 'The cliff you just walked', transition: D(0.8),
});

spec.beats = beats;
fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n');
console.log(`${beats.length} beats → ${SPEC}`);
