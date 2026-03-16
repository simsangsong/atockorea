/**
 * 제주도 대표 관광지·박물관·맛집 목록 (일괄 상세설명 생성·다국어 번역 시드용).
 * 관광지·폭포·박물관·테마파크 + 소홍서/틱톡/유튜브에서 자주 나오는 식당(흑돼지·고기국수·갈치구이 등).
 * id = 9000000 + (index + 1) 로 시드 시 사용.
 */
export interface JejuFamousPlace {
  name_ko: string;
  name_en: string;
  address_ko: string;
  address_en: string;
  /** 없으면 관광지(attraction)로 처리 */
  type?: 'attraction' | 'restaurant';
}

export const JEJU_FAMOUS_PLACES: JejuFamousPlace[] = [
  // === 자연·해변·산 ===
  {
    name_ko: '성산일출봉',
    name_en: 'Seongsan Ilchulbong Peak',
    address_ko: '제주특별자치도 서귀포시 성산읍 일출로 284-12',
    address_en: '284-12 Ilchul-ro, Seongsan-eup, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '섭지코지',
    name_en: 'Seopjikoji',
    address_ko: '제주특별자치도 서귀포시 성산읍 섭지코지로 107',
    address_en: '107 Seopjikoji-ro, Seongsan-eup, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '월정리 해수욕장',
    name_en: 'Woljeongri Beach',
    address_ko: '제주특별자치도 제주시 구좌읍 월정리',
    address_en: 'Woljeong-ri, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '산방산',
    name_en: 'Sanbangsan Mountain',
    address_ko: '제주특별자치도 서귀포시 안덕면 산방로 218',
    address_en: '218 Sanbang-ro, Andeok-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '협재해수욕장',
    name_en: 'Hyeopjae Beach',
    address_ko: '제주특별자치도 제주시 한림로 522',
    address_en: '522 Hallim-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '애월 한담거리',
    name_en: 'Aewol Handam Coastal Road',
    address_ko: '제주특별자치도 제주시 애월읍 애월로1길',
    address_en: 'Aewol-ro 1-gil, Aewol-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '우도',
    name_en: 'Udo Island',
    address_ko: '제주특별자치도 제주시 우도면',
    address_en: 'Udo-myeon, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '한라산',
    name_en: 'Hallasan Mountain',
    address_ko: '제주특별자치도 제주시 오등동 1100로 2070-61',
    address_en: '2070-61 1100-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '천지연폭포',
    name_en: 'Cheonjiyeon Waterfall',
    address_ko: '제주특별자치도 서귀포시 천지동 668',
    address_en: '668 Cheonji-dong, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '천제연폭포',
    name_en: 'Cheonjeyeon Waterfall',
    address_ko: '제주특별자치도 서귀포시 천제연로 132',
    address_en: '132 Cheonjeyeon-ro, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '정방폭포',
    name_en: 'Jungbang Falls',
    address_ko: '제주특별자치도 서귀포시 칠십리로214번길 37',
    address_en: '37 Chilsipniro 214beon-gil, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '엉덩물계곡',
    name_en: 'Eongttoemeori Valley',
    address_ko: '제주특별자치도 서귀포시 표선면 가시리',
    address_en: 'Gasi-ri, Pyoseon-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '주상절리대',
    name_en: 'Jusangjeolli Cliff',
    address_ko: '제주특별자치도 서귀포시 중문동 2767',
    address_en: '2767 Jungmun-dong, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '함덕해수욕장',
    name_en: 'Hamdeok Beach',
    address_ko: '제주특별자치도 제주시 조천읍 함덕리 1008',
    address_en: '1008 Hamdeok-ri, Jocheon-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '성읍민속마을',
    name_en: 'Seongeup Folk Village',
    address_ko: '제주특별자치도 서귀포시 표선면 성읍리',
    address_en: 'Seongeup-ri, Pyoseon-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '정부형제해안도로',
    name_en: 'Jeongbang and Hyungje Coastal Road',
    address_ko: '제주특별자치도 서귀포시 중문동 일대',
    address_en: 'Jungmun-dong, Seogwipo-si, Jeju-do, South Korea',
  },
  // === 박물관·테마파크 ===
  {
    name_ko: '오설록 티뮤지엄',
    name_en: "O'sulloc Tea Museum",
    address_ko: '제주특별자치도 서귀포시 안덕면 서광리 1235-3',
    address_en: '1235-3 Seogwang-ri, Andeok-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '카멜리아 힐',
    name_en: 'Camellia Hill',
    address_ko: '제주특별자치도 서귀포시 안덕면 병악로 166',
    address_en: '166 Byeongak-ro, Andeok-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '아르떼뮤지엄 제주',
    name_en: 'ARTE Museum Jeju',
    address_ko: '제주특별자치도 제주시 애월읍 널리 478',
    address_en: '478 Nelli, Aewol-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '아쿠아플라넷 제주',
    name_en: 'Aqua Planet Jeju',
    address_ko: '제주특별자치도 서귀포시 성산읍 섭지코지로 95',
    address_en: '95 Seopjikoji-ro, Seongsan-eup, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '스누피가든',
    name_en: 'Snoopy Garden',
    address_ko: '제주특별자치도 제주시 구좌읍 금백조로 930',
    address_en: '930 Geumbaekjo-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '헬로키티아일랜드',
    name_en: 'Hello Kitty Island',
    address_ko: '제주특별자치도 서귀포시 안덕면 한창로 340',
    address_en: '340 Hanchang-ro, Andeok-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '제주 자동차박물관',
    name_en: 'Jeju Automobile Museum',
    address_ko: '제주특별자치도 제주시 한림로 1618',
    address_en: '1618 Hallim-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '제주 피규어박물관',
    name_en: 'Jeju Figure Museum',
    address_ko: '제주특별자치도 서귀포시 안덕면 창천중앙로 142',
    address_en: '142 Changcheonjungang-ro, Andeok-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '제주 러브랜드',
    name_en: 'Jeju Loveland',
    address_ko: '제주특별자치도 제주시 1100로 2894-72',
    address_en: '2894-72 1100-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '노형수퍼마켙',
    name_en: 'Nohyeong Supermarket',
    address_ko: '제주특별자치도 제주시 노형로 89',
    address_en: '89 Nohyeong-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '제주 수목원테마파크',
    name_en: 'Jeju Soopjwaeni Teul Park',
    address_ko: '제주특별자치도 서귀포시 표선면 돈오름로 170',
    address_en: '170 Donoreum-ro, Pyoseon-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '휴애리 자연생활공원',
    name_en: 'Hyeopjae Hueree Nature Park',
    address_ko: '제주특별자치도 서귀포시 남원로 256',
    address_en: '256 Namwon-ro, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '이호테우해변',
    name_en: 'Iho Tewoo Beach',
    address_ko: '제주특별자치도 제주시 이호일동',
    address_en: 'Iho 1-dong, Jeju-si, Jeju-do, South Korea',
  },
  // === 흑돼지·고기국수·갈치 등 맛집 (소홍서·틱톡·유튜브 인기) ===
  {
    name_ko: '큰돈가 본점',
    type: 'restaurant',
    name_en: 'Keundonga (Black Pork)',
    address_ko: '제주특별자치도 서귀포시 대정읍 형제해안로 296',
    address_en: '296 Hyeongjehaean-ro, Daejeong-eup, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '중문흑돼지천국',
    type: 'restaurant',
    name_en: 'Jungmun Heukdoeji Cheonguk',
    address_ko: '제주특별자치도 서귀포시 색달동',
    address_en: 'Saekdal-dong, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '표돈가',
    type: 'restaurant',
    name_en: 'Pyodonga (Black Pork)',
    address_ko: '제주특별자치도 서귀포시 표선면',
    address_en: 'Pyoseon-myeon, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '작제도 흑돼지 장작구이',
    type: 'restaurant',
    name_en: 'Jakjedo Heukdoeji (Charcoal Grill)',
    address_ko: '제주특별자치도 제주시 연북로 840',
    address_en: '840 Yeonbuk-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '고씨네 천지국수',
    type: 'restaurant',
    name_en: 'Gossinae Cheonji Guksu (Meat Noodle)',
    address_ko: '제주특별자치도 서귀포시 중앙로79번길 4',
    address_en: '4 Jungang-ro 79beon-gil, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '갈치공장',
    type: 'restaurant',
    name_en: 'Galchi Gongjang (Grilled Cutlass Fish)',
    address_ko: '제주특별자치도 제주시 구좌읍 해맞이해안로 1296',
    address_en: '1296 Haemaji haean-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '만족한상회',
    type: 'restaurant',
    name_en: 'Manjok Hansanghoe (Galchi)',
    address_ko: '제주특별자치도 서귀포시 중문상로 58-5',
    address_en: '58-5 Jungmunsang-ro, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '뚱보아저씨',
    type: 'restaurant',
    name_en: 'Ttungbo Ajeossi (Galchi Set)',
    address_ko: '제주특별자치도 제주시 한경면 중산간서로 3651',
    address_en: '3651 Jungsanganseo-ro, Hangyeong-myeon, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '명리동식당 구좌점',
    type: 'restaurant',
    name_en: 'Myeongridong Sikdang Gujwa',
    address_ko: '제주특별자치도 제주시 구좌읍 일주동로 3010-17',
    address_en: '3010-17 Iljudong-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '올레시장',
    name_en: 'Olle Market',
    address_ko: '제주특별자치도 서귀포시 중앙로62번길 18',
    address_en: '18 Jungang-ro 62beon-gil, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '동문재래시장',
    name_en: 'Dongmun Traditional Market',
    address_ko: '제주특별자치도 제주시 관덕로14길 20',
    address_en: '20 Gwandeok-ro 14-gil, Jeju-si, Jeju-do, South Korea',
  },
  // === 액티비티 (레일바이크·9.81·잠수함·난타·요트 등) ===
  {
    name_ko: '제주 레일바이크',
    name_en: 'Jeju Rail Park',
    address_ko: '제주특별자치도 제주시 구좌읍 용눈이오름로 641',
    address_en: '641 Yongnunioreum-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '9.81 파크',
    name_en: '9.81 Park Jeju',
    address_ko: '제주특별자치도 제주시 애월읍 천덕로 880-24',
    address_en: '880-24 Cheondeok-ro, Aewol-eup, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '서귀포잠수함',
    name_en: 'Seogwipo Submarine',
    address_ko: '제주특별자치도 서귀포시 남성중로 40',
    address_en: '40 Namseongjung-ro, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '난타 제주',
    name_en: 'NANTA Theatre Jeju',
    address_ko: '제주특별자치도 제주시 선돌목동길 56-26',
    address_en: '56-26 Seondolmongdong-gil, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: 'M1971',
    name_en: 'M1971 Yacht & Cafe',
    address_ko: '제주특별자치도 서귀포시 대정읍 최남단해안로 128',
    address_en: '128 Choenamdanhaean-ro, Daejeong-eup, Seogwipo-si, Jeju-do, South Korea',
  },
  // === 고지·해안도로·전망 ===
  {
    name_ko: '1100고지',
    name_en: '1100 Highland',
    address_ko: '제주특별자치도 서귀포시 1100로 1555',
    address_en: '1555 1100-ro, Seogwipo-si, Jeju-do, South Korea',
  },
  {
    name_ko: '어승생악',
    name_en: 'Eoseungsaengak',
    address_ko: '제주특별자치도 제주시 1100로 2070-61',
    address_en: '2070-61 1100-ro, Jeju-si, Jeju-do, South Korea',
  },
  {
    name_ko: '신창해안도로',
    name_en: 'Sinchang Coastal Road',
    address_ko: '제주특별자치도 제주시 한경면 신창리 1322-1',
    address_en: '1322-1 Sinchang-ri, Hangyeong-myeon, Jeju-si, Jeju-do, South Korea',
  },
  // === SNS 인기 카페 (런던베이글·레이어드·봄날·트라이브 등) ===
  {
    name_ko: '런던베이글 뮤지엄 제주',
    name_en: 'London Bagel Museum Jeju',
    address_ko: '제주특별자치도 제주시 구좌읍 동복로 85',
    address_en: '85 Dongbok-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '레이어드 제주',
    name_en: 'Cafe Layered Jeju',
    address_ko: '제주특별자치도 제주시 구좌읍 동복로 85',
    address_en: '85 Dongbok-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '봄날카페',
    name_en: 'Bomnal Cafe',
    address_ko: '제주특별자치도 제주시 애월읍 애월로1길 25',
    address_en: '25 Aewol-ro 1-gil, Aewol-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '트라이브 제주',
    name_en: 'Tribe Cafe Jeju',
    address_ko: '제주특별자치도 제주시 애월읍 애월로 11',
    address_en: '11 Aewol-ro, Aewol-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '머문',
    name_en: 'Meomun Cafe',
    address_ko: '제주특별자치도 제주시 애월읍 애월북서길 54',
    address_en: '54 Aewolbukseo-gil, Aewol-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '클로징 디너',
    name_en: 'Closing Dinner',
    address_ko: '제주특별자치도 제주시 구좌읍 해맞이해안로 1280',
    address_en: '1280 Haemaji haean-ro, Gujwa-eup, Jeju-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
  {
    name_ko: '비밀의숲',
    name_en: 'Secret Forest Cafe',
    address_ko: '제주특별자치도 서귀포시 표선면 번영로 2350',
    address_en: '2350 Beonyeong-ro, Pyoseon-myeon, Seogwipo-si, Jeju-do, South Korea',
    type: 'restaurant',
  },
];

/** 시드용 place id 시작 번호 (Tour API contentid와 충돌 방지) */
export const SEED_PLACE_ID_START = 9_000_001;
