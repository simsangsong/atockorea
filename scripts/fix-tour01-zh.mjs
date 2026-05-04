// Tour #1 (busan-gyeongju-unesco-legacy-tour-national-museum) — ZH full translation patcher.
// Fills English residue across routeFlowStops, routePhases, routeShapeIntro, itineraryStops
// (category/timeUsed/whyOnRoute/visitBasics/convenience/smartNotes/highlights), galleryItems,
// whyTourWorks.routeLogicSections, bookingTrustItems descriptions.

import { readFileSync, writeFileSync } from "node:fs";

const SLUG = "busan-gyeongju-unesco-legacy-tour-national-museum";
const PATH = `components/product-tour-static/${SLUG}/${SLUG}.zh.json`;

const j = JSON.parse(readFileSync(PATH, "utf-8"));

// -- Route flow stops --
j.routeFlowStops = [
  { name: "釜山地铁接送", type: "origin", theme: "出发" },
  { name: "九山竹林（赏樱季换为海云台达摩峰）", type: "primary", theme: "森林 / 海岸路线（季节）" },
  { name: "佛国寺（UNESCO）", type: "primary", theme: "UNESCO遗产" },
  { name: "午餐（庆州拌饭）", type: "meal", theme: "用餐" },
  { name: "庆州国立博物馆", type: "primary", theme: "新罗文物" },
  { name: "校村韩屋村", type: "primary", theme: "文化遗产村落" },
  { name: "月精桥", type: "primary", theme: "新罗木桥复原" },
  { name: "釜山地铁下车", type: "return", theme: "返回" },
];

// -- Route phases (description) --
const routePhaseDescZh = [
  "在釜山地铁三个站点依序接驳（08:10、08:30、09:10），随后驾驶约30分钟前往机张郡九山竹林。",
  "从九山竹林行驶约70分钟到佛国寺，然后用75分钟漫步寺院。",
  "庆州在地午餐（60分钟），然后在国立博物馆新罗展厅停留75分钟。",
  "校村韩屋村漫步（60分钟），随后在月精桥驻足40分钟。",
  "经京釜高速公路返回釜山，依序于海云台、西面、釜山站下车。",
];
j.routePhases = (j.routePhases || []).map((p, i) => ({
  ...p,
  description: routePhaseDescZh[i] || p.description,
}));

// -- Route shape intro --
j.routeShapeIntro = {
  title: "行程动线总览",
  subtitle: "以「文化优先」为主题的釜山出发庆州一日游，强调新罗王朝（统治992年）所留下的「遗产」轨迹。多数庆州一日游会塞入5至7个户外景点，本路线刻意放慢步伐，并加入大多数行程跳过的国立博物馆。月精桥的夜灯收尾为整日画下情感落幕，是其他路线无法呈现的高潮。赏樱季换为海云台达摩峰是细致的品质设计——业者明显围绕季节高峰，而非固守不变的行程。",
};

// -- Stop categories --
const stopCategoryZh = {
  1: "交通 / 接送",
  2: "私有遗产森林",
  3: "UNESCO佛教寺院",
  4: "午餐 / 自费",
  5: "国立博物馆 / 新罗遗产",
  6: "文化遗产韩屋村",
  7: "新罗木桥复原",
  8: "交通 / 返回",
};

