#!/usr/bin/env node
/**
 * osulloc-tea-museum 비트 시트 생성기.
 *
 *   node scratch/gen-osulloc.mjs
 *
 * 사장님 지시 (2026-08-03):
 *   "빨리감기 넣지 말고 … 만약 한 테이크가 같은 장소에서 너무 길면 중간 조금 잘라서
 *    앞뒤 자연스럽게 이어 붙여도 좋아, 혹은 그냥 직진 구간이 긴 곳만 빨리감기 하고,
 *    앵글이 돌아가는 구간은 절대 빨리감기 넣지 말고."
 *   "폴라로이드들은 다 빼고, 그냥 중점 장소에 타이포 얹어서 설명 몇 줄"
 *
 * 그래서 이 스펙의 문법은 앞선 4개와 다르다:
 *   - 기본이 1배속이다. 빨리감기는 **긴 직진 4곳**(C 복도·G 정원길·H 가로수길·I 공원
 *     복귀)뿐이고 전부 2.2–3.0x — 8x 는 한 곳도 없다.
 *   - 같은 장소가 길어지면 속도가 아니라 **가위**로 줄인다(디졸브 0.5–0.6 로 봉합).
 *   - 회전 구간은 손대지 않는다. 게이트 3d 가 turns 캐시로 강제한다.
 *   - 폴라로이드 0개. 중점 장소는 전부 프리즈+타이포(V6-D21).
 */
import fs from 'node:fs';

const OUT = 'docs/video-specs/osulloc-tea-museum.json';
const beats = [];

/** 클립 비트. dur = (out-in)/speed */
const clip = (id, src, inS, outS, o = {}) => { beats.push({ id, kind: 'clip', src, in: inS, out: outS, speed: o.speed ?? 1, ...o }); };
/** 정지 + 타이포. 뒤에 오는 같은 소스 클립은 반드시 at 에서 시작해야 한다(게이트). */
const stop = (id, src, at, hold, o = {}) => { beats.push({ id, kind: 'arrow', src, at, hold, ...o }); };

// ─── 콜드 오픈 ─────────────────────────────────────────────────────────────
// 훅 게이트: 첫 비트는 클레임 타이틀, 본편 진입 12s 이내.
// 63.5s 는 팬 한가운데(62.9–71.3, peak 0.732)라 히어로로 쓰면 흔들린다 —
// 나무가 밭을 감싸는 58.0s 로 옮겼다(스틸 확인).
clip('c1', 'H', 58.0, 61.5, {
  stab: true, mute: true, role: 'title',
  title: "Jeju's tea heartland, free entry",
  sub: 'OSULLOC Tea Museum — Seogwang, Jeju',
  chapter: 'Osulloc Tea Museum',
});
clip('c2', 'D', 17.2, 19.7, { stab: true, mute: true, title: 'Cold open — the view from level two', transition: { kind: 'dissolve', seconds: 0.5 } });
clip('c3', 'E', 43.6, 45.8, { stab: true, mute: true, title: 'Cold open — the free tasting', transition: { kind: 'dissolve', seconds: 0.5 } });

// ─── A · 주차장에서 차밭, 그리고 횡단보도 ──────────────────────────────────
clip('01', 'A', 0, 6.5, {
  stab: true, role: 'promise', title: 'Start at the car park',
  transition: { kind: 'dissolve', seconds: 0.8 },
});
// 8.4–11.3s 가 측정된 회전 — 차밭을 둘러보는 그 동작이 곧 관람이다. 1배속.
clip('02', 'A', 6.5, 11.3, { stab: true, turn: true, title: 'The field starts at the kerb' });
// 11.3→13.4 를 잘라낸다(같은 자리 제자리걸음). 디졸브로 봉합.
clip('03', 'A', 13.4, 20.4, { stab: true, title: 'Down to the crossing', transition: { kind: 'dissolve', seconds: 0.5 } });

// ─── B · 건너자마자 양쪽 입구 ──────────────────────────────────────────────
clip('04', 'B', 0, 1.3, { stab: true, title: 'Across the road', transition: { kind: 'dissolve', seconds: 0.8 } });
stop('05', 'B', 1.3, 5.8, {
  title: 'Two Entrances, One Hedge',
  sub: 'Straight ahead, or right',
  caption: 'Straight for Osulloc, right for Innisfree.',
  chapter: 'Two entrances',
});
// 0–4.8s(peak 0.968)·3.9–9.3s 가 회전 — 양쪽을 훑어보는 그 스윙이다. 절대 손대지 않는다.
clip('06', 'B', 1.3, 9.3, { stab: true, turn: true, title: 'Looking both ways' });
clip('07', 'B', 9.3, 15.2, { stab: true, title: 'Up to the doors' });

