/**
 * 지역 해설(제주 알아보기) 주제에 실사진을 붙인다.
 *
 *   node scripts/wire-region-script-photos.mjs           # 미리보기
 *   node scripts/wire-region-script-photos.mjs --apply   # 업로드 + DB 반영
 *
 * 왜 스크립트인가: 소재가 계속 들어온다. D:/VIDEO2 에 폴더가 추가될 때마다
 * 아래 MANIFEST 에 한 줄 넣고 다시 돌리면 된다. 손으로 크롭·업로드·UPDATE 를
 * 반복하면 세 번째쯤에서 크기나 경로가 어긋난다.
 *
 * 🔴 crop 은 장식이 아니라 **초상권 장치**다. 관광지 사진에는 남의 얼굴이
 * 딸려 온다. 손님 앱에 그대로 올리면 안 되므로, 얼굴이 든 구역은 프레임에서
 * 잘라내고 그 좌표를 여기 기록으로 남긴다(나중에 왜 잘랐는지 알 수 있게).
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const BUCKET = 'tour-images';
const PREFIX = 'region-scripts/jeju';
const OUT_W = 1600;
const OUT_H = 900; // 16:9 — 시트 안에서 h-44 로 잘려 들어간다.

/**
 * source  — 원본 경로
 * crop    — {left, top, width, height} (원본 픽셀). 없으면 가운데 16:9.
 * why     — 그 크롭을 한 이유. 얼굴 제거는 반드시 적는다.
 */
const MANIFEST = [
  {
    topicKey: 'haenyeo',
    source: 'D:/VIDEO2/제주/성산일출봉/19_20260731_140613.jpg',
    crop: { left: 0, top: 375, width: 4000, height: 2250 },
    why: '성산 앞바다에서 물질 중인 해녀 4명. 전원 등을 보이고 있어 식별되지 않는다.',
  },
  {
    topicKey: 'hallasan-unesco',
    source: 'D:/VIDEO2/제주/성산일출봉/08_20260731_135953_001.jpg',
    crop: { left: 0, top: 200, width: 2400, height: 1350 },
    why: '🔴 오른쪽 1/3 에 해녀 시연을 보는 관광객 수십 명의 얼굴이 있다. 왼쪽 2400px 만 쓴다 — 성산일출봉 응회구 전경만 남는다.',
  },
  {
    topicKey: 'overview',
    source: 'D:/VIDEO2/제주/외돌개/08_20260731_170232.jpg',
    crop: { left: 0, top: 375, width: 4000, height: 2250 },
    why: '역광의 현무암 해안 절벽과 곰솔. 사람 없음. 「화산이 만든 섬」 도입부에 맞는다.',
  },
];

const apply = process.argv.includes('--apply');

function env(key) {
  const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`.env.local 에 ${key} 가 없다`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(
  env('NEXT_PUBLIC_SUPABASE_URL'),
  env('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
);

let failed = 0;
for (const item of MANIFEST) {
  if (!existsSync(item.source)) {
    console.error(`✗ ${item.topicKey}: 원본 없음 — ${item.source}`);
    failed += 1;
    continue;
  }

  const pipeline = sharp(item.source).rotate();
  if (item.crop) pipeline.extract(item.crop);
  const buf = await pipeline
    .resize(OUT_W, OUT_H, { fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer();

  const key = `${PREFIX}/${item.topicKey}.webp`;
  console.log(
    `${apply ? '→' : '·'} ${item.topicKey.padEnd(18)} ${(buf.length / 1024).toFixed(0)}KB  ${key}`,
  );
  console.log(`    ${item.why}`);

  if (!apply) continue;

  const up = await supabase.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: 'image/webp', upsert: true });
  if (up.error) {
    console.error(`✗ upload ${item.topicKey}: ${up.error.message}`);
    failed += 1;
    continue;
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
  const { error } = await supabase
    .from('region_scripts')
    .update({ image_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('region_key', 'jeju')
    .eq('topic_key', item.topicKey);
  if (error) {
    console.error(`✗ update ${item.topicKey}: ${error.message}`);
    failed += 1;
    continue;
  }
  console.log(`    ${pub.publicUrl}`);
}

// 붙일 사진이 없는 주제를 조용히 두면 "다 넣었다"로 읽힌다. 남은 것을 센다.
const { data: rows } = await supabase
  .from('region_scripts')
  .select('topic_key, image_url')
  .eq('region_key', 'jeju')
  .order('sort_order');
const missing = (rows ?? []).filter((r) => !r.image_url).map((r) => r.topic_key);
console.log(`\n사진 있음 ${(rows ?? []).length - missing.length}/${(rows ?? []).length}`);
if (missing.length) console.log(`사진 없음: ${missing.join(', ')}`);

process.exit(failed > 0 ? 1 : 0);