// -- Stop timeUsed (per stop) --
const stopTimeUsedZh = {
  1: [
    "釜山站接驳（约08:10，约5分钟）",
    "驶往西面站（约12分钟）",
    "西面站接驳（约08:25，约5分钟）",
    "驶往海云台站（约18分钟）",
    "海云台站接驳并驶上东海高速公路（约08:45，约20分钟）",
  ],
  2: [
    "巴士下车并于氏族风格大门买票（约5分钟）",
    "下层步道：宗祠、水车、400年红松（约15分钟）",
    "毛竹林（第9号景点）拍摄时间（约25分钟）",
    "经木栈道返回并集合上车（约15分钟）",
  ],
  3: [
    "巴士下车并步行松林进入参道（约10分钟）",
    "一柱门＋青云桥/白云桥拍摄时间（约15分钟）",
    "大雄殿庭院＋多宝塔＋释迦塔（约25分钟）",
    "毗卢殿＋极乐殿（约15分钟）",
    "自由时间并集合上车（约10分钟）",
  ],
  4: [
    "步行＋就坐（约5分钟）",
    "点餐＋上菜（约10分钟）",
    "用餐＋洗手间（约40分钟）",
    "集合上车并购买饮水/小食（约5分钟）",
  ],
  5: [
    "巴士下车＋入场＋寄物（约10分钟）",
    "户外圣德大王神钟亭（约10分钟）",
    "新罗历史馆——金冠＋皇室器物（约25分钟）",
    "月池馆——雁鸭池出土文物（约15分钟）",
    "特展或博物馆商店并集合（约15分钟）",
  ],
  6: [
    "巴士下车并步行至主入口（约5分钟)",
    "崔氏宗宅＋校洞法酒酿造所外观（约20分钟）",
    "鸡林森林＋奈勿王陵（约15分钟）",
    "乡校儒学馆＋村巷（约15分钟）",
    "集合上车（约5分钟）",
  ],
  7: [
    "于桥北停车场下车（约5分钟）",
    "走过桥梁至南端门楼（约10分钟）",
    "于南端取景拍摄（约15分钟）",
    "走回北端并集合上车（约10分钟）",
  ],
  8: [
    "由月精桥北端出发（约5分钟）",
    "京釜＋东海高速公路驾驶（约60分钟）",
    "海云台站首站下车（约5分钟）",
    "驶往西面与釜山站下车（约5分钟）",
  ],
};

