// Update all 30 tour product JSONs with verified Korean tourism CDN images
const fs = require('fs'), path = require('path');
const BASE = 'components/product-tour-static';

const U = {
  // JEJU — api.cdn.visitjeju.net (verified webp)
  seongsan:    'https://api.cdn.visitjeju.net/photomng/imgpath/202409/20/c8bf6191-832c-4605-a948-96f07f6112d2.webp',
  seongsan2:   'https://api.cdn.visitjeju.net/photomng/imgpath/201810/17/654ec69c-ca81-443d-9b10-3cfe4a8e98f0.webp',
  seongsan3:   'https://api.cdn.visitjeju.net/photomng/imgpath/201810/17/41209f96-3700-4de3-8545-347a602229e2.webp',
  manjanggul:  'https://api.cdn.visitjeju.net/photomng/imgpath/202110/28/a08aea81-f7f3-44b6-92e4-bd0ddb6aec7b.webp',
  manjanggul2: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/e2ca5a48-b184-4122-a527-6d1de8dbaca5.webp',
  stone_park:  'https://api.cdn.visitjeju.net/photomng/imgpath/202408/21/8d0c970f-fb33-48ad-bb54-93725db7c7b4.webp',
  stone_park2: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/a274f46a-9174-440e-bd26-0efc7c033de6.webp',
  hamdeok:     'https://api.cdn.visitjeju.net/photomng/imgpath/202408/20/a397a498-7bc9-4730-963a-cfa29ccffe7d.webp',
  hamdeok2:    'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/f4bb8c53-a598-4523-a34b-e591aa0f0a0e.webp',
  seongeup:    'https://api.cdn.visitjeju.net/photomng/imgpath/202409/06/cf7e9f6b-178f-4d3d-b978-91beb5145a10.webp',
  seongeup2:   'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/e2b4d6b0-a186-4e7d-9b8b-34eb9fbc8a07.webp',
  seopjikoji:  'https://api.cdn.visitjeju.net/photomng/imgpath/202408/16/9df6665f-e0cf-4b8a-8d1c-2ec895745448.webp',
  seopjikoji2: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/46437f2d-5fe9-4360-9c4b-5535cd8ef160.webp',
  hallasan:    'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/6a754887-ab09-410f-ad9d-9340571e4248.webp',
  hallasan2:   'https://api.cdn.visitjeju.net/photomng/imgpath/201911/29/e3c71fe7-73e8-408f-aab7-a12d7d1e51d8.webp',
  osulloc:     'https://api.cdn.visitjeju.net/photomng/imgpath/202110/20/003f420c-6efe-41e9-93b7-00fe6ac5e83b.webp',
  osulloc2:    'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/f6013428-bfe1-455b-9f7f-73a5e6f5221c.webp',
  hyeopjae:    'https://api.cdn.visitjeju.net/photomng/imgpath/202408/27/77cf6bb2-4d0d-4f46-8cfa-3f527a4d06b3.webp',
  hyeopjae2:   'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/1884a0df-e6cf-4e67-9a18-5e1b6169cff0.webp',
  jeju_folk:   'https://api.cdn.visitjeju.net/photomng/imgpath/202407/08/b136ca14-3983-4574-a81c-5f8808df56e5.webp',
  jeju_folk2:  'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/a03e9ce4-1c94-4993-bb1d-47a746a9e689.webp',
  cheonjeyeon: 'https://api.cdn.visitjeju.net/photomng/imgpath/202110/27/617daa5f-d818-47c1-b80d-59f45e96371b.webp',
  cheonjeyeon2:'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/a40a1dc3-ab78-4717-9e13-d5bb8122d9af.webp',
  jusangjeolli:'https://api.cdn.visitjeju.net/photomng/imgpath/202410/21/1690de57-e791-4712-84e9-3963a82de0f1.webp',
  jusangjeolli2:'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/032bae0a-aecb-433c-bba8-cf3143d4b134.webp',
  bijarim:     'https://api.cdn.visitjeju.net/photomng/imgpath/202410/16/a6f2d974-bf5b-4e5a-baf6-ff9a3e686015.webp',
  camellia:    'https://api.cdn.visitjeju.net/photomng/imgpath/202410/15/fb2d2739-5e8e-4a87-9d1d-0281d95efeb7.webp',
  camellia2:   'https://api.cdn.visitjeju.net/photomng/imgpath/202002/26/6504f907-d5cd-4aa5-9477-402da1e60143.webp',
  udo:         'https://api.cdn.visitjeju.net/photomng/imgpath/202408/21/a5e290f2-dd50-44b8-a5e1-ef52991520d3.webp',
  ilchulland:  'https://api.cdn.visitjeju.net/photomng/imgpath/202207/14/4bcd710c-1b9c-46a2-8d52-d41907853ded.webp',
  ilchulland2: 'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/982d17ac-791d-443d-b9a4-12d4cf81f7c9.webp',
  sangumburi:  'https://api.cdn.visitjeju.net/photomng/imgpath/202110/20/df1ae123-1c90-4ef4-a502-4053c2e60dc2.webp',
  aewol:       'https://api.cdn.visitjeju.net/photomng/imgpath/202110/25/dae5f548-d5de-41e8-b47b-37490c5238ad.webp',
  aewol2:      'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/2fc1d5d9-d5af-43a1-ae26-c72afa3b544e.webp',
  dongmun:     'https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/5dabd625-523b-48c7-9b02-35ac1e3bd741.webp',
  // BUSAN / GYEONGJU — tong.visitkorea.or.kr (verified JPG)
  gamcheon:    'https://tong.visitkorea.or.kr/cms/resource/25/1925825_image2_1.JPG',
  jagalchi:    'https://tong.visitkorea.or.kr/cms/resource/16/2356516_image2_1.JPG',
  taejongdae:  'https://tong.visitkorea.or.kr/cms/resource/24/3083924_image2_1.JPG',
  taejongdae2: 'https://tong.visitkorea.or.kr/cms/resource/59/2618959_image2_1.JPG',
  yongdusan:   'https://tong.visitkorea.or.kr/cms/resource/64/2608964_image2_1.JPG',
  haedong:     'https://tong.visitkorea.or.kr/cms/resource/03/2592103_image2_1.JPG',
  haeundae:    'https://tong.visitkorea.or.kr/cms/resource/29/2617829_image2_1.JPG',
  gwangalli:   'https://tong.visitkorea.or.kr/cms/resource/89/3080589_image2_1.JPG',
  cheongsapo:  'https://tong.visitkorea.or.kr/cms/resource/61/2702561_image2_1.JPG',
  busan_port:  'https://tong.visitkorea.or.kr/cms/resource/08/2505108_image2_1.JPG',
  bulguksa:    'https://tong.visitkorea.or.kr/cms/resource/26/3083926_image2_1.JPG',
  bulguksa2:   'https://tong.visitkorea.or.kr/cms/resource/25/3083925_image2_1.JPG',
  seokguram:   'https://tong.visitkorea.or.kr/cms/resource/37/2496537_image2_1.JPG',
  cheomseongdae:'https://tong.visitkorea.or.kr/cms/resource/87/2661487_image2_1.JPG',
  daereungwon: 'https://tong.visitkorea.or.kr/cms/resource/16/2565716_image2_1.JPG',
  gyeongju_museum:'https://tong.visitkorea.or.kr/cms/resource/00/2024200_image2_1.JPG',
  gyochon:     'https://tong.visitkorea.or.kr/cms/resource/62/2477062_image2_1.JPG',
  woljeonggyo: 'https://tong.visitkorea.or.kr/cms/resource/49/2390749_image2_1.JPG',
  ahopsan:     'https://tong.visitkorea.or.kr/cms/resource/23/2028423_image2_1.JPG',
  tongdosa:    'https://tong.visitkorea.or.kr/cms/resource/87/2748787_image2_1.JPG',
  // SEOUL / OTHER — tong.visitkorea.or.kr (verified JPG)
  gyeongbokgung: 'https://tong.visitkorea.or.kr/cms/resource/06/2735806_image2_1.JPG',
  gyeongbokgung2:'https://tong.visitkorea.or.kr/cms/resource/15/2002115_image2_1.JPG',
  nami:        'https://tong.visitkorea.or.kr/cms/resource/94/2614694_image2_1.JPG',
  nami2:       'https://tong.visitkorea.or.kr/cms/resource/27/2380427_image2_1.JPG',
  petite_france:'https://tong.visitkorea.or.kr/cms/resource/06/2510006_image2_1.JPG',
  starfield:   'https://tong.visitkorea.or.kr/cms/resource/29/2005629_image2_1.JPG',
  starfield2:  'https://tong.visitkorea.or.kr/cms/resource/19/2598719_image2_1.JPG',
  gwangmyeong: 'https://tong.visitkorea.or.kr/cms/resource/48/2493748_image2_1.JPG',
  waujeongsa:  'https://tong.visitkorea.or.kr/cms/resource/56/2536656_image2_1.JPG',
  waujeongsa2: 'https://tong.visitkorea.or.kr/cms/resource/44/1997644_image2_1.JPG',
  dmz_tunnel:  'https://tong.visitkorea.or.kr/cms/resource/03/2493203_image2_1.JPG',
  dorasan:     'https://tong.visitkorea.or.kr/cms/resource/98/1977698_image2_1.JPG',
  sokcho:      'https://tong.visitkorea.or.kr/cms/resource/01/2365701_image2_1.JPG',
  sokcho2:     'https://tong.visitkorea.or.kr/cms/resource/93/2375893_image2_1.JPG',
  herb_island: 'https://tong.visitkorea.or.kr/cms/resource/46/2513346_image2_1.JPG',
  sanjeong:    'https://tong.visitkorea.or.kr/cms/resource/94/1925694_image2_1.JPG',
  sanjeong2:   'https://tong.visitkorea.or.kr/cms/resource/01/2791401_image2_1.JPG',
  art_valley:  'https://tong.visitkorea.or.kr/cms/resource/91/2618591_image2_1.JPG',
};

