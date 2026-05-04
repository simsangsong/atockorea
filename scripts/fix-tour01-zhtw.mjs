// Tour #1 ZH-TW patcher — mirrors ZH patcher with traditional characters.
import { readFileSync, writeFileSync } from "node:fs";

const SLUG = "busan-gyeongju-unesco-legacy-tour-national-museum";
const PATH = `components/product-tour-static/${SLUG}/${SLUG}.zh-TW.json`;

const j = JSON.parse(readFileSync(PATH, "utf-8"));

j.routeFlowStops = [
  { name: "釜山地鐵接送", type: "origin", theme: "出發" },
  { name: "九山竹林（賞櫻季換為海雲台達摩峰）", type: "primary", theme: "森林 / 海岸路線（季節）" },
  { name: "佛國寺（UNESCO）", type: "primary", theme: "UNESCO遺產" },
  { name: "午餐（慶州拌飯）", type: "meal", theme: "用餐" },
  { name: "慶州國立博物館", type: "primary", theme: "新羅文物" },
  { name: "校村韓屋村", type: "primary", theme: "文化遺產村落" },
  { name: "月精橋", type: "primary", theme: "新羅木橋復原" },
  { name: "釜山地鐵下車", type: "return", theme: "返回" },
];

const routePhaseDescZhTw = [
  "在釜山地鐵三個站點依序接駁（08:10、08:30、09:10），隨後駕駛約30分鐘前往機張郡九山竹林。",
  "從九山竹林行駛約70分鐘到佛國寺，然後用75分鐘漫步寺院。",
  "慶州在地午餐（60分鐘），然後在國立博物館新羅展廳停留75分鐘。",
  "校村韓屋村漫步（60分鐘），隨後在月精橋駐足40分鐘。",
  "經京釜高速公路返回釜山，依序於海雲台、西面、釜山站下車。",
];
j.routePhases = (j.routePhases || []).map((p, i) => ({
  ...p,
  description: routePhaseDescZhTw[i] || p.description,
}));

j.routeShapeIntro = {
  title: "行程動線總覽",
  subtitle: "以「文化優先」為主題的釜山出發慶州一日遊，強調新羅王朝（統治992年）所留下的「遺產」軌跡。多數慶州一日遊會塞入5至7個戶外景點，本路線刻意放慢步伐，並加入大多數行程跳過的國立博物館。月精橋的夜燈收尾為整日畫下情感落幕，是其他路線無法呈現的高潮。賞櫻季換為海雲台達摩峰是細緻的品質設計——業者明顯圍繞季節高峰，而非固守不變的行程。",
};

const stopCategoryZhTw = {
  1: "交通 / 接送",
  2: "私有遺產森林",
  3: "UNESCO佛教寺院",
  4: "午餐 / 自費",
  5: "國立博物館 / 新羅遺產",
  6: "文化遺產韓屋村",
  7: "新羅木橋復原",
  8: "交通 / 返回",
};

const stopTimeUsedZhTw = {
  1: ["釜山站接駁（約08:10，約5分鐘）", "駛往西面站（約12分鐘）", "西面站接駁（約08:25，約5分鐘）", "駛往海雲台站（約18分鐘）", "海雲台站接駁並駛上東海高速公路（約08:45，約20分鐘）"],
  2: ["巴士下車並於氏族風格大門買票（約5分鐘）", "下層步道：宗祠、水車、400年紅松（約15分鐘）", "毛竹林（第9號景點）拍攝時間（約25分鐘）", "經木棧道返回並集合上車（約15分鐘）"],
  3: ["巴士下車並步行松林進入參道（約10分鐘）", "一柱門＋青雲橋/白雲橋拍攝時間（約15分鐘）", "大雄殿庭院＋多寶塔＋釋迦塔（約25分鐘）", "毗盧殿＋極樂殿（約15分鐘）", "自由時間並集合上車（約10分鐘）"],
  4: ["步行＋就坐（約5分鐘）", "點餐＋上菜（約10分鐘）", "用餐＋洗手間（約40分鐘）", "集合上車並購買飲水/小食（約5分鐘）"],
  5: ["巴士下車＋入場＋寄物（約10分鐘）", "戶外聖德大王神鐘亭（約10分鐘）", "新羅歷史館——金冠＋皇室器物（約25分鐘）", "月池館——雁鴨池出土文物（約15分鐘）", "特展或博物館商店並集合（約15分鐘）"],
  6: ["巴士下車並步行至主入口（約5分鐘)", "崔氏宗宅＋校洞法酒釀造所外觀（約20分鐘）", "雞林森林＋奈勿王陵（約15分鐘）", "鄉校儒學館＋村巷（約15分鐘）", "集合上車（約5分鐘）"],
  7: ["於橋北停車場下車（約5分鐘）", "走過橋梁至南端門樓（約10分鐘）", "於南端取景拍攝（約15分鐘）", "走回北端並集合上車（約10分鐘）"],
  8: ["由月精橋北端出發（約5分鐘）", "京釜＋東海高速公路駕駛（約60分鐘）", "海雲台站首站下車（約5分鐘）", "駛往西面與釜山站下車（約5分鐘）"],
};