// -- visitBasics / convenience / smartNotes per stop --
const stopVisitDataZh = {
  2: {
    visitBasics: {
      hours: "每日09:00–18:00（最后入场约17:00）",
      closed: "周一休园",
      admission: "成人 ₩8,000 / 儿童 ₩5,000",
      walking: "中等——碎石路与缓坡，部分木栈道；建议穿好走的鞋",
    },
    convenience: {
      restroom: "入口大门与靠近宗祠的中段都设有洗手间",
      parking: "园内提供巴士与小车停车场（免费）",
    },
    smartNotes: {
      photo: "第9号景点（毛竹林）——10:00至11:30时段竹林上方侧光最佳；宗祠旁的茅草大门；下层环线的400年红松走廊",
      facilities: "入口处的小型在地农产品摊（应季蔬果与简易饮品）；竹林内无完整咖啡店",
      tip: "穿深色上衣可与竹林明亮的色彩形成强烈对比，照片更出色；请勿离开标记步道（森林复育中）；禁止使用无人机",
    },
  },
  3: {
    visitBasics: {
      hours: "每日09:00–18:00（最后入场17:00）",
      closed: "全年开放",
      admission: "免费（自2023年起，依文化遗产保护法修订）",
      walking: "中等——石阶、缓坡与碎石路；建议穿好走的鞋",
    },
    convenience: {
      restroom: "园区内有迷你寺院风格的免费公共洗手间",
      parking: "现场停车场（收费）",
    },
    smartNotes: {
      photo: "紫霞门下方的青云桥/白云桥石阶（国宝23号）；大殿庭院内的多宝塔（国宝20号）与释迦塔（国宝21号）；春季沿入口道路的樱花",
      facilities: "入口处的旅客服务中心；佛国寺博物馆（另购票2,000 / 1,000韩元，周一休馆）",
      tip: "请着合宜服装；进入殿堂请脱鞋；禁止使用无人机；请勿拍摄僧侣或参拜者（标示清楚）；本寺仍是曹溪宗第11教区本山，正常进行宗教活动",
    },
  },
  5: {
    visitBasics: {
      hours: "周二至周日10:00–18:00（最后入场17:30）；周六及每月最后周三延长至21:00",
      closed: "周一、元旦、春节、中秋",
      admission: "免费（特展可能酌收少额门票）",
      walking: "主要为室内＋铺设户外步道；全程无障碍",
    },
    convenience: {
      restroom: "本馆与户外神钟亭周边均设有多处洗手间",
      parking: "现场免费提供巴士与小车停车场",
    },
    smartNotes: {
      photo: "户外亭内的圣德大王神钟（午后侧光）；新罗馆内的天马冢金冠展示（昏暗光线，禁用闪光）；庭院中的石塔残件",
      facilities: "博物馆商店出售金冠造型饰品复刻品；本馆内附设咖啡馆；提供寄物服务",
      tip: "禁止闪光摄影；部分特展全面禁止拍摄（请留意标示）；建议神钟亭单独安排约10分钟参观——它是新罗最重要的单一文物",
    },
  },
  6: {
    visitBasics: {
      hours: "每日白天开放；多数文化遗产屋舍09:00–18:00",
      closed: "部分独立屋舍周一休——主巷常年开放",
      admission: "多数屋舍免费；崔氏宗宅设有小型自愿募款箱",
      walking: "轻松——碎石与石板巷道；主巷部分可通行轮椅",
    },
    convenience: {
      restroom: "村口及庆州乡校附近设有公共洗手间",
      parking: "西侧入口巴士停车场（免费）",
    },
    smartNotes: {
      photo: "黄金时段（傍晚侧光）下的韩屋瓦顶；校洞法酒酿造所大门；从村落西南角可远眺月精桥（第7站预览）；鸡林森林的古柳",
      facilities: "校洞法酒商店（伴手酒款）；主巷沿线的小型工艺店（传统糕点、皇南面包）；玉笙宫1779（高级餐厅，需预约）",
      tip: "若欲购买校洞法酒做伴手礼，请确认所属国家的烈酒入境额度；周间下午村落较安静——是慢拍照的最佳时段",
    },
  },
  7: {
    visitBasics: {
      hours: "全天开放（夜灯运行约日落至23:00）",
      closed: "全年开放",
      admission: "免费",
      walking: "轻松——平整桥面；自北端可无障碍通行",
    },
    convenience: {
      restroom: "北端停车场设有公共洗手间",
      parking: "巴士仅可在北端停泊；南端无停车",
    },
    smartNotes: {
      photo: "南端门楼搭配桥身延伸至月城王宫遗址的标志性构图；夜灯亮起后的长曝河面倒影；秋叶环绕的桥景常出现于韩国观光宣传册封面",
      facilities: "桥身上无商店；北端停车场附近有小型咖啡馆群",
      tip: "请携带三脚架或具夜景模式的手机以拍摄夜灯倒影；冬季河面雾气可能模糊远景——可利用门楼前景；切勿攀爬木栏杆",
    },
  },
};