function matchStop(name) {
  const n = name.toLowerCase();
  if (n.includes('seongsan') || n.includes('ilchulbong')) return U.seongsan;
  if (n.includes('manjanggul')) return U.manjanggul;
  if (n.includes('stone park') || n.includes('dolmunhwa')) return U.stone_park;
  if (n.includes('hamdeok')) return U.hamdeok;
  if (n.includes('seongeup') || (n.includes('folk village') && (n.includes('jeju') || n.includes('seongeup')))) return U.seongeup;
  if (n.includes('seopjikoji') || n.includes('east cape')) return U.seopjikoji;
  if (n.includes('hallasan') || n.includes('eoseungsaengak') || n.includes('eorimok') || n.includes('1100 altitude')) return U.hallasan;
  if (n.includes('osulloc') || n.includes('sulloc') || n.includes('tea museum') || n.includes('tea field')) return U.osulloc;
  if (n.includes('hyeopjae') || n.includes('hallim park')) return U.hyeopjae;
  if (n.includes('haenyeo')) return U.jeju_folk;
  if (n.includes('jeju folk') || n.includes('jeju민속윀')) return U.jeju_folk;
  if (n.includes('cheonjeyeon') || n.includes('pond of the gods') || n.includes('jeongbang') || (n.includes('waterfall') && n.includes('jeju'))) return U.cheonjeyeon;
  if (n.includes('jusangjeolli') || n.includes('daepo') || n.includes('columnar')) return U.jusangjeolli;
  if (n.includes('bijarim')) return U.bijarim;
  if (n.includes('camellia')) return U.camellia;
  if (n.includes('udo')) return U.udo;
  if (n.includes('ilchul') || n.includes('micheon') || n.includes('michon') || n.includes('lava tube') || n.includes('hueree')) return U.ilchulland;
  if (n.includes('sangumburi')) return U.sangumburi;
  if (n.includes('aewol') || n.includes('handam')) return U.aewol;
  if (n.includes('dongmun')) return U.dongmun;
  if (n.includes('songaksan')) return U.hallasan;
  if (n.includes('jeonnong') || n.includes('noksan') || (n.includes('cherry') && n.includes('jeju'))) return U.seopjikoji;
  // Busan
  if (n.includes('gamcheon')) return U.gamcheon;
  if (n.includes('jagalchi') || n.includes('nampo')) return U.jagalchi;
  if (n.includes('taejongdae')) return U.taejongdae;
  if (n.includes('yongdusan') || n.includes('busan tower')) return U.yongdusan;
  if (n.includes('haedong') || n.includes('yonggungsa')) return U.haedong;
  if (n.includes('cheongsapo') || n.includes('blue line')) return U.cheongsapo;
  if (n.includes('haeundae')) return U.haeundae;
  if (n.includes('gwangalli')) return U.gwangalli;
  if (n.includes('un memorial') || n.includes('united nations')) return U.yongdusan;
  if (n.includes('busan port') || (n.includes('cruise terminal') && n.includes('busan'))) return U.busan_port;
  // Gyeongju
  if (n.includes('bulguksa')) return U.bulguksa;
  if (n.includes('seokguram')) return U.seokguram;
  if (n.includes('cheomseongdae')) return U.cheomseongdae;
  if (n.includes('daereungwon') || n.includes('tumuli') || n.includes('tomb complex')) return U.daereungwon;
  if ((n.includes('gyeongju') && n.includes('museum')) || (n.includes('national museum') && n.includes('gyeongju'))) return U.gyeongju_museum;
  if (n.includes('gyochon') || (n.includes('hanok village') && n.includes('gyeongju'))) return U.gyochon;
  if (n.includes('woljeonggyo')) return U.woljeonggyo;
  if (n.includes('ahopsan') || n.includes('bamboo forest')) return U.ahopsan;
  if (n.includes('tongdosa') || n.includes('jajangmae') || n.includes('plum tree')) return U.tongdosa;
  if (n.includes('bomun')) return U.cheomseongdae;
  if (n.includes('anapji') || n.includes('donggung') || n.includes('wolji')) return U.daereungwon;
  // Seoul / Other
  if (n.includes('gyeongbokgung') || n.includes('gyeongbok')) return U.gyeongbokgung;
  if (n.includes('bukchon') || n.includes('insadong') || n.includes('gwangjang')) return U.gyeongbokgung;
  if (n.includes('namsan') || n.includes('n seoul tower')) return U.starfield;
  if (n.includes('nami island') || n.includes('namiseom')) return U.nami;
  if (n.includes('morning calm') || n.includes('achimgoyo')) return U.nami2;
  if (n.includes('petite france')) return U.petite_france;
  if (n.includes('starfield') || n.includes('coex')) return U.starfield;
  if (n.includes('gwangmyeong') || n.includes('gwangmyung')) return U.gwangmyeong;
  if (n.includes('waujeongsa') || n.includes('waujeong')) return U.waujeongsa;
  if (((n.includes('3rd') || n.includes('third')) && n.includes('tunnel')) || n.includes('infiltration tunnel')) return U.dmz_tunnel;
  if (n.includes('imjingak')) return U.dmz_tunnel;
  if (n.includes('dora observatory') || n.includes('dorasan')) return U.dorasan;
  if (n.includes('gamaksan') || (n.includes('suspension bridge') && n.includes('dmz'))) return U.dorasan;
  if (n.includes('seoraksan') || n.includes('sorak')) return U.sokcho;
  if (n.includes('sokcho')) return U.sokcho;
  if (n.includes('herb island') || n.includes('pocheon herb')) return U.herb_island;
  if (n.includes('sanjeong') || n.includes('산정호수')) return U.sanjeong;
  if (n.includes('art valley') || n.includes('아트밸리') || n.includes('pocheon art')) return U.art_valley;
  if (n.includes('suwon') || n.includes('hwaseong') || n.includes('haenggung')) return U.starfield;
  if (n.includes('korean folk village') || n.includes('민속윀')) return U.gyochon;
  return null;
}

