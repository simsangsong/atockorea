#!/usr/bin/env node
/**
 * D:\VIDEO2 루트에 흩어진 소재를 관광지 폴더로 되돌린다. (2026-08-07)
 *
 *   node scripts/video-guide/reclaim-loose-root-2026-08-07.mjs          # 계획만 출력
 *   node scripts/video-guide/reclaim-loose-root-2026-08-07.mjs --apply  # 실제 이동
 *
 * 🔴 왜 필요한가.
 *   `docs/video-specs/manjanggul-lava-tube.json` 이 8/4 재촬영 22클립을 참조하는데
 *   그 파일들이 폴더가 아니라 **루트에** 있었다. 그래서 validate.mjs 가 소스 22개
 *   전부 없다고 보고했고, 스펙은 렌더 불가 상태였다.
 *
 * 🔴 분류 근거는 추측이 아니다.
 *   GPS 는 전 파일에 없다(폰 지오태깅 off — jpg 58개 전수 확인). 그래서 프레임을
 *   뽑아 눈으로 봤고, 확정된 것만 관광지 폴더로 보낸다:
 *     만장굴          스펙이 22개를 이름으로 지목 + 10:52 두 클립·사진 3장이 같은 동굴
 *     해녀박물관      전시 사진 11장 + 14:42 영수증에 「해녀박물관 · 064-710-6902 · 구좌읍」
 *     헬로키티아일랜드 클립 하나에 「HELLO KITTY ISLAND」 간판이 그대로 찍혀 있다
 *   나머지는 **확정 못 했으므로 관광지 폴더에 넣지 않는다.** 잘못 넣으면 그 폴더의
 *   소재 세트가 오염되고, 다음 사람은 그게 오염인지 알 방법이 없다.
 *
 * 🔴 번호 규칙 (D:\VIDEO2\INVENTORY-*.md 가 정한 것).
 *   NN 은 폴더 안 고유 손잡이일 뿐 촬영 순서가 아니다. **기존 파일은 재순번하지
 *   않는다** — 새 소재만 폴더의 max+1 부터 이어붙인다. 2026-08-01 재순번이 출고된
 *   스펙 둘을 조용히 깨뜨린 적이 있다.
 *
 * 되돌리기: 같은 폴더에 쓰는 manifest CSV 를 역순으로 읽으면 된다.
 */
