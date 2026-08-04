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
 * 페이싱: turns.mjs 측정이 지배한다. 이 촬영은 카메라가 해안 데크를 따라 계속 훑기
 * 때문에 회전 비중이 크다 — B 는 126s 중 68s, C 는 158s 중 약 50s 가 회전이다.
 * V6-D18 "회전이 곧 관람"이라 그 구간은 1배속이고, 빨리감기는 **측정된 직진 구간**에만
 * 넣었다. 늘어지는 곳은 속도가 아니라 가위로 줄이고 디졸브 0.6 으로 봉합했다.
 *
 * 클레임 원천 = match_pois(daepo_jusangjeolli_cliff).content_locales.en
 * (천연기념물 443호 · 요금 · 운영시간·최종입장 · 5~7각 기둥). 지어낸 사실 없음.
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

// ─── 콜드 오픈 ─────────────────────────────────────────────────────────────
// 히어로는 8/1 테이크의 기둥 정면(C@34.9). 34.8s 부터가 측정상 정지 구간이라
// 흔들리지 않는다(회전 29.4–34.8 바로 다음). 스틸로 확인함.
clip('c1', 'C', 34.9, 38.0, {
  stab: true, mute: true, role: 'title',
  title: 'Lava that cooled into pillars',
  sub: 'Daepo Jusangjeolli — Jungmun, Jeju',
  chapter: 'Daepo Jusangjeolli Cliff',
});
// 6/29 테이크. 같은 절벽을 더 넓게 잡았고 수평선에 산방산이 걸린다.
clip('c2', 'E', 3.8, 6.3, { stab: true, mute: true, title: 'Cold open — the whole cliff', transition: { kind: 'dissolve', seconds: 0.5 } });
clip('c3', 'B', 89.0, 91.4, { stab: true, mute: true, title: 'Cold open — the cove below', transition: { kind: 'dissolve', seconds: 0.5 } });

