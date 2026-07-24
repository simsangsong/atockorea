/**
 * Why does a Google place find no Kakao twin? For each rated Google place,
 * report its nearest Kakao doc: distance + name similarity. That tells us
 * whether the 40 m gate or the name gate is what rejects it.
 *
 *   node --env-file=.env.local --import tsx scripts/probe-dining-match.ts <lat> <lng> [radius]
 */
import { kakaoCategorySearch } from '@/lib/ops/dining/kakao.server';
import { googleNearbyRestaurants } from '@/lib/ops/dining/google.server';
import { nameSimilarity } from '@/lib/ops/dining/merge.server';
import { haversineM } from '@/lib/tour-room/geo';

const lat = Number(process.argv[2] ?? 33.45806);
const lng = Number(process.argv[3] ?? 126.9425);
const radiusM = Number(process.argv[4] ?? 1500);

async function main() {
  const fd6 = await kakaoCategorySearch({ lat, lng, radiusM, group: 'FD6' });
  const ce7 = await kakaoCategorySearch({ lat, lng, radiusM, group: 'CE7' });
  const kakao = [...fd6, ...ce7];
  const google = (await googleNearbyRestaurants({ lat, lng, radiusM })).filter(
    (g) => typeof g.rating === 'number',
  );

  console.log(`kakao=${kakao.length} google(rated)=${google.length}\n`);
  console.log('google place'.padEnd(34), 'nearest kakao'.padEnd(30), 'dist', ' sim');
  console.log('-'.repeat(84));

  let bestByDistOnly = 0;
  let wouldPassAt120 = 0;
  for (const g of google) {
    let near: { name: string; d: number; sim: number } | null = null;
    for (const k of kakao) {
      const d = haversineM(
        { latitude: g.lat, longitude: g.lng },
        { latitude: Number(k.y), longitude: Number(k.x) },
      );
      const sim = nameSimilarity(g.displayName ?? '', k.place_name);
      if (!near || d < near.d) near = { name: k.place_name, d, sim };
    }
    if (!near) continue;
    if (near.d <= 40) bestByDistOnly += 1;
    if (near.d <= 120 && near.sim >= 0.5) wouldPassAt120 += 1;
    console.log(
      (g.displayName ?? g.id).slice(0, 33).padEnd(34),
      near.name.slice(0, 29).padEnd(30),
      String(Math.round(near.d)).padStart(4),
      near.sim.toFixed(2).padStart(5),
    );
  }
  console.log('-'.repeat(84));
  console.log(`nearest kakao within 40 m : ${bestByDistOnly}/${google.length}`);
  console.log(`within 120 m AND sim>=0.5 : ${wouldPassAt120}/${google.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