const stopVisitDataZhTw = {
  2: {
    visitBasics: { hours: "每日09:00–18:00（最後入場約17:00）", closed: "週一休園", admission: "成人 ₩8,000 / 兒童 ₩5,000", walking: "中等——碎石路與緩坡，部分木棧道；建議穿好走的鞋" },
    convenience: { restroom: "入口大門與靠近宗祠的中段都設有洗手間", parking: "園內提供巴士與小車停車場（免費）" },
    smartNotes: { photo: "第9號景點（毛竹林）——10:00至11:30時段竹林上方側光最佳；宗祠旁的茅草大門；下層環線的400年紅松走廊", facilities: "入口處的小型在地農產品攤（應季蔬果與簡易飲品）；竹林內無完整咖啡店", tip: "穿深色上衣可與竹林明亮的色彩形成強烈對比，照片更出色；請勿離開標記步道（森林復育中）；禁止使用無人機" },
  },
  3: {
    visitBasics: { hours: "每日09:00–18:00（最後入場17:00）", closed: "全年開放", admission: "免費（自2023年起，依文化遺產保護法修訂）", walking: "中等——石階、緩坡與碎石路；建議穿好走的鞋" },
    convenience: { restroom: "園區內有迷你寺院風格的免費公共洗手間", parking: "現場停車場（收費）" },
    smartNotes: { photo: "紫霞門下方的青雲橋/白雲橋石階（國寶23號）；大殿庭院內的多寶塔（國寶20號）與釋迦塔（國寶21號）；春季沿入口道路的櫻花", facilities: "入口處的旅客服務中心；佛國寺博物館（另購票2,000 / 1,000韓元，週一休館）", tip: "請著合宜服裝；進入殿堂請脫鞋；禁止使用無人機；請勿拍攝僧侶或參拜者（標示清楚）；本寺仍是曹溪宗第11教區本山，正常進行宗教活動" },
  },
  5: {
    visitBasics: { hours: "週二至週日10:00–18:00（最後入場17:30）；週六及每月最後週三延長至21:00", closed: "週一、元旦、春節、中秋", admission: "免費（特展可能酌收少額門票）", walking: "主要為室內＋鋪設戶外步道；全程無障礙" },
    convenience: { restroom: "本館與戶外神鐘亭周邊均設有多處洗手間", parking: "現場免費提供巴士與小車停車場" },
    smartNotes: { photo: "戶外亭內的聖德大王神鐘（午後側光）；新羅館內的天馬塚金冠展示（昏暗光線，禁用閃光）；庭院中的石塔殘件", facilities: "博物館商店出售金冠造型飾品複刻品；本館內附設咖啡館；提供寄物服務", tip: "禁止閃光攝影；部分特展全面禁止拍攝（請留意標示）；建議神鐘亭單獨安排約10分鐘參觀——它是新羅最重要的單一文物" },
  },
  6: {
    visitBasics: { hours: "每日白天開放；多數文化遺產屋舍09:00–18:00", closed: "部分獨立屋舍週一休——主巷常年開放", admission: "多數屋舍免費；崔氏宗宅設有小型自願募款箱", walking: "輕鬆——碎石與石板巷道；主巷部分可通行輪椅" },
    convenience: { restroom: "村口及慶州鄉校附近設有公共洗手間", parking: "西側入口巴士停車場（免費）" },
    smartNotes: { photo: "黃金時段（傍晚側光）下的韓屋瓦頂；校洞法酒釀造所大門；從村落西南角可遠眺月精橋（第7站預覽）；雞林森林的古柳", facilities: "校洞法酒商店（伴手酒款）；主巷沿線的小型工藝店（傳統糕點、皇南麵包）；玉笙宮1779（高級餐廳，需預約）", tip: "若欲購買校洞法酒做伴手禮，請確認所屬國家的烈酒入境額度；週間下午村落較安靜——是慢拍照的最佳時段" },
  },
  7: {
    visitBasics: { hours: "全天開放（夜燈運行約日落至23:00）", closed: "全年開放", admission: "免費", walking: "輕鬆——平整橋面；自北端可無障礙通行" },
    convenience: { restroom: "北端停車場設有公共洗手間", parking: "巴士僅可在北端停泊；南端無停車" },
    smartNotes: { photo: "南端門樓搭配橋身延伸至月城王宮遺址的標誌性構圖；夜燈亮起後的長曝河面倒影；秋葉環繞的橋景常出現於韓國觀光宣傳冊封面", facilities: "橋身上無商店；北端停車場附近有小型咖啡館群", tip: "請攜帶三腳架或具夜景模式的手機以拍攝夜燈倒影；冬季河面霧氣可能模糊遠景——可利用門樓前景；切勿攀爬木欄杆" },
  },
};