// ─── A · 주차장에서 매표소, 그리고 게이트 ──────────────────────────────────
clip('01', 'A', 0, 6.0, {
  stab: true, role: 'promise', title: 'Start at the car park',
  transition: { kind: 'dissolve', seconds: 0.8 },
});
clip('02', 'A', 6.0, 8.9, { stab: true, title: 'Walk toward the booth' });
// 8.9–11.3 이 측정된 회전 — 매표소를 올려다보는 그 동작이다. 1배속.
clip('03', 'A', 8.9, 11.5, { stab: true, turn: true, title: 'The ticket office ahead' });
stop('04', 'A', 11.5, 5.8, {
  title: 'Buy Your Ticket Here',
  sub: 'Adults ₩2,000 · under 7 free',
  caption: 'Card and mobile pay only — the booth takes no cash.',
  chapter: 'Tickets',
});
// 12.4–15.8 회전. 16.9–20.8 회전(광장 두리번)은 통째로 잘라냈다 — 볼 게 없다.
clip('05', 'A', 11.5, 15.8, { stab: true, turn: true, title: 'Past the booth' });
// 20.8–31.4 = 측정된 직진 10.6s. 앞뒤 회전과 0s 로 맞닿아 겹치지 않는다.
clip('06', 'A', 20.8, 31.4, { speed: 3.0, title: 'Along the souvenir stalls', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('07', 'A', 31.4, 33.8, { stab: true, turn: true, title: 'Through the crowd' });
// 33.8→43.4 를 잘라낸다(같은 광장 반복). 43.4–49.3 이 게이트를 향해 도는 회전.
clip('08', 'A', 43.4, 49.0, { stab: true, turn: true, title: 'Up to the entrance gate', transition: { kind: 'dissolve', seconds: 0.6 } });
// 🔴 처음엔 51.0 에 세웠는데 렌더된 세로 프레임으로 보니 「주상절리대 검표소」 빨간 간판이
// 잘리고 사람 팔이 화면을 가로질렀다. 49.0 은 같은 회전의 여운 구간(피크 45.9 에서 3.1s 뒤)이라
// 흔들림 없이 선명하고, 간판·개찰구·파란 선이 한 프레임에 다 들어온다.
stop('09', 'A', 49.0, 5.8, {
  title: 'The Entrance Gate',
  sub: 'Open year-round, 09:00–18:00',
  caption: 'Last entry is 17:40. The deck loop starts inside.',
});
// 49.0–51.0 은 회전(43.4–49.3)의 꼬리 0.3s 를 물고 있다 — 여기를 빨리감으면 게이트 3d 위반이다.
clip('10', 'A', 49.0, 51.0, { stab: true, turn: true, title: 'Tap in at the turnstile' });
clip('10b', 'A', 51.0, 59.6, { speed: 2.4, title: 'Out the far side', ramp: { seconds: 0.6 } });

// ─── B · 공원 안 — 용암 바위정원, 파란 선, 바다로 내려가기 ─────────────────
clip('11', 'B', 0, 3.3, { stab: true, turn: true, title: 'Inside the park', transition: { kind: 'dissolve', seconds: 0.8 } });
clip('12', 'B', 3.3, 8.9, { stab: true, title: 'The lava rock garden' });
clip('13', 'B', 8.9, 16.5, { stab: true, turn: true, title: 'Down the paved path' });
// 파란 선은 이 코스의 진짜 길찾기다 — 게이트에서 절벽 데크까지 이어진다.
// 16.5s 는 측정상 정지 구간(15.8–18.9)이고 선이 화면 가운데를 지난다. 스틸 확인.
stop('14', 'B', 16.5, 5.6, {
  title: 'Follow The Blue Line',
  sub: 'Painted down the middle',
  caption: 'It runs from the gate all the way to the cliff decks.',
  chapter: 'The blue line',
});
clip('15', 'B', 16.5, 21.3, { stab: true, turn: true, title: 'Under the pines' });
clip('16', 'B', 21.3, 26.0, { stab: true, turn: true, title: 'The path bends to the sea' });
// 26.0→35.3 잘라냄. 35.3–39.9 가 측정된 직진.
clip('17', 'B', 35.3, 39.9, { speed: 2.0, title: 'Along the coastal pines', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
// 39.9–54.8 은 14.9s 짜리 회전 = 바다가 열리는 그 순간. 앞쪽 6.1s 만 쓴다.
clip('18', 'B', 39.9, 46.0, { stab: true, turn: true, title: 'The sea opens up' });
clip('19', 'B', 55.9, 63.8, { stab: true, turn: true, title: 'Down to the first deck', chapter: 'Down to the sea', transition: { kind: 'dissolve', seconds: 0.6 } });
// 63.8 에서 이어 붙인다 — 65.4 로 시작하면 1.6s 가 조용히 건너뛰어져 툭 끊긴다(게이트 1).
clip('20', 'B', 63.8, 71.0, { stab: true, turn: true, title: 'The cliff edge' });
clip('21', 'B', 80.3, 87.4, { speed: 2.2, title: 'Along the boardwalk', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('22', 'B', 87.4, 91.0, { stab: true, turn: true, title: 'Above the cove' });
stop('23', 'B', 91.0, 5.6, {
  title: 'The Cove Below',
  sub: 'Boulders, not sand',
  caption: 'Clear shallow water where the lava ran into the sea.',
});
clip('24', 'B', 91.0, 95.3, { stab: true, turn: true, title: 'Past the cove' });
// 95.3–113.9 = 측정된 직진 18.6s. 데크 위 같은 그림이 계속된다.
clip('25', 'B', 95.3, 113.9, { speed: 5.0, title: 'On around the loop', ramp: { seconds: 0.6 } });
clip('26', 'B', 113.9, 116.3, { stab: true, turn: true, title: 'The deck turns inland' });

// ─── C · 절벽 데크와 주상절리 ──────────────────────────────────────────────
clip('27', 'C', 0, 3.4, { stab: true, title: 'Back out on the cliff', transition: { kind: 'dissolve', seconds: 0.8 } });
clip('28', 'C', 3.4, 10.3, { stab: true, turn: true, title: 'The deck follows the rock' });
clip('29', 'C', 10.3, 29.4, { speed: 5.0, title: 'Out to the far deck', ramp: { seconds: 0.6 } });
// 29.4–34.8 (peak 0.913) 이 기둥 쪽으로 도는 회전이다. 이 영상 전체의 주인공.
clip('30', 'C', 29.4, 34.9, { stab: true, turn: true, title: 'And there they are', chapter: 'The columns' });
stop('31', 'C', 34.9, 6.4, {
  title: 'Jusangjeolli — The Columns',
  sub: 'Natural Monument No. 443',
  caption: 'Cooling lava contracted into five- and six-sided pillars.',
});
clip('32', 'C', 34.9, 41.0, { stab: true, title: 'Stand and look' });
clip('33', 'C', 43.4, 48.3, { stab: true, turn: true, title: 'The cliff runs on', transition: { kind: 'dissolve', seconds: 0.6 } });
// 48.3–92.4 는 44s 짜리 직진(복귀). 회전이 하나도 없어 회전에서 쪼갤 수가 없다 —
// 그래서 가위로 70.0→78.0 을 들어내고 두 번의 짧은 런으로 나눴다(게이트 3b).
clip('34', 'C', 48.3, 70.0, { speed: 5.0, title: 'Back the way you came', chapter: 'The way back', ramp: { seconds: 0.6 } });
clip('35', 'C', 78.0, 92.4, { speed: 4.0, title: 'Up through the pines', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('36', 'C', 92.4, 96.8, { stab: true, turn: true, title: 'The path climbs' });
clip('37', 'C', 101.8, 113.4, { speed: 3.4, title: 'Past the rock garden', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('38', 'C', 113.4, 115.8, { stab: true, turn: true, title: 'The last bend' });
clip('39', 'C', 115.8, 123.9, { speed: 2.6, title: 'Toward the exit', chapter: 'The way out', ramp: { seconds: 0.6 } });
clip('40', 'C', 128.0, 133.0, { stab: true, turn: true, title: 'The exit gate ahead', transition: { kind: 'dissolve', seconds: 0.6 } });
// 🔴 첫 카피는 "Straight on, back the way you came in" 이었는데 프리뷰 스틸로 보니
// 분홍 선이 오른쪽 개찰 셸터로 휘고 있었다 — 화면이 말하는 것과 문장이 달랐다(T-53).
stop('41', 'C', 133.0, 5.6, {
  title: 'The Way Out',
  sub: 'Turnstiles on the way out too',
  caption: 'Out through the gate, then back past the shops.',
});
clip('42', 'C', 133.0, 140.3, { stab: true, turn: true, title: 'Out through the turnstile' });
clip('43', 'C', 143.8, 151.9, { speed: 2.6, title: 'Back to the plaza', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('44', 'C', 151.9, 157.3, { stab: true, turn: true, title: 'Where you came in', chapter: 'Where you came in' });
// 마지막 그림은 다시 절벽으로. 6/29 테이크라 소스가 바뀌므로 디졸브 0.8.
clip('45', 'D', 5.0, 8.0, {
  stab: true, mute: true, role: 'recap', title: 'The cliff you just walked',
  transition: { kind: 'dissolve', seconds: 0.8 },
});

spec.beats = beats;
fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n');
console.log(`${beats.length} beats → ${SPEC}`);