import { readdirSync, statSync, renameSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/VIDEO2';
const APPLY = process.argv.includes('--apply');

/** 확정 분류 — 값은 ROOT 기준 상대 폴더. */
const PLACE = {
  만장굴: {
    dir: '제주/만장굴',
    match: (ts) => ts.startsWith('20260804_10') && ts >= '20260804_102609' && ts <= '20260804_105845',
    why: '스펙이 22개를 이름으로 지목 · 10:52 클립/사진도 같은 동굴',
  },
  해녀박물관: {
    dir: '제주/해녀박물관',
    match: (ts) => ts >= '20260804_150301' && ts <= '20260804_150718',
    why: '전시 사진 11장 + 14:42 영수증의 상호·전화·주소',
  },
  헬로키티아일랜드: {
    dir: '제주/헬로키티아일랜드',
    match: (ts) => ts.startsWith('20260805_15'),
    why: '클립에 HELLO KITTY ISLAND 간판',
  },
};

/** 관광지가 아닌 것 — 확정 분류이되 소재가 아니다. */
const ASIDE = [
  {
    dir: '_미분류/샤오홍슈-내려받음',
    test: (f) => /^Camera_/i.test(f) || /^xhs_live_photo_/i.test(f),
    why: '샤오홍슈에서 내려받은 남의 사진 — 우리 촬영본이 아니다',
  },
  {
    dir: '_미분류/영수증',
    test: (f) =>
      ['20260804_103055.jpg', '20260804_130306.jpg', '20260804_144241.jpg'].includes(f),
    // 103055 = 만장굴 입장권(10:30, 064-710-7903, ₩43,500) · 144241 = 해녀박물관(14:42, ₩12,000)
    // · 130306 = 13:02 ₩50,000 상호 미상. 촬영 시각으로 보면 각각 만장굴·해녀박물관에
    // 속하지만 **관광지 폴더는 소재만 담는다.** 영수증이 소재 세트에 섞이면 언젠가
    // 영상에 들어간다. 어디 것인지는 이 주석과 되돌리기 명세가 들고 있다.
    why: '결제 영수증 — 방문 증빙이지 소재가 아니다',
  },
];

/** 프레임을 봤지만 장소를 확정하지 못한 것들의 집. 루트는 비워 두는 게 규칙이다. */
const UNSURE_DIR = '_미분류/미확인-2026-08-07';

const TS = /^(\d{8}_\d{6})\.(mp4|jpg|jpeg)$/i;

function nextNumber(dir) {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir)
    .map((f) => /^(\d+)_/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

const loose = readdirSync(ROOT).filter((f) => {
  try { return statSync(path.join(ROOT, f)).isFile(); } catch { return false; }
});

const plan = [];
const unplaced = [];

for (const f of loose) {
  if (/^INVENTORY-.*\.md$/i.test(f)) continue; // 생성물, 제자리

  const aside = ASIDE.find((a) => a.test(f));
  if (aside) { plan.push({ f, dir: aside.dir, keepName: true, why: aside.why }); continue; }

  const m = TS.exec(f);
  if (!m) { unplaced.push({ f, why: '이름이 타임스탬프 규칙이 아니다' }); continue; }

  const ts = m[1];
  const hit = Object.entries(PLACE).find(([, p]) => p.match(ts));
  if (hit) plan.push({ f, dir: hit[1].dir, ts, why: hit[1].why });
  else {
    plan.push({ f, dir: UNSURE_DIR, keepName: true, why: '장소 미확정 — 사람이 판별할 것' });
    unplaced.push({ f });
  }
}

// 폴더별로 타임스탬프 순서대로 번호를 매긴다 (기존 파일 번호는 건드리지 않는다)
const counters = {};
for (const item of plan.filter((p) => !p.keepName).sort((a, b) => a.ts.localeCompare(b.ts))) {
  const abs = path.join(ROOT, item.dir);
  if (counters[item.dir] == null) counters[item.dir] = nextNumber(abs);
  item.to = `${String(counters[item.dir]++).padStart(2, '0')}_${item.f}`;
}
for (const item of plan.filter((p) => p.keepName)) item.to = item.f;

// ── 보고 ────────────────────────────────────────────────────────────────────
const byDir = {};
for (const p of plan) (byDir[p.dir] ||= []).push(p);

console.log(APPLY ? '== 이동 실행 ==' : '== 계획 (실행하려면 --apply) ==');
for (const dir of Object.keys(byDir).sort()) {
  const items = byDir[dir];
  console.log(`\n[${dir}]  ${items.length}개   — ${items[0].why}`);
  const isNew = !existsSync(path.join(ROOT, dir));
  if (isNew) console.log('   (새 폴더)');
  for (const it of items.slice(0, 4)) console.log(`   ${it.f}  ->  ${it.to}`);
  if (items.length > 4) console.log(`   … 그 외 ${items.length - 4}개`);
}

console.log(
  `\n합계: 이동 ${plan.length}개 (그중 장소 미확정 ${unplaced.length}개는 관광지 폴더가 아니라 ${UNSURE_DIR} 로) · 루트 파일 ${loose.length}`,
);

if (!APPLY) process.exit(0);

// ── 실행 ────────────────────────────────────────────────────────────────────
const rows = ['from,to'];
let moved = 0;
for (const it of plan) {
  const absDir = path.join(ROOT, it.dir);
  mkdirSync(absDir, { recursive: true });
  const src = path.join(ROOT, it.f);
  const dst = path.join(absDir, it.to);
  if (existsSync(dst)) { console.log(`SKIP (이미 있다) ${dst}`); continue; }
  renameSync(src, dst);
  rows.push(`${it.f},${it.dir}/${it.to}`);
  moved++;
}
const manifest = path.join(ROOT, 'manifest-되돌리기용-2026-08-07.csv');
writeFileSync(manifest, rows.join('\n') + '\n', 'utf8');
console.log(`\n이동 ${moved}개 · 되돌리기 명세 ${manifest}`);