const stopWhyOnRouteZhTw = {
  1: "三站接送是釜山小團體慶州行程的標準模式，亦與同類業者作業方式相符。從海雲台為最後一站接送可讓前往機張郡九山竹林（當日首個景點）的空駛距離最短，從而保留精心安排的月精橋日落收尾。",
  2: "九山為整日揭開「在釜山行政區內最具拍照價值的竹林體驗」——這是其他業者直接從釜山駛往佛國寺所沒有的差異化賣點。韓劇拍攝歷史是韓流粉絲的強力錨點，60分鐘時段足以走完精巧而標示清楚的森林。在11:00前抵達可避開週一休園陷阱，以及來自釜山的週末旅遊車團。與下午的佛國寺並列，從約400年的私有氏族森林到約1,250年的UNESCO佛寺，構成韓國文化連綿的兩個面向。",
  3: "佛國寺是任何慶州一日遊不可妥協的UNESCO主軸，亦是韓國最具知名度的佛教文化遺產。11:30抵達讓旅客可在午餐肌餓來襲前完成寺院參觀，並將下午時段留給慶州國立博物館（在概念上以「寺院＋文物」成對呈現）。75分鐘時段經過精算，讓旅客能從容走完完整的朝拜動線，無須急忙拍攝庭院內具有代表性的多寶塔/釋迦塔組合。下午抵達也能避開11:00前湧入韓國學生團的早晨高峰。",
  4: "在佛國寺與博物館之間安插午餐，可自然形成一個午間休止，讓導遊趁體力最旺時先走完寺院。把午餐排除在套餐之外可降低價位帶，讓國際旅客自由選擇肉食/素食/快速選項。",
  5: "博物館是路線在慶州最強的室內文化錨點，也是全程唯一全天候適合的景點——遇雨或高溫時，75分鐘時段可彈性延長而不影響整日行程。把佛國寺（寺院）與博物館（同時代文物及其原始政治脈絡）並列，是「先看見，再理解」的刻意設計，無任何競品慶州行程能與之並列。14:15時段亦讓神鐘亭獲得午後側光，便於拍攝，並避開博物館最後一小時的人潮高峰。",
  6: "校村是路線的「活的新羅」錨點——若說佛國寺呈現新羅佛教、博物館呈現新羅器物，校村便呈現自新羅延續至朝鮮士族、再到當代崔氏宗宅的連續韓國生活。把校村排在15:50能掌握韓屋瓦頂與校洞法酒釀造所木門的「黃金時段側光」——是村落最具拍照價值的時段。緊湊的步行布局也巧妙銜接了室內博物館與下個橋梁景點。",
  7: "月精橋是路線刻意打造的「日落收尾」——讓一天在情感高潮中收尾，而非在校村慢慢淡去。17:00抵達正是配合季節性日落時段——春秋季約18:00開始亮燈，但40分鐘時段恰好涵蓋魔幻時刻的過渡，同時擁有日光與首批夜燈輝光。競品的釜山-慶州一日遊皆未以此地收尾，這是本路線相對 busan-top-attractions、from-busan-gyeongju-ancient-capital 等的最強差異化。",
  8: "依逆序下車是小團體業界的標準作業——首站為地理上最近的海雲台，可最大程度縮短整體通勤。不打包晚餐是刻意的價格/彈性選擇，亦與同類釜山-慶州產品一致。",
};

for (const stop of j.itineraryStops || []) {
  if (stopCategoryZhTw[stop.number]) stop.category = stopCategoryZhTw[stop.number];
  if (stopTimeUsedZhTw[stop.number]) stop.timeUsed = stopTimeUsedZhTw[stop.number];
  if (stopWhyOnRouteZhTw[stop.number]) stop.whyOnRoute = stopWhyOnRouteZhTw[stop.number];
  const visit = stopVisitDataZhTw[stop.number];
  if (visit) {
    if (visit.visitBasics) stop.visitBasics = visit.visitBasics;
    if (visit.convenience) stop.convenience = visit.convenience;
    if (visit.smartNotes) stop.smartNotes = visit.smartNotes;
  }
}

