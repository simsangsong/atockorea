// Fix itinerary_variants and remaining page_sections Unsplash refs
const fs = require('fs'), path = require('path');
const BASE = 'components/product-tour-static';

const U = {
  seongsan: 'https://api.cdn.visitjeju.net/photomng/imgpath/202409/20/c8bf6191-832c-4605-a948-96f07f6112d2.webp',
  seopjikoji: 'https://api.cdn.visitjeju.net/photomng/imgpath/202408/16/9df6665f-e0cf-4b8a-8d1c-2ec895745448.webp',
  seongeup: 'https://api.cdn.visitjeju.net/photomng/imgpath/202409/06/cf7e9f6b-178f-4d3d-b978-91beb5145a10.webp',
  hallasan: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/6a754887-ab09-410f-ad9d-9340571e4248.webp',
  osulloc: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/20/003f420c-6efe-41e9-93b7-00fe6ac5e83b.webp',
  hyeopjae: 'https://api.cdn.visitjeju.net/photomng/imgpath/202408/27/77cf6bb2-4d0d-4f46-8cfa-3f527a4d06b3.webp',
  hamdeok: 'https://api.cdn.visitjeju.net/photomng/imgpath/202408/20/a397a498-7bc9-4730-963a-cfa29ccffe7d.webp',
  stone_park: 'https://api.cdn.visitjeju.net/photomng/imgpath/202408/21/8d0c970f-fb33-48ad-bb54-93725db7c7b4.webp',
  ilchulland: 'https://api.cdn.visitjeju.net/photomng/imgpath/202207/14/4bcd710c-1b9c-46a2-8d52-d41907853ded.webp',
  cheonjeyeon: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/27/617daa5f-d818-47c1-b80d-59f45e96371b.webp',
  jusangjeolli: 'https://api.cdn.visitjeju.net/photomng/imgpath/202410/21/1690de57-e791-4712-84e9-3963a82de0f1.webp',
  camellia: 'https://api.cdn.visitjeju.net/photomng/imgpath/202410/15/fb2d2739-5e8e-4a87-9d1d-0281d95efeb7.webp',
  aewol: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/25/dae5f548-d5de-41e8-b47b-37490c5238ad.webp',
  dongmun: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/5dabd625-523b-48c7-9b02-35ac1e3bd741.webp',
  jeju_folk: 'https://api.cdn.visitjeju.net/photomng/imgpath/202407/08/b136ca14-3983-4574-a81c-5f8808df56e5.webp',
  manjanggul: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/28/a08aea81-f7f3-44b6-92e4-bd0ddb6aec7b.webp',
  bijarim: 'https://api.cdn.visitjeju.net/photomng/imgpath/202410/16/a6f2d974-bf5b-4e5a-baf6-ff9a3e686015.webp',
  sangumburi: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/20/df1ae123-1c90-4ef4-a502-4053c2e60dc2.webp',
  bulguksa: 'https://tong.visitkorea.or.kr/cms/resource/26/3083926_image2_1.JPG',
  gamcheon: 'https://tong.visitkorea.or.kr/cms/resource/25/1925825_image2_1.JPG',
  jagalchi: 'https://tong.visitkorea.or.kr/cms/resource/16/2356516_image2_1.JPG',
  taejongdae: 'https://tong.visitkorea.or.kr/cms/resource/24/3083924_image2_1.JPG',
  haedong: 'https://tong.visitkorea.or.kr/cms/resource/03/2592103_image2_1.JPG',
  yongdusan: 'https://tong.visitkorea.or.kr/cms/resource/64/2608964_image2_1.JPG',
  cheongsapo: 'https://tong.visitkorea.or.kr/cms/resource/61/2702561_image2_1.JPG',
  haeundae: 'https://tong.visitkorea.or.kr/cms/resource/29/2617829_image2_1.JPG',
  cheomseongdae: 'https://tong.visitkorea.or.kr/cms/resource/87/2661487_image2_1.JPG',
  daereungwon: 'https://tong.visitkorea.or.kr/cms/resource/16/2565716_image2_1.JPG',
  gyochon: 'https://tong.visitkorea.or.kr/cms/resource/62/2477062_image2_1.JPG',
  woljeonggyo: 'https://tong.visitkorea.or.kr/cms/resource/49/2390749_image2_1.JPG',
  ahopsan: 'https://tong.visitkorea.or.kr/cms/resource/23/2028423_image2_1.JPG',
  tongdosa: 'https://tong.visitkorea.or.kr/cms/resource/87/2748787_image2_1.JPG',
  gyeongju_museum: 'https://tong.visitkorea.or.kr/cms/resource/00/2024200_image2_1.JPG',
  gyeongbokgung: 'https://tong.visitkorea.or.kr/cms/resource/06/2735806_image2_1.JPG',
  nami: 'https://tong.visitkorea.or.kr/cms/resource/94/2614694_image2_1.JPG',
  nami2: 'https://tong.visitkorea.or.kr/cms/resource/27/2380427_image2_1.JPG',
  petite_france: 'https://tong.visitkorea.or.kr/cms/resource/06/2510006_image2_1.JPG',
  starfield: 'https://tong.visitkorea.or.kr/cms/resource/29/2005629_image2_1.JPG',
  gwangmyeong: 'https://tong.visitkorea.or.kr/cms/resource/48/2493748_image2_1.JPG',
  waujeongsa: 'https://tong.visitkorea.or.kr/cms/resource/56/2536656_image2_1.JPG',
  dmz_tunnel: 'https://tong.visitkorea.or.kr/cms/resource/03/2493203_image2_1.JPG',
  dorasan: 'https://tong.visitkorea.or.kr/cms/resource/98/1977698_image2_1.JPG',
  sokcho: 'https://tong.visitkorea.or.kr/cms/resource/01/2365701_image2_1.JPG',
  herb_island: 'https://tong.visitkorea.or.kr/cms/resource/46/2513346_image2_1.JPG',
  sanjeong: 'https://tong.visitkorea.or.kr/cms/resource/94/1925694_image2_1.JPG',
  art_valley: 'https://tong.visitkorea.or.kr/cms/resource/91/2618591_image2_1.JPG',
};

