import { readFileSync, writeFileSync } from "node:fs";

const SHELVES = {
  en: {
    editorsPick: { title: "Editor’s Pick", subtitle: "The trips our team books for their own families." },
    cruiseShoreExcursion: { title: "Cruise Shore Excursion", subtitle: "Ship-to-tour day routes from Busan, Incheon, and Jeju ports." },
    smallGroup: { title: "Small Group", subtitle: "Shared vans, calmer pace, no bus-tour stops." },
    private: { title: "Private Charter", subtitle: "Your own car, your own driver-guide, your own route." },
    classicBus: { title: "Classic Bus Tour", subtitle: "Large-coach value tours covering signature stops." },
    nowSeasonal: {
      camellia: { title: "Now in Season — Camellia", subtitle: "Jeju’s winter red-bloom window (Dec 15 – Feb 15)." },
      plum: { title: "Now in Season — Plum Blossom", subtitle: "Late-February to mid-March red plum (Yangsan, Tongdosa)." },
      cherry: { title: "Now in Season — Cherry Blossom", subtitle: "Late-March to early-April Gyeongju + Busan bloom window." },
      hydrangea: { title: "Now in Season — Hydrangea", subtitle: "Jeju’s mid-May to mid-July blue-bloom window." },
      maple: { title: "Now in Season — Autumn Foliage", subtitle: "Mid-October to mid-November Seoraksan & Gangwon foliage." },
      "pink-muhly": { title: "Now in Season — Pink Muhly", subtitle: "Late-September to late-October pink-muhly grass." },
    },
    comingSoon: {
      camellia: { title: "Coming Soon — Camellia", subtitle: "Opens Dec 15. Booking accepted now for Jeju winter routes." },
      plum: { title: "Coming Soon — Plum Blossom", subtitle: "Opens Feb 25. Yangsan + Gyeongju spring bloom." },
      cherry: { title: "Coming Soon — Cherry Blossom", subtitle: "Opens Mar 28. Busan + Gyeongju spring routes." },
      hydrangea: { title: "Coming Soon — Hydrangea", subtitle: "Opens May 15. Jeju east + southwest blue-bloom routes." },
      maple: { title: "Coming Soon — Autumn Foliage", subtitle: "Opens Oct 15. Seoraksan & Gangwon fall foliage routes." },
      "pink-muhly": { title: "Coming Soon — Pink Muhly", subtitle: "Opens Sep 30. Pink-muhly grass photo routes." },
    },
  },
  ko: {
    editorsPick: { title: "에디터스 픽", subtitle: "저희 팀이 직접 가족과 함께 가는 투어들." },
    cruiseShoreExcursion: { title: "크루즈 쇼어 익스커션", subtitle: "부산·인천·제주 크루즈 터미널에서 출발하는 하루 투어." },
    smallGroup: { title: "스몰 그룹", subtitle: "공유 밴, 여유로운 페이스, 대형 관광버스 코스 없음." },
    private: { title: "프라이빗 차터", subtitle: "나만의 차량, 전담 가이드, 나만의 동선." },
    classicBus: { title: "클래식 버스 투어", subtitle: "대형 코치로 시그니처 명소를 도는 가성비 투어." },
    nowSeasonal: {
      camellia: { title: "지금 시즌 — 동백", subtitle: "제주 겨울 동백 시즌 (12.15 – 2.15)." },
      plum: { title: "지금 시즌 — 매화", subtitle: "양산 통도사·경주 일대 2월 말 – 3월 중순 홍매화." },
      cherry: { title: "지금 시즌 — 벚꽃", subtitle: "3월 말 – 4월 초 경주·부산 벚꽃 시즌." },
      hydrangea: { title: "지금 시즌 — 수국", subtitle: "제주 동쪽·남서쪽 5월 중순 – 7월 중순 수국 시즌." },
      maple: { title: "지금 시즌 — 단풍", subtitle: "10월 중순 – 11월 중순 설악산·강원 단풍 시즌." },
      "pink-muhly": { title: "지금 시즌 — 핑크뮬리", subtitle: "9월 말 – 10월 말 핑크뮬리 시즌." },
    },
    comingSoon: {
      camellia: { title: "곧 시작 — 동백", subtitle: "12월 15일 시작. 제주 동백 시즌 예약 받습니다." },
      plum: { title: "곧 시작 — 매화", subtitle: "2월 25일 시작. 양산·경주 봄 매화 시즌." },
      cherry: { title: "곧 시작 — 벚꽃", subtitle: "3월 28일 시작. 부산·경주 벚꽃 시즌." },
      hydrangea: { title: "곧 시작 — 수국", subtitle: "5월 15일 시작. 제주 수국 시즌." },
      maple: { title: "곧 시작 — 단풍", subtitle: "10월 15일 시작. 설악산·강원 단풍 시즌." },
      "pink-muhly": { title: "곧 시작 — 핑크뮬리", subtitle: "9월 30일 시작. 핑크뮬리 시즌." },
    },
  },
  ja: {
    editorsPick: { title: "エディターズピック", subtitle: "AtoC チームが家族と一緒に行くツアー。" },
    cruiseShoreExcursion: { title: "クルーズショアエクスカーション", subtitle: "釜山・仁川・済州のクルーズターミナル発の日帰りツアー。" },
    smallGroup: { title: "スモールグループ", subtitle: "シェアバン、ゆったりペース、大型バスコースなし。" },
    private: { title: "プライベートチャーター", subtitle: "専用車・専属ガイド・カスタムルート。" },
    classicBus: { title: "クラシックバスツアー", subtitle: "大型バスでシグネチャースポットを巡るお得なツアー。" },
    nowSeasonal: {
      camellia: { title: "シーズン中 — 椿", subtitle: "済州の冬の赤椿シーズン (12/15 – 2/15)。" },
      plum: { title: "シーズン中 — 梅", subtitle: "梁山・慶州エリアの 2 月末〜3 月中旬の紅梅。" },
      cherry: { title: "シーズン中 — 桜", subtitle: "3 月末〜4 月初の慶州・釜山桜シーズン。" },
      hydrangea: { title: "シーズン中 — 紫陽花", subtitle: "済州東部・南西部の 5 月中旬〜7 月中旬のあじさいシーズン。" },
      maple: { title: "シーズン中 — 紅葉", subtitle: "10 月中旬〜11 月中旬の雪嶽山・江原の紅葉シーズン。" },
      "pink-muhly": { title: "シーズン中 — ピンクミューリー", subtitle: "9 月末〜10 月末のピンクミューリーシーズン。" },
    },
    comingSoon: {
      camellia: { title: "間もなく開始 — 椿", subtitle: "12 月 15 日開始。済州冬の椿シーズン予約受付中。" },
      plum: { title: "間もなく開始 — 梅", subtitle: "2 月 25 日開始。梁山・慶州の春梅シーズン。" },
      cherry: { title: "間もなく開始 — 桜", subtitle: "3 月 28 日開始。釜山・慶州桜シーズン。" },
      hydrangea: { title: "間もなく開始 — 紫陽花", subtitle: "5 月 15 日開始。済州あじさいシーズン。" },
      maple: { title: "間もなく開始 — 紅葉", subtitle: "10 月 15 日開始。雪嶽山・江原の紅葉シーズン。" },
      "pink-muhly": { title: "間もなく開始 — ピンクミューリー", subtitle: "9 月 30 日開始。ピンクミューリーシーズン。" },
    },
  },
  zh: {
    editorsPick: { title: "编辑精选", subtitle: "AtoC 团队带自家亲友出行的路线。" },
    cruiseShoreExcursion: { title: "邮轮岸上游", subtitle: "釜山·仁川·济州邮轮码头出发的一日游。" },
    smallGroup: { title: "小团游", subtitle: "共享小巴，节奏舒缓，无大巴团套路。" },
    private: { title: "私人包车", subtitle: "专车专属司机向导，路线自由定制。" },
    classicBus: { title: "经典巴士团", subtitle: "大巴覆盖代表景点的高性价比团。" },
    nowSeasonal: {
      camellia: { title: "当季 — 山茶花", subtitle: "济州冬季红山茶花 (12.15 – 2.15)。" },
      plum: { title: "当季 — 梅花", subtitle: "梁山·庆州 2 月底 – 3 月中旬红梅花。" },
      cherry: { title: "当季 — 樱花", subtitle: "3 月底 – 4 月初庆州·釜山樱花季。" },
      hydrangea: { title: "当季 — 绣球花", subtitle: "济州东·西南 5 月中 – 7 月中旬绣球花季。" },
      maple: { title: "当季 — 红叶", subtitle: "10 月中 – 11 月中旬雪岳山·江原红叶季。" },
      "pink-muhly": { title: "当季 — 粉黛乱子草", subtitle: "9 月底 – 10 月底粉黛乱子草季。" },
    },
    comingSoon: {
      camellia: { title: "即将开放 — 山茶花", subtitle: "12 月 15 日开始。济州山茶花季预约。" },
      plum: { title: "即将开放 — 梅花", subtitle: "2 月 25 日开始。梁山·庆州春梅季。" },
      cherry: { title: "即将开放 — 樱花", subtitle: "3 月 28 日开始。釜山·庆州樱花季。" },
      hydrangea: { title: "即将开放 — 绣球花", subtitle: "5 月 15 日开始。济州绣球花季。" },
      maple: { title: "即将开放 — 红叶", subtitle: "10 月 15 日开始。雪岳山·江原红叶季。" },
      "pink-muhly": { title: "即将开放 — 粉黛乱子草", subtitle: "9 月 30 日开始。粉黛乱子草季。" },
    },
  },
  "zh-TW": {
    editorsPick: { title: "編輯精選", subtitle: "AtoC 團隊帶自家親友出行的路線。" },
    cruiseShoreExcursion: { title: "郵輪岸上遊", subtitle: "釜山·仁川·濟州郵輪碼頭出發的一日遊。" },
    smallGroup: { title: "小團遊", subtitle: "共享小巴，節奏舒緩，無大巴團套路。" },
    private: { title: "私人包車", subtitle: "專車專屬司機嚮導，路線自由定製。" },
    classicBus: { title: "經典巴士團", subtitle: "大巴覆蓋代表景點的高性價比團。" },
    nowSeasonal: {
      camellia: { title: "當季 — 山茶花", subtitle: "濟州冬季紅山茶花 (12.15 – 2.15)。" },
      plum: { title: "當季 — 梅花", subtitle: "梁山·慶州 2 月底 – 3 月中旬紅梅花。" },
      cherry: { title: "當季 — 櫻花", subtitle: "3 月底 – 4 月初慶州·釜山櫻花季。" },
      hydrangea: { title: "當季 — 繡球花", subtitle: "濟州東·西南 5 月中 – 7 月中旬繡球花季。" },
      maple: { title: "當季 — 紅葉", subtitle: "10 月中 – 11 月中旬雪嶽山·江原紅葉季。" },
      "pink-muhly": { title: "當季 — 粉黛亂子草", subtitle: "9 月底 – 10 月底粉黛亂子草季。" },
    },
    comingSoon: {
      camellia: { title: "即將開放 — 山茶花", subtitle: "12 月 15 日開始。濟州山茶花季預約。" },
      plum: { title: "即將開放 — 梅花", subtitle: "2 月 25 日開始。梁山·慶州春梅季。" },
      cherry: { title: "即將開放 — 櫻花", subtitle: "3 月 28 日開始。釜山·慶州櫻花季。" },
      hydrangea: { title: "即將開放 — 繡球花", subtitle: "5 月 15 日開始。濟州繡球花季。" },
      maple: { title: "即將開放 — 紅葉", subtitle: "10 月 15 日開始。雪嶽山·江原紅葉季。" },
      "pink-muhly": { title: "即將開放 — 粉黛亂子草", subtitle: "9 月 30 日開始。粉黛亂子草季。" },
    },
  },
  es: {
    editorsPick: { title: "Selección del editor", subtitle: "Los tours que nuestro equipo reserva para sus propias familias." },
    cruiseShoreExcursion: { title: "Excursión en tierra para cruceros", subtitle: "Rutas de un día desde los puertos de Busán, Incheon y Jeju." },
    smallGroup: { title: "Grupo reducido", subtitle: "Furgoneta compartida, ritmo tranquilo, sin paradas de bus turístico." },
    private: { title: "Charter privado", subtitle: "Vehículo propio, guía-conductor propio, ruta propia." },
    classicBus: { title: "Bus turístico clásico", subtitle: "Tours en autobús que cubren paradas emblemáticas." },
    nowSeasonal: {
      camellia: { title: "Temporada — Camelia", subtitle: "Temporada de camelia roja de Jeju (15 dic – 15 feb)." },
      plum: { title: "Temporada — Flor de ciruelo", subtitle: "Ciruelo rojo de Yangsan y Gyeongju (fin feb – med mar)." },
      cherry: { title: "Temporada — Cerezos en flor", subtitle: "Cerezos de Gyeongju y Busán (fin mar – ppios abr)." },
      hydrangea: { title: "Temporada — Hortensia", subtitle: "Hortensia azul de Jeju (med may – med jul)." },
      maple: { title: "Temporada — Arce / Otoño", subtitle: "Follaje otoñal de Seoraksan y Gangwon (med oct – med nov)." },
      "pink-muhly": { title: "Temporada — Pasto rosa", subtitle: "Pasto rosa (fin sep – fin oct)." },
    },
    comingSoon: {
      camellia: { title: "Próximamente — Camelia", subtitle: "Abre el 15 dic. Temporada invernal de Jeju." },
      plum: { title: "Próximamente — Flor de ciruelo", subtitle: "Abre el 25 feb. Temporada primaveral Yangsan-Gyeongju." },
      cherry: { title: "Próximamente — Cerezos en flor", subtitle: "Abre el 28 mar. Temporada Busán-Gyeongju." },
      hydrangea: { title: "Próximamente — Hortensia", subtitle: "Abre el 15 may. Temporada de hortensia de Jeju." },
      maple: { title: "Próximamente — Arce / Otoño", subtitle: "Abre el 15 oct. Temporada otoñal de Seoraksan." },
      "pink-muhly": { title: "Próximamente — Pasto rosa", subtitle: "Abre el 30 sep. Temporada de pasto rosa." },
    },
  },
};

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
for (const loc of LOCALES) {
  const path = `C:/Users/sangsong/atockorea-shelves/messages/${loc}.json`;
  const j = JSON.parse(readFileSync(path, "utf8"));
  j.toursList = j.toursList || {};
  j.toursList.shelves = SHELVES[loc];
  writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log(`  ${loc}: shelves added (${Object.keys(SHELVES[loc]).length} top-level keys)`);
}
