/**
 * 상호명 → 카카오 장소(좌표·주소·전화·딥링크) 조회.
 *
 * 왜 새로 만드는가: `lib/ops/dining/kakao.server.ts`는 **좌표 기준 카테고리
 * 검색**(category.json)이다 — "이 근처 식당 다 줘". 우리가 필요한 건 반대다:
 * 이름을 아는 특정 가게의 좌표를 알아야 한다(keyword.json). 같은 API 계열이라
 * 헤더·쿼터 규칙은 같지만 엔드포인트가 다르다.
 *
 * 결과는 사람이 고른다. 동명이인이 흔하기 때문이다 — "돌담"·"어린왕자" 같은
 * 이름은 제주에만 여러 곳이고, 자동으로 1등을 집으면 엉뚱한 가게의 좌표가
 * 손님 앱에 실린다. 그래서 이 스크립트는 후보를 나열만 하고 쓰지 않는다.
 *
 * 사용:
 *   node scripts/lookup-kakao-places.mjs "효퇴국수국밥" "숙성도" ...
 *   node scripts/lookup-kakao-places.mjs --json names.json
 */

import { readFileSync } from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url);

function loadKey() {
  const text = readFileSync(ENV_PATH, 'utf8');
  const line = text.split(/\r?\n/).find((l) => l.startsWith('KAKAO_REST_API_KEY='));
  if (!line) throw new Error('KAKAO_REST_API_KEY not found in .env.local');
  return line.slice('KAKAO_REST_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
}

const KEY = loadKey();

/** 제주 밖 동명 가게를 걸러낸다 — 전국 검색이라 서울 "돌담"이 1등으로 온다. */
const JEJU = /^제주/;

async function search(query) {
  const url =
    'https://dapi.kakao.com/v2/local/search/keyword.json' +
    `?query=${encodeURIComponent(query)}&size=15`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!res.ok) {
    return { query, error: `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`, docs: [] };
  }
  const data = await res.json();
  const docs = (data.documents ?? [])
    .filter((d) => JEJU.test(d.address_name ?? '') || JEJU.test(d.road_address_name ?? ''))
    .map((d) => ({
      name: d.place_name,
      category: d.category_name,
      road: d.road_address_name || null,
      jibun: d.address_name || null,
      phone: d.phone || null,
      lat: Number(d.y),
      lng: Number(d.x),
      kakao_id: d.id,
      kakao_url: d.place_url,
    }));
  return { query, docs };
}

const args = process.argv.slice(2);
let names = args;
if (args[0] === '--json') names = JSON.parse(readFileSync(args[1], 'utf8'));
if (!names.length) {
  console.error('usage: node scripts/lookup-kakao-places.mjs "<상호>" ["<상호>" ...]');
  process.exit(1);
}

const out = [];
for (const n of names) {
  // 순차 호출 — 쿼터가 넉넉해도 동시 15개를 때릴 이유가 없다.
  const r = await search(n);
  out.push(r);
  const head = r.docs[0];
  console.log(
    `\n■ ${n}  (제주 내 후보 ${r.docs.length}건)${r.error ? '  ⚠ ' + r.error : ''}`,
  );
  for (const [i, d] of r.docs.slice(0, 4).entries()) {
    console.log(
      `  ${i === 0 ? '→' : ' '} ${d.name} · ${d.category?.split('>').pop()?.trim() ?? ''}` +
        `\n     ${d.road ?? d.jibun}  ${d.phone ?? ''}` +
        `\n     ${d.lat}, ${d.lng}`,
    );
  }
  if (!head) console.log('  (없음 — 이름 확인 필요)');
}

console.log('\n\n===== JSON =====');
console.log(JSON.stringify(out, null, 1));