function matchStop(name, fallback) {
  const n = name.toLowerCase();
  if (n.includes('seongsan') || n.includes('ilchulbong')) return U.seongsan;
  if (n.includes('manjanggul')) return U.manjanggul;
  if (n.includes('stone park') || n.includes('dolmunhwa')) return U.stone_park;
  if (n.includes('hamdeok') || n.includes('seoubong')) return U.hamdeok;
  if (n.includes('seongeup')) return U.seongeup;
  if (n.includes('folk village') && n.includes('jeju')) return U.seongeup;
  if (n.includes('seopjikoji') || n.includes('east cape')) return U.seopjikoji;
  if (n.includes('hallasan') || n.includes('eoseungsaengak') || n.includes('eorimok') || n.includes('1100')) return U.hallasan;
  if (n.includes('osulloc') || n.includes('sulloc') || n.includes('tea museum') || n.includes('tea field')) return U.osulloc;
  if (n.includes('hyeopjae') || n.includes('hallim park')) return U.hyeopjae;
  if (n.includes('haenyeo') || n.includes('jeju folk')) return U.jeju_folk;
  if (n.includes('cheonjeyeon') || n.includes('pond of the gods') || n.includes('jeongbang')) return U.cheonjeyeon;
  if (n.includes('jusangjeolli') || n.includes('daepo') || n.includes('columnar')) return U.jusangjeolli;
  if (n.includes('camellia')) return U.camellia;
  if (n.includes('ilchul') || n.includes('micheon') || n.includes('lava tube') || n.includes('hueree')) return U.ilchulland;
  if (n.includes('bijarim')) return U.bijarim;
  if (n.includes('sangumburi')) return U.sangumburi;
  if (n.includes('aewol') || n.includes('handam')) return U.aewol;
  if (n.includes('dongmun')) return U.dongmun;
  if (n.includes('songaksan')) return U.hallasan;
  if (n.includes('jeonnong') || n.includes('noksan')) return U.seopjikoji;
  // Busan
  if (n.includes('bulguksa')) return U.bulguksa;
  if (n.includes('gamcheon')) return U.gamcheon;
  if (n.includes('jagalchi') || n.includes('nampo')) return U.jagalchi;
  if (n.includes('taejongdae')) return U.taejongdae;
  if (n.includes('haedong') || n.includes('yonggungsa')) return U.haedong;
  if (n.includes('cheongsapo') || n.includes('blue line')) return U.cheongsapo;
  if (n.includes('haeundae')) return U.haeundae;
  if (n.includes('un memorial') || n.includes('yongdusan') || n.includes('busan tower')) return U.yongdusan;
  if (n.includes('cheomseongdae')) return U.cheomseongdae;
  if (n.includes('daereungwon') || n.includes('tumuli') || n.includes('tomb complex')) return U.daereungwon;
  if (n.includes('gyochon') || (n.includes('hanok') && n.includes('gyeongju'))) return U.gyochon;
  if (n.includes('woljeonggyo')) return U.woljeonggyo;
  if (n.includes('ahopsan') || n.includes('bamboo forest')) return U.ahopsan;
  if (n.includes('tongdosa') || n.includes('jajangmae')) return U.tongdosa;
  if (n.includes('gyeongju') && n.includes('museum')) return U.gyeongju_museum;
  if (n.includes('bomun')) return U.cheomseongdae;
  // Seoul/Other
  if (n.includes('gyeongbokgung') || n.includes('gyeongbok')) return U.gyeongbokgung;
  if (n.includes('bukchon') || n.includes('insadong') || n.includes('gwangjang')) return U.gyeongbokgung;
  if (n.includes('nami island') || n.includes('namiseom')) return U.nami;
  if (n.includes('morning calm') || n.includes('achimgoyo')) return U.nami2;
  if (n.includes('petite france')) return U.petite_france;
  if (n.includes('starfield') || n.includes('coex')) return U.starfield;
  if (n.includes('gwangmyeong')) return U.gwangmyeong;
  if (n.includes('waujeongsa')) return U.waujeongsa;
  if ((n.includes('3rd') && n.includes('tunnel')) || n.includes('imjingak')) return U.dmz_tunnel;
  if (n.includes('dorasan') || n.includes('dora observatory')) return U.dorasan;
  if (n.includes('gamaksan') || (n.includes('suspension bridge'))) return U.dorasan;
  if (n.includes('seoraksan') || n.includes('sorak')) return U.sokcho;
  if (n.includes('sokcho')) return U.sokcho;
  if (n.includes('herb island')) return U.herb_island;
  if (n.includes('sanjeong')) return U.sanjeong;
  if (n.includes('art valley') || n.includes('pocheon art')) return U.art_valley;
  if (n.includes('suwon') || n.includes('hwaseong') || n.includes('haenggung')) return U.starfield;
  if (n.includes('korean folk village')) return U.gyochon;
  if (n.includes('namsan') || n.includes('n seoul tower')) return U.starfield;
  // Pickup / terminal / lunch — use product hero as context image
  if (fallback) return fallback;
  return null;
}