const galleryZhTw = [
  { alt: "佛國寺多寶塔與石橋在午後光線下的遠景", caption: "佛國寺——UNESCO世界文化遺產。兩座塔為國寶20號與21號。", location: "佛國寺，慶州", atmosphere: "石材、木造與8世紀塔影" },
  { alt: "玻璃展櫃內、博物館燈光下的新羅金冠", caption: "慶州國立博物館——天馬塚金冠（國寶188號）。", location: "慶州國立博物館", atmosphere: "寧靜展廳，單件文物聚焦" },
  { alt: "校村韓屋瓦頂與石牆巷景", caption: "校村韓屋村——崔氏宗宅與儒學鄉校。", location: "校村韓屋村，慶州", atmosphere: "復原韓屋巷弄，人流稀疏" },
  { alt: "高聳竹林間灑落的光線", caption: "九山竹林——南平文氏自1638年起私有維護。", location: "九山，機張郡，釜山", atmosphere: "涼爽、翠綠、濾過的光線" },
  { alt: "黃昏時分木造橋樓倒映水中", caption: "月精橋——66公尺新羅式復原（2018年完工）。", location: "月精橋，慶州", atmosphere: "木材、流水、柔和的傍晚光線" },
];
(j.galleryItems || []).forEach((g, i) => {
  const t = galleryZhTw[i];
  if (!t) return;
  g.alt = t.alt; g.caption = t.caption; g.location = t.location; g.atmosphere = t.atmosphere;
});

if (j.whyTourWorks?.routeLogicSections?.[0]?.items) {
  j.whyTourWorks.routeLogicSections[0].items[3] = {
    label: "廂型小巴介於大型旅遊車與私人包車之間",
    detail: "釜山往慶州的大型旅遊車通常每團載35–45人、單價較低；私人包車每團1–4人、約$300以上/團。本小型廂型車格式介於兩者之間——通常每班10人以內——單價更接近大型旅遊車。曾比較的旅客反饋：享受了私人包車般的步調，卻無私人包車的開銷。",
  };
}

if (j.bookingTrustItems?.[0]) j.bookingTrustItems[0].description = "持照韓國旅遊業者，全險保障";
if (j.bookingTrustItems?.[1]) j.bookingTrustItems[1].description = "精心調校的行程，非通用旅遊路線";
if (j.bookingTrustItems?.[2]) j.bookingTrustItems[2].description = "依路線特性精算團體規模";

const supportDetailZhTw = ["預訂確認與行程摘要", "天氣更新與任何行程調整", "確切接送時間與司機聯絡方式", "依實際路況進行的當日早晨簡報", "每個景點的即時引導", "行程後追蹤與建議"];
(j.bookingSupportSteps || []).forEach((s, i) => {
  if (supportDetailZhTw[i]) s.detail = supportDetailZhTw[i];
});

const seasonalTempNotesZhTw = [
  "櫻花約在4月初盛開。全年最佳季節。",
  "炎熱潮濕；博物館設有空調。",
  "10月底佛國寺秋葉為韓國經典美景之一。",
  "寒冷；博物館與室內咖啡館價值更高。",
];
(j.practicalWeatherStatic?._seasonalTemperatures || []).forEach((t, i) => {
  if (seasonalTempNotesZhTw[i]) t.notes = seasonalTempNotesZhTw[i];
});
if (j.practicalWeatherStatic) {
  j.practicalWeatherStatic._seasonalSummary = "慶州屬韓國大陸型氣候——冬季較釜山更冷、夏季更熱。最佳季節為4月（慶州櫻花亦盛開）與10月至11月（佛國寺秋葉）。";
  if (j.practicalWeatherStatic.today) j.practicalWeatherStatic.today.label = "請見季節性說明";
  if (j.practicalWeatherStatic.tomorrow) j.practicalWeatherStatic.tomorrow.label = "請見季節性說明";
}

if (j.pickup_dropoff) {
  j.pickup_dropoff.notes = "請於預訂時選擇最靠近您飯店的接送出口。全年路線；賞櫻季（通常3月中旬至4月中旬）九山竹林替換為海雲台達摩峰。";
}

if (j.hero?.meta) {
  j.hero.meta.duration = "約11.5小時（08:10首站接送，約19:45末站下車）";
  j.hero.meta.region = "慶州（釜山出發）";
  j.hero.meta.stops = "8個景點";
}
if (j.hero) {
  j.hero.tagline = "韓國「無牆博物館」——15公里內匯集7處UNESCO遺址的慶州";
}

writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n", "utf-8");
console.log("✓ tour #1 zh-TW.json patched");