// ─── C · 안으로, 엘리베이터 ────────────────────────────────────────────────
clip('08', 'C', 1.5, 9.5, { stab: true, title: 'In through the glass', chapter: 'Inside', transition: { kind: 'dissolve', seconds: 0.8 } });
// 긴 직진 복도 — 여기가 빨리감기 4곳 중 하나. 회전(11.9–14.8, peak 0.593)은
// 잘라내 버렸으므로 이 구간 안에 회전이 없다(0.60 캐시에 C 는 0건).
clip('09', 'C', 15.2, 21.6, { stab: false, speed: 2.4, title: 'Through to the lift', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.5 } });
clip('10', 'C', 21.6, 25.7, { stab: true, title: 'The lift to level two' });

// ─── D · 2층 전망대 ────────────────────────────────────────────────────────
clip('11', 'D', 1.6, 4.6, { stab: true, title: 'Up one floor', transition: { kind: 'dissolve', seconds: 0.8 } });
// 11.4–16.8s(peak 0.936) 가 창가를 훑는 회전. 이 비트의 주인공이다.
// 🔴 첫 시도는 프리즈를 18.6s 에 뒀는데, 렌더해 보니 화면의 주인공이 주차장과
// 지붕이고 차밭은 실낱 같았다 — 라벨이 화면에 없는 걸 가리키는 T-53 그대로다.
// 팬이 시작되기 직전(11.5s)이 전경 잔디·중경 차밭·원경 오름이 다 들어오고 선명하다.
clip('12', 'D', 6.6, 11.5, { stab: true, title: 'The window wall', transition: { kind: 'dissolve', seconds: 0.5 } });
stop('13', 'D', 11.5, 5.8, {
  title: 'Level Two Lookout',
  sub: 'Free, and easy to walk past',
  caption: 'Garden, tea fields and the hills beyond.',
  chapter: 'Level two lookout',
});
// 라벨을 먼저 읽히고 나서 카메라가 창을 훑는다(11.4–16.8, peak 0.936).
clip('14', 'D', 11.5, 19.5, { stab: true, turn: true, title: 'The window sweep' });

// ─── E · 1층 홀 — 화장실·전시·시음·매장·카페·티스톤 ────────────────────────
clip('15', 'E', 5.4, 9.5, { stab: true, title: 'Out of the lift', transition: { kind: 'dissolve', seconds: 0.8 } });
stop('16', 'E', 9.5, 5.2, {
  title: 'Restrooms, To The Left',
  sub: 'Facing you as you step out',
  caption: 'The pictogram plate on the stone wall.',
});
clip('17', 'E', 9.5, 17.0, { stab: true, title: 'The hall opens up' });
stop('18', 'E', 17.0, 5.4, {
  title: 'The Exhibition Side',
  sub: 'Left out of the lift',
  caption: 'Lit cases and wall panels, left of the lift.',
  chapter: 'Exhibition side',
});
clip('19', 'E', 17.0, 22.5, { stab: true, title: 'Along the cases' });
// 진열대 훑는 15초를 잘라낸다 — 같은 자리, 같은 그림.
clip('20', 'E', 38.2, 43.6, { stab: true, title: 'On to the tasting counter', transition: { kind: 'dissolve', seconds: 0.6 } });
stop('21', 'E', 43.6, 5.8, {
  title: 'Free Tastings',
  sub: 'Two counters, help yourself',
  caption: 'Small cups poured all day. No ticket needed.',
  chapter: 'Free tastings',
});
clip('22', 'E', 43.6, 50.0, { stab: true, title: 'Past the cups' });
stop('23', 'E', 50.0, 5.6, {
  title: 'The Tea Shop',
  sub: 'Straight on from the tastings',
  caption: 'Loose leaf, tea bags and gift tins, all in one room.',
  chapter: 'The tea shop',
});
clip('24', 'E', 50.0, 54.4, { stab: true, title: 'Through the shop' });
// 카페 좌석 구경 17초를 잘라내고 주문 줄로 바로 붙인다.
clip('25', 'E', 75.0, 81.0, { stab: true, title: 'The cafe queue', transition: { kind: 'dissolve', seconds: 0.6 } });
stop('26', 'E', 81.0, 5.8, {
  title: 'The Green Tea Cafe',
  sub: 'Order here, pick up at A or B',
  caption: 'Green tea ice cream and the roll cake.',
  chapter: 'The green tea cafe',
});
clip('27', 'E', 81.0, 85.6, { stab: true, title: 'Out past the counter' });
clip('28', 'E', 95.5, 102.5, { stab: true, title: 'Out the far side', transition: { kind: 'dissolve', seconds: 0.6 } });
clip('29', 'E', 104.0, 111.0, { stab: true, title: 'Into Tea Stone', transition: { kind: 'dissolve', seconds: 0.5 } });
clip('30', 'E', 120.0, 129.8, { stab: true, title: 'The stone hall', transition: { kind: 'dissolve', seconds: 0.6 } });