const HERO = {
  'busan-gyeongju-unesco-legacy-tour-national-museum': U.bulguksa,
  'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju': U.tongdosa,
  'busan-private-car-charter-cruise-shore': U.gamcheon,
  'busan-small-group-sightseeing-tour-cruise-passengers': U.haedong,
  'busan-spring-cherry-blossom-gyeongju-highlights-day-tour': U.bulguksa,
  'busan-top-attractions-day-tour': U.haedong,
  'east-signature-nature-core': U.seongsan,
  'from-busan-gyeongju-ancient-capital-day-tour': U.bulguksa,
  'from-incheon-seoul-day-tour-cruise-guests': U.gyeongbokgung,
  'incheon-seoul-private-car-shore-excursion-cruise': U.gyeongbokgung,
  'jeju-cherry-blossom-tour-east-route': U.seongsan2,
  'jeju-cruise-shore-excursion-bus-tour': U.seongsan,
  'jeju-cruise-shore-excursion-small-group-tour': U.seongsan,
  'jeju-eastern-unesco-spots-day-tour': U.seongsan,
  'jeju-grand-highlights-loop': U.jusangjeolli,
  'jeju-hydrangea-festival-tour-east-route': U.seongsan,
  'jeju-hydrangea-festival-tour-southwest-route': U.hyeopjae,
  'jeju-island-private-car-charter-tour': U.seongsan,
  'jeju-southern-top-unesco-spots-tour': U.cheonjeyeon,
  'jeju-west-south-full-day-authentic-tour': U.hallasan,
  'jeju-winter-southwest-tangerine-snow-camellia-tour': U.hallasan,
  'pocheon-sanjeong-lake-herb-island-art-valley': U.herb_island,
  'seoul-dmz-private-3rd-tunnel-suspension-bridge': U.dmz_tunnel,
  'seoul-private-nami-morning-calm-petite-france': U.nami,
  'seoul-seoraksan-national-park-sokcho-beach-day-trip': U.sokcho,
  'seoul-suburbs-private-chartered-car-10hr': U.gyeongbokgung,
  'seoul-suwon-hwaseong-folk-village-starfield-library': U.starfield,
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library': U.gwangmyeong,
  'seoul-suwon-hwaseong-waujeongsa-starfield': U.waujeongsa,
  'southwest-hallasan-osulloc-aewol': U.aewol,
};