// -- Stop whyOnRoute (some still EN, refresh) --
const stopWhyOnRouteZh = {
  1: "三站接送是釜山小团体庆州行程的标准模式，亦与同类业者作业方式相符。从海云台为最后一站接送可让前往机张郡九山竹林（当日首个景点）的空驶距离最短，从而保留精心安排的月精桥日落收尾。",
  2: "九山为整日揭开「在釜山行政区内最具拍照价值的竹林体验」——这是其他业者直接从釜山驶往佛国寺所没有的差异化卖点。韩剧拍摄历史是韩流粉丝的强力锚点，60分钟时段足以走完精巧而标示清楚的森林。在11:00前抵达可避开周一休园陷阱，以及来自釜山的周末旅游车团。与下午的佛国寺并列，从约400年的私有氏族森林到约1,250年的UNESCO佛寺，构成韩国文化连绵的两个面向。",
  3: "佛国寺是任何庆州一日游不可妥协的UNESCO主轴，亦是韩国最具知名度的佛教文化遗产。11:30抵达让旅客可在午餐肌饿来袭前完成寺院参观，并将下午时段留给庆州国立博物馆（在概念上以「寺院＋文物」成对呈现）。75分钟时段经过精算，让旅客能从容走完完整的朝拜动线，无须急忙拍摄庭院内具有代表性的多宝塔/释迦塔组合。下午抵达也能避开11:00前涌入韩国学生团的早晨高峰。",
  4: "在佛国寺与博物馆之间安插午餐，可自然形成一个午间休止，让导游趁体力最旺时先走完寺院。把午餐排除在套餐之外可降低价位带，让国际旅客自由选择肉食/素食/快速选项。",
  5: "博物馆是路线在庆州最强的室内文化锚点，也是全程唯一全天候适合的景点——遇雨或高温时，75分钟时段可弹性延长而不影响整日行程。把佛国寺（寺院）与博物馆（同时代文物及其原始政治脉络）并列，是「先看见，再理解」的刻意设计，无任何竞品庆州行程能与之并列。14:15时段亦让神钟亭获得午后侧光，便于拍摄，并避开博物馆最后一小时的人潮高峰。",
  6: "校村是路线的「活的新罗」锚点——若说佛国寺呈现新罗佛教、博物馆呈现新罗器物，校村便呈现自新罗延续至朝鲜士族、再到当代崔氏宗宅的连续韩国生活。把校村排在15:50能掌握韩屋瓦顶与校洞法酒酿造所木门的「黄金时段侧光」——是村落最具拍照价值的时段。紧凑的步行布局也巧妙衔接了室内博物馆与下个桥梁景点。",
  7: "月精桥是路线刻意打造的「日落收尾」——让一天在情感高潮中收尾，而非在校村慢慢淡去。17:00抵达正是配合季节性日落时段——春秋季约18:00开始亮灯，但40分钟时段恰好涵盖魔幻时刻的过渡，同时拥有日光与首批夜灯辉光。竞品的釜山-庆州一日游皆未以此地收尾，这是本路线相对 busan-top-attractions、from-busan-gyeongju-ancient-capital 等的最强差异化。",
  8: "依逆序下车是小团体业界的标准作业——首站为地理上最近的海云台，可最大程度缩短整体通勤。不打包晚餐是刻意的价格/弹性选择，亦与同类釜山-庆州产品一致。",
};

// -- Apply per-stop fixes --
for (const stop of j.itineraryStops || []) {
  if (stopCategoryZh[stop.number]) stop.category = stopCategoryZh[stop.number];
  if (stopTimeUsedZh[stop.number]) stop.timeUsed = stopTimeUsedZh[stop.number];
  if (stopWhyOnRouteZh[stop.number]) stop.whyOnRoute = stopWhyOnRouteZh[stop.number];
  const visit = stopVisitDataZh[stop.number];
  if (visit) {
    if (visit.visitBasics) stop.visitBasics = visit.visitBasics;
    if (visit.convenience) stop.convenience = visit.convenience;
    if (visit.smartNotes) stop.smartNotes = visit.smartNotes;
  }
}

// -- Gallery items: alt + caption + location + atmosphere --
const galleryZh = [
  {
    alt: "佛国寺多宝塔与石桥在午后光线下的远景",
    caption: "佛国寺——UNESCO世界文化遗产。两座塔为国宝20号与21号。",
    location: "佛国寺，庆州",
    atmosphere: "石材、木造与8世纪塔影",
  },
  {
    alt: "玻璃展柜内、博物馆灯光下的新罗金冠",
    caption: "庆州国立博物馆——天马冢金冠（国宝188号）。",
    location: "庆州国立博物馆",
    atmosphere: "宁静展厅，单件文物聚焦",
  },
  {
    alt: "校村韩屋瓦顶与石墙巷景",
    caption: "校村韩屋村——崔氏宗宅与儒学乡校。",
    location: "校村韩屋村，庆州",
    atmosphere: "复原韩屋巷弄，人流稀疏",
  },
  {
    alt: "高耸竹林间洒落的光线",
    caption: "九山竹林——南平文氏自1638年起私有维护。",
    location: "九山，机张郡，釜山",
    atmosphere: "凉爽、翠绿、滤过的光线",
  },
  {
    alt: "黄昏时分木造桥楼倒映水中",
    caption: "月精桥——66公尺新罗式复原（2018年完工）。",
    location: "月精桥，庆州",
    atmosphere: "木材、流水、柔和的傍晚光线",
  },
];
(j.galleryItems || []).forEach((g, i) => {
  const t = galleryZh[i];
  if (!t) return;
  g.alt = t.alt;
  g.caption = t.caption;
  g.location = t.location;
  g.atmosphere = t.atmosphere;
});