// ─── F · 티스톤 안쪽 ───────────────────────────────────────────────────────
// 🔴 티스톤 라벨은 원래 E@124 였는데 E 구간은 117~131s 전부 앞사람 등에 막힌다.
// F@8 이 사람 없이 선반이 통째로 보이는 유일한 프레임이라 라벨을 여기로 옮겼다.
// 숙성 주장의 근거도 화면 안에 있다 — F@24 의 팻말이 "THE TEA IS AGING".
clip('33', 'F', 0, 8.0, { stab: true, title: 'Into the cellar', transition: { kind: 'dissolve', seconds: 0.8 } });
stop('34', 'F', 8.0, 5.6, {
  title: 'Tea Stone',
  sub: 'Across from the cafe exit',
  caption: 'Tea aging on the shelves, in the stone cellar.',
  chapter: 'Tea Stone',
});
clip('35a', 'F', 8.0, 14.0, { stab: true, title: 'Along the shelves' });
clip('35b', 'F', 21.0, 27.0, { stab: true, title: 'The aging boxes', transition: { kind: 'dissolve', seconds: 0.5 } });
// 28.4–31.8s(peak 0.782) 회전 — 도구 진열로 고개를 돌리는 그 동작.
clip('35c', 'F', 27.0, 31.8, { stab: true, turn: true, title: 'Whisks, scoops and leaf' });

// ─── G · 정원길을 따라 이니스프리로 ────────────────────────────────────────
clip('35', 'G', 0, 6.0, { stab: true, title: 'Back out to the path', transition: { kind: 'dissolve', seconds: 0.8 } });
// 긴 직진. 7.3s 이후로 측정된 회전이 없다 — 여기가 빨리감기의 제자리다.
clip('36', 'G', 7.3, 20.0, { speed: 2.6, title: 'The garden path', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.5 } });
clip('37', 'G', 20.0, 32.0, { speed: 2.6, title: 'Past the tea house', ramp: { seconds: 0.6 } });
clip('38', 'G', 32.0, 44.5, { speed: 2.6, title: 'Uphill to the glass house', ramp: { seconds: 0.6 } });
clip('39', 'G', 44.5, 49.0, { stab: true, title: 'Arriving' });

// ─── H · 이니스프리, 그리고 반대쪽 녹차밭 ──────────────────────────────────
// 0–18s 가 가로수 직진. 측정 회전 없음.
clip('40', 'H', 0, 8.0, { speed: 2.4, title: 'The tree walk', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.8 } });
clip('41', 'H', 8.0, 19.4, { speed: 2.4, title: 'Up to the doors', ramp: { seconds: 0.6 } });
clip('42', 'H', 19.4, 26.4, { stab: true, title: 'Inside Innisfree' });
stop('43', 'H', 26.4, 5.6, {
  title: 'Innisfree Jeju House',
  sub: 'The right-hand entrance',
  caption: 'Skincare made from the island, and a cafe.',
  chapter: 'Innisfree Jeju House',
});
// 26.4–45.8s 에 회전이 세 번 — 매장을 둘러보는 동작. 통째로 1배속.
clip('44', 'H', 26.4, 34.5, { stab: true, turn: true, title: 'Around the floor' });
clip('45', 'H', 40.0, 45.8, { stab: true, turn: true, title: 'Out the far door', transition: { kind: 'dissolve', seconds: 0.5 } });
clip('46', 'H', 47.5, 55.0, { stab: true, title: 'Left, and downhill', transition: { kind: 'dissolve', seconds: 0.5 } });
// 62.9–71.3s(peak 0.732 @65.4) 가 밭을 훑는 회전 — 이 영상에서 제일 중요한 그림이다.
// 🔴 프리즈는 팬 피크가 아니라 팬이 끝난 71.5s(T-48). 스틸로 확인했다.
clip('47', 'H', 59.5, 71.5, { stab: true, turn: true, title: 'The field opens', transition: { kind: 'dissolve', seconds: 0.5 } });
stop('48', 'H', 71.5, 6.0, {
  title: 'The Lower Tea Field',
  sub: 'Below the Innisfree exit',
  caption: 'The quiet side — rows running to the hills.',
  chapter: 'The lower tea field',
});
clip('49', 'H', 71.5, 76.2, { stab: true, title: 'Along the rows' });