const POOL = {
  'busan-gyeongju-unesco-legacy-tour-national-museum': [U.bulguksa, U.ahopsan, U.gyeongju_museum, U.gyochon, U.woljeonggyo, U.bulguksa2, U.seokguram],
  'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju': [U.tongdosa, U.bulguksa, U.cheomseongdae, U.daereungwon, U.woljeonggyo, U.bulguksa2],
  'busan-private-car-charter-cruise-shore': [U.gamcheon, U.taejongdae, U.yongdusan, U.jagalchi, U.haedong, U.cheongsapo, U.haeundae],
  'busan-small-group-sightseeing-tour-cruise-passengers': [U.haedong, U.gamcheon, U.taejongdae, U.jagalchi, U.yongdusan, U.cheongsapo],
  'busan-spring-cherry-blossom-gyeongju-highlights-day-tour': [U.bulguksa, U.cheomseongdae, U.daereungwon, U.bulguksa2, U.gyochon, U.woljeonggyo],
  'busan-top-attractions-day-tour': [U.haedong, U.cheongsapo, U.gamcheon, U.jagalchi, U.yongdusan, U.haeundae],
  'east-signature-nature-core': [U.seongsan, U.seopjikoji, U.stone_park, U.ilchulland, U.seongeup, U.hamdeok],
  'from-busan-gyeongju-ancient-capital-day-tour': [U.bulguksa, U.ahopsan, U.gyeongju_museum, U.gyochon, U.woljeonggyo, U.bulguksa2],
  'from-incheon-seoul-day-tour-cruise-guests': [U.gyeongbokgung, U.gyeongbokgung2, U.nami, U.petite_france, U.starfield],
  'incheon-seoul-private-car-shore-excursion-cruise': [U.gyeongbokgung, U.gyeongbokgung2, U.starfield, U.nami, U.petite_france, U.gwangmyeong],
  'jeju-cherry-blossom-tour-east-route': [U.seongsan2, U.seopjikoji, U.ilchulland, U.seongeup, U.hamdeok, U.seongsan3],
  'jeju-cruise-shore-excursion-bus-tour': [U.seongsan, U.seopjikoji, U.seongeup, U.hamdeok, U.seongsan2, U.stone_park],
  'jeju-cruise-shore-excursion-small-group-tour': [U.seongsan, U.seopjikoji, U.seongeup, U.hamdeok, U.seongsan2, U.ilchulland],
  'jeju-eastern-unesco-spots-day-tour': [U.seongsan, U.hamdeok, U.seongeup, U.ilchulland, U.jeju_folk, U.seongsan2],
  'jeju-grand-highlights-loop': [U.jusangjeolli, U.seongsan, U.hallasan, U.cheonjeyeon, U.osulloc, U.camellia],
  'jeju-hydrangea-festival-tour-east-route': [U.seongsan, U.hamdeok, U.seongeup, U.ilchulland, U.seongsan2, U.seopjikoji],
  'jeju-hydrangea-festival-tour-southwest-route': [U.hyeopjae, U.jusangjeolli, U.cheonjeyeon, U.camellia, U.osulloc, U.aewol],
  'jeju-island-private-car-charter-tour': [U.seongsan, U.hallasan, U.hyeopjae, U.osulloc, U.camellia, U.seopjikoji],
  'jeju-southern-top-unesco-spots-tour': [U.cheonjeyeon, U.hallasan, U.jusangjeolli, U.osulloc, U.camellia, U.hallasan2],
  'jeju-west-south-full-day-authentic-tour': [U.hallasan, U.jusangjeolli, U.cheonjeyeon, U.osulloc, U.hyeopjae, U.camellia],
  'jeju-winter-southwest-tangerine-snow-camellia-tour': [U.hallasan, U.camellia, U.jusangjeolli, U.cheonjeyeon, U.osulloc, U.hallasan2],
  'pocheon-sanjeong-lake-herb-island-art-valley': [U.herb_island, U.sanjeong, U.art_valley, U.sanjeong2, U.nami],
  'seoul-dmz-private-3rd-tunnel-suspension-bridge': [U.dmz_tunnel, U.dorasan, U.dmz_tunnel, U.gyeongbokgung, U.nami],
  'seoul-private-nami-morning-calm-petite-france': [U.nami, U.nami2, U.petite_france, U.starfield, U.gyeongbokgung],
  'seoul-seoraksan-national-park-sokcho-beach-day-trip': [U.sokcho, U.sokcho2, U.nami, U.gyeongbokgung, U.sokcho],
  'seoul-suburbs-private-chartered-car-10hr': [U.gyeongbokgung, U.nami, U.petite_france, U.starfield, U.gwangmyeong],
  'seoul-suwon-hwaseong-folk-village-starfield-library': [U.starfield, U.starfield2, U.gyochon, U.gyeongbokgung, U.nami],
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library': [U.gwangmyeong, U.starfield, U.starfield2, U.waujeongsa, U.gyeongbokgung, U.nami],
  'seoul-suwon-hwaseong-waujeongsa-starfield': [U.waujeongsa, U.waujeongsa2, U.starfield, U.gyeongbokgung, U.nami],
  'southwest-hallasan-osulloc-aewol': [U.aewol, U.aewol2, U.hallasan, U.osulloc, U.jusangjeolli, U.cheonjeyeon],
};