// -- whyTourWorks routeLogicSections (replace items[3] EN) --
if (j.whyTourWorks?.routeLogicSections?.[0]?.items) {
  j.whyTourWorks.routeLogicSections[0].items[3] = {
    label: "厢型小巴介于大型旅游车与私人包车之间",
    detail: "釜山往庆州的大型旅游车通常每团载35–45人、单价较低；私人包车每团1–4人、约$300以上/团。本小型厢型车格式介于两者之间——通常每班10人以内——单价更接近大型旅游车。曾比较的旅客反馈：享受了私人包车般的步调，却无私人包车的开销。",
  };
}

// -- bookingTrustItems descriptions (still EN) --
if (j.bookingTrustItems?.[0]) j.bookingTrustItems[0].description = "持照韩国旅游业者，全险保障";
if (j.bookingTrustItems?.[1]) j.bookingTrustItems[1].description = "精心调校的行程，非通用旅游路线";
if (j.bookingTrustItems?.[2]) j.bookingTrustItems[2].description = "依路线特性精算团体规模";

// -- bookingSupportSteps detail (some still EN) --
const supportDetailZh = [
  "预订确认与行程摘要",
  "天气更新与任何行程调整",
  "确切接送时间与司机联络方式",
  "依实际路况进行的当日早晨简报",
  "每个景点的实时引导",
  "行程后追踪与建议",
];
(j.bookingSupportSteps || []).forEach((s, i) => {
  if (supportDetailZh[i]) s.detail = supportDetailZh[i];
});

// -- staticQuestions (already mostly Chinese in the file? check) — leave existing if Chinese; this script doesn't touch unless we know they're EN
// Audit: `q-bridge-night-view` etc may still need translation. Skip for now if already in Chinese.

// -- _seasonalTemperatures notes (probably EN) --
const seasonalTempNotesZh = [
  "樱花约在4月初盛开。全年最佳季节。",
  "炎热潮湿；博物馆设有空调。",
  "10月底佛国寺秋叶为韩国经典美景之一。",
  "寒冷；博物馆与室内咖啡馆价值更高。",
];
(j.practicalWeatherStatic?._seasonalTemperatures || []).forEach((t, i) => {
  if (seasonalTempNotesZh[i]) t.notes = seasonalTempNotesZh[i];
});
if (j.practicalWeatherStatic) {
  j.practicalWeatherStatic._seasonalSummary = "庆州属韩国大陆型气候——冬季较釜山更冷、夏季更热。最佳季节为4月（庆州樱花亦盛开）与10月至11月（佛国寺秋叶）。";
  if (j.practicalWeatherStatic.today) j.practicalWeatherStatic.today.label = "请见季节性说明";
  if (j.practicalWeatherStatic.tomorrow) j.practicalWeatherStatic.tomorrow.label = "请见季节性说明";
}

// -- pickup_dropoff notes --
if (j.pickup_dropoff) {
  j.pickup_dropoff.notes = "请于预订时选择最靠近您饭店的接送出口。全年路线；赏樱季（通常3月中旬至4月中旬）九山竹林替换为海云台达摩峰。";
}

// -- hero meta --
if (j.hero?.meta) {
  j.hero.meta.duration = "约11.5小时（08:10首站接送，约19:45末站下车）";
  j.hero.meta.region = "庆州（釜山出发）";
  j.hero.meta.stops = "8个景点";
}
if (j.hero) {
  j.hero.tagline = "韩国「无墙博物馆」——15公里内汇集7处UNESCO遗址的庆州";
}

writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n", "utf-8");
console.log("✓ tour #1 zh.json patched");