// ─── I · 공원을 가로질러 되돌아오기 ────────────────────────────────────────
// 🔴 처음엔 I 를 통째로 3배속 직진으로 봤는데 게이트 3d 가 반박했다 — 0.61~0.73
// 짜리 회전이 다섯 번(7.9·9.9·17.9·28.9·44.4) 있다. 공원을 둘러보며 걷는 구간이지
// 직진이 아니다. 그래서 출발부는 1배속으로 두고, 회전 사이의 진짜 직진 두 토막
// (20.6–28.7 · 48.6–58.0)만 빨리감고 나머지는 잘라냈다.
clip('50', 'I', 1.5, 10.3, { stab: true, turn: true, title: 'Back up the path', transition: { kind: 'dissolve', seconds: 0.8 } });
clip('51', 'I', 20.6, 28.7, { speed: 2.6, title: 'Across the lawn', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });
clip('52', 'I', 48.6, 58.0, { speed: 2.4, title: 'The last avenue', ramp: { seconds: 0.6 }, transition: { kind: 'dissolve', seconds: 0.6 } });

// ─── J · 다시 횡단보도, 그리고 주차장 ──────────────────────────────────────
clip('53', 'J', 0, 7.9, { stab: true, title: 'Back to the road', transition: { kind: 'dissolve', seconds: 0.8 } });
// 7.9–16.8s 가 횡단보도 양쪽을 살피는 회전. 처음 건너온 그 자리다.
clip('54', 'J', 7.9, 16.8, { stab: true, turn: true, title: 'The same crossing' });
clip('55', 'J', 16.8, 23.5, { stab: true, role: 'recap', title: 'Where you started', chapter: 'Where you started' });