const dirs = fs.readdirSync(BASE).filter(d => {
  try { return fs.statSync(path.join(BASE, d)).isDirectory(); } catch { return false; }
});

let updated = 0, stopTotal = 0, galleryTotal = 0;

for (const dir of dirs) {
  const fp = path.join(BASE, dir, dir + '.en.json');
  if (!fs.existsSync(fp)) continue;
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const hero = HERO[dir];
  const pool = POOL[dir] || [];
  let changed = false;

  // Hero / OG / thumbnail
  if (hero) {
    if (j.catalog_card) { j.catalog_card.heroImage = hero; j.catalog_card.thumbnail = hero; }
    if (j.hero) j.hero.imageUrl = hero;
    if (j.seo) j.seo.ogImage = hero;
    changed = true;
  }

  // Gallery items
  if (pool.length && j.galleryItems && j.galleryItems.length) {
    j.galleryItems.forEach((item, i) => { item.src = pool[i % pool.length]; galleryTotal++; });
    changed = true;
  }

  // Itinerary stop images
  if (j.itineraryStops) {
    j.itineraryStops.forEach(s => {
      const img = matchStop(s.name || '');
      if (img) { s.image = img; stopTotal++; changed = true; }
    });
  }

  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
    updated++;
    console.log('✓', dir);
  }
}

console.log(`\nDone — ${updated} files updated | ${stopTotal} stop images | ${galleryTotal} gallery images`);