const dirs = fs.readdirSync(BASE).filter(d => {
  try { return fs.statSync(path.join(BASE, d)).isDirectory(); } catch { return false; }
});
let fixed = 0, total = 0;

for (const dir of dirs) {
  const fp = path.join(BASE, dir, dir + '.en.json');
  if (!fs.existsSync(fp)) continue;
  const raw = fs.readFileSync(fp, 'utf8');
  if (!raw.includes('unsplash')) continue;
  const j = JSON.parse(raw);
  const fallback = j.catalog_card?.heroImage;
  let changed = false;

  // Fix itinerary_variants stops
  if (Array.isArray(j.itinerary_variants)) {
    j.itinerary_variants.forEach(variant => {
      (variant.stops || []).forEach(stop => {
        if (!stop.image || stop.image.includes('unsplash')) {
          const img = matchStop(stop.name || '', fallback);
          if (img) { stop.image = img; total++; changed = true; }
        }
      });
    });
  }

  // Fix remaining page_sections itineraryStops
  if (Array.isArray(j.page_sections)) {
    j.page_sections.forEach(section => {
      const props = section.props;
      if (!props) return;
      (props.itineraryStops || []).forEach((stop, i) => {
        if (stop.image && stop.image.includes('unsplash')) {
          const topStop = j.itineraryStops && j.itineraryStops[i];
          if (topStop && topStop.image && !topStop.image.includes('unsplash')) {
            stop.image = topStop.image; changed = true;
          } else {
            const img = matchStop(stop.name || '', fallback);
            if (img) { stop.image = img; changed = true; }
          }
        }
      });
      // Also fix page_sections hero
      if (props.hero && props.hero.imageUrl && props.hero.imageUrl.includes('unsplash') && fallback) {
        props.hero.imageUrl = fallback; changed = true;
      }
    });
  }

  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
    fixed++;
    console.log('Fixed:', dir);
  }
}

console.log(`\nDone: ${fixed} files, ${total} itinerary_variant stops updated`);