const spec = {
  slug: 'osulloc-tea-museum',
  poiKey: 'osulloc_tea_museum',
  title: { ko: '오설록 티 뮤지엄', en: 'Osulloc Tea Museum' },
  theme: 'pearl',
  output: { width: 1920, height: 1080, fps: 30 },
  encode: { crf: 18 },
  sourceDir: 'D:/VIDEO2/제주/오설록티뮤지엄',
  sources: {
    A: '01_20260803_101257.mp4',
    B: '05_20260803_101453.mp4',
    C: '06_20260803_101535.mp4',
    D: '07_20260803_101624.mp4',
    E: '08_20260803_101718.mp4',
    F: '09_20260803_101941.mp4',
    G: '10_20260803_102026.mp4',
    H: '11_20260803_102139.mp4',
    I: '15_20260803_102354.mp4',
    J: '16_20260803_102517.mp4',
  },
  audio: {
    bed: 'assets/audio/video-guide/bed-haedong-yonggungsa.m4a',
    bedGain: 0.55,
    source: 'Suno — 상업 이용 허가 (사용자 제공 2026-07-29). 오설록 전용 베드 수급 전까지 공유.',
  },
  pacing: {
    maxSlowPct: 92,
    why: '사장님 2026-08-03: "빨리감기 넣지 말고 … 직진 구간이 긴 곳만 빨리감기 하고, 앵글이 돌아가는 구간은 절대 빨리감기 넣지 말고." 40% 상한은 전체를 압축하는 걷기 코스용 파라미터이고, 이 영상은 사장님이 실속도로 보여달라고 한 코스다. 빨리감기는 긴 직진 4곳(C 복도·G 정원길·H 가로수길·I 공원 복귀)뿐, 최고 3.0x.',
  },
  // 여름 역광 + 유리 너머 실내가 섞여 있어 감천 계열 처방을 쓴다: 들어올리지 말고
  // 국소 대비와 채도를 살린다(§7). 실내 비중이 커서 unsharp 는 감천보다 한 단 낮췄다.
  grade: [
    'lenscorrection=k1=-0.13:k2=0.008:i=bilinear',
    'crop=iw*0.93:ih*0.93',
    'vibrance=intensity=0.42',
    'eq=saturation=1.08',
    "curves=r='0/0 0.08/0.055 0.3/0.29 0.55/0.575 0.8/0.845 1/1':g='0/0 0.08/0.055 0.3/0.295 0.55/0.575 0.8/0.84 1/1':b='0/0.01 0.08/0.07 0.3/0.3 0.55/0.55 0.8/0.79 1/0.97'",
    'unsharp=11:11:0.45:5:5:0.0',
    'unsharp=5:5:0.55:5:5:0.0',
    'noise=alls=4:allf=t+u',
    'vignette=a=PI/12',
  ],
  poster: { src: 'H', at: 71.5 },
  teaserLead: '48',
  city: 'Jeju',
  _notes: [
    '5호기 — 사장님 2026-08-03 지시로 페이싱 문법이 앞선 4개와 다르다. 기본 1배속, 빨리감기는 긴 직진 4곳뿐(최고 3.0x, 8x 없음), 회전 구간은 전부 1배속.',
    '같은 장소가 늘어지면 속도가 아니라 가위로 줄였다 — 잘라낸 곳 7군데(A11.3·C9.5·E23.5·E55.4·E85.6·E112·F6)는 전부 디졸브 0.5–0.6 으로 봉합.',
    '폴라로이드 0개 (사장님: "폴라로이드들은 다 빼고"). 중점 장소 10곳은 전부 프리즈+타이포(V6-D21) — 화살표도 없다.',
    '동선은 사장님이 불러준 순서 그대로: 주차장 차밭 → 횡단보도 → 양쪽 입구 → 엘베 2층 전망대 → 화장실 → 전시 → 시음 → 매장 → 카페 → 티스톤 → 이니스프리 → 아래쪽 녹차밭 → 공원 복귀 → 처음 입구.',
    '클레임 원천 = match_pois(osulloc_tea_museum).content_locales.ko — 입장료 무료·시음실·녹차밭·카페 전부 여기서 왔다. 지어낸 사실 없음.',
    '프리즈 10곳은 렌더 스틸로 눈으로 확인했다(T-53): B@1.3 양쪽 간판 동시 노출 · E@9.5 화장실 픽토그램 · E@43.6 시음 컵 트레이 · E@81 카페 메뉴보드 · H@26.4 innisfree 계산대 · D@18.6 창밖 차밭.',
  ],
  beats,
};

fs.writeFileSync(OUT, JSON.stringify(spec, null, 2) + '\n');

// 요약 — 손으로 세지 말 것
const dur = (b) => (b.kind === 'clip' ? (b.out - b.in) / (b.speed ?? 1) : b.hold);
const total = beats.reduce((a, b) => a + dur(b), 0);
const overlap = beats.reduce((a, b) => a + (b.transition?.seconds ?? 0), 0);
const slow = beats.filter((b) => b.kind === 'clip' && (b.speed ?? 1) <= 1.05).reduce((a, b) => a + dur(b), 0);
const fast = beats.filter((b) => b.kind === 'clip' && (b.speed ?? 1) > 1.05);
console.log(`${OUT}  비트 ${beats.length}개`);
console.log(`  합계 ${total.toFixed(1)}s − 디졸브 겹침 ${overlap.toFixed(1)}s ≈ ${(total - overlap).toFixed(0)}s (${Math.floor((total - overlap) / 60)}:${String(Math.round((total - overlap) % 60)).padStart(2, '0')})`);
console.log(`  1배속 ${((slow / total) * 100).toFixed(0)}%  ·  빨리감기 ${fast.length}비트 (${[...new Set(fast.map((b) => b.speed))].sort().join('/')}x)`);
console.log(`  정지+타이포 ${beats.filter((b) => b.kind === 'arrow').length}곳  ·  폴라로이드 ${beats.filter((b) => b.kind === 'polaroid').length}곳  ·  챕터 ${beats.filter((b) => b.chapter).length}개`);
console.log(`  최장 고속 런 ${Math.max(...fast.map((b) => (b.out - b.in) / b.speed)).toFixed(1)}s (상한 5.2s)`);
