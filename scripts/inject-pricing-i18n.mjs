/**
 * One-shot: inject Phase 9 pricing i18n keys into messages/<locale>.json.
 *
 * Copy is TRANSCREATED (native tone first, not literal) per the user's
 * instruction. The not-included (§5) + Jeju single-region (§6) notices use the
 * exact wording supplied in pricing_update_instructions.md where given.
 *
 * Idempotent: merges into itineraryBuilder.intake + itineraryBuilder.quote(.pricing).
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const intake = {
  en: {
    trackDmzLabel: "DMZ Tour",
    guideLanguageLegend: "Guide language",
    durationLegend: "Tour length",
    durationHint: "Pick how long your day runs — pricing scales with the hours.",
    dmzHint:
      "The DMZ tour follows a fixed itinerary (3rd Tunnel, observatory, suspension bridge) at a flat price by group size. Choose your party size on the next step.",
  },
  ko: {
    trackDmzLabel: "DMZ 투어",
    guideLanguageLegend: "가이드 언어",
    durationLegend: "투어 시간",
    durationHint: "하루 일정 길이를 선택하세요 — 시간에 따라 요금이 책정됩니다.",
    dmzHint:
      "DMZ 투어는 제3땅굴·전망대·출렁다리를 둘러보는 고정 일정이며, 인원수에 따른 고정 요금이 적용됩니다. 다음 단계에서 인원을 선택해 주세요.",
  },
  ja: {
    trackDmzLabel: "DMZツアー",
    guideLanguageLegend: "ガイドの言語",
    durationLegend: "ツアー時間",
    durationHint: "1日の所要時間を選んでください。料金は時間に応じて変わります。",
    dmzHint:
      "DMZツアーは第3トンネル・展望台・吊り橋を巡る固定行程で、人数に応じた定額制です。次のステップで人数をお選びください。",
  },
  zh: {
    trackDmzLabel: "DMZ之旅",
    guideLanguageLegend: "向导语言",
    durationLegend: "行程时长",
    durationHint: "选择您一天的行程时长——价格按小时计算。",
    dmzHint:
      "DMZ之旅为固定行程（第三隧道、展望台、吊桥），按团队人数收取固定费用。请在下一步选择人数。",
  },
  "zh-TW": {
    trackDmzLabel: "DMZ之旅",
    guideLanguageLegend: "導遊語言",
    durationLegend: "行程時長",
    durationHint: "選擇您一天的行程時長——價格依小時計算。",
    dmzHint:
      "DMZ之旅為固定行程（第三隧道、展望台、吊橋），依團隊人數收取固定費用。請於下一步選擇人數。",
  },
  es: {
    trackDmzLabel: "Tour de la DMZ",
    guideLanguageLegend: "Idioma del guía",
    durationLegend: "Duración del tour",
    durationHint: "Elige cuántas horas dura tu día: el precio varía según las horas.",
    dmzHint:
      "El tour de la DMZ sigue un itinerario fijo (Tercer Túnel, observatorio, puente colgante) con precio cerrado según el tamaño del grupo. Elige el número de personas en el siguiente paso.",
  },
};

const quote = {
  en: {
    eyebrow: "Custom itinerary",
    guideLanguageLabel: "Guide language",
    durationLabel: "Tour length",
    hoursOption: "{hours}h",
    solatiUnavailable: "10–13 needs 6h+",
    pickupLabel: "Jeju pickup area",
    cartHeader: "Your stops",
    andNMore: "+{n} more",
    pricing: {
      title: "Estimated price",
      total: "Estimated total",
      estimateNote: "Live estimate — we confirm the final price by email.",
      manualTitle: "We'll confirm by email",
      manualNote:
        "Your group size or options need a quick human check — we'll reply within 24 hours with the exact price.",
      solatiMinHint: "Groups of 10–13 (Solati van) start from 6 hours.",
      notIncluded:
        "Meal costs and attraction entrance tickets are NOT included in the tour price and will be paid separately on the day.",
      jejuSingleRegion:
        "Each tour covers ONE region of Jeju (East, West, or South). Covering two regions incurs an additional fee of ₩60,000.",
      lines: {
        base: "Base — {hours}h private tour",
        van: "Vehicle — van (7–9 guests)",
        solati: "Vehicle — Solati (10–13 guests)",
        solatiPeak: "Vehicle — Solati (10–13, peak season)",
        region: "Out-of-city surcharge",
        jejuCrossRegion: "Two-region surcharge",
        jejuPickup: "Pickup area ({zone})",
        dmzBase: "DMZ private tour ({pax} guests)",
      },
      pickupZones: {
        city: "Jeju City — no surcharge",
        north: "North coast (Aewol, Samyang) +₩40,000",
        outer: "Outer areas (Seongsan, Seogwipo) +₩60,000",
        cross_island: "Cross-island (150 km+) +₩30,000",
      },
    },
  },
  ko: {
    eyebrow: "맞춤 일정",
    guideLanguageLabel: "가이드 언어",
    durationLabel: "투어 시간",
    hoursOption: "{hours}시간",
    solatiUnavailable: "10~13인 6시간 이상",
    pickupLabel: "제주 픽업 지역",
    cartHeader: "선택한 장소",
    andNMore: "+{n}곳",
    pricing: {
      title: "예상 금액",
      total: "예상 합계",
      estimateNote: "실시간 예상가입니다 — 최종 금액은 이메일로 확정해 드립니다.",
      manualTitle: "이메일로 확인해 드릴게요",
      manualNote:
        "인원수나 옵션이 담당자 확인이 필요합니다 — 24시간 이내에 정확한 금액으로 회신드립니다.",
      solatiMinHint: "10~13인(쏠라티 차량)은 6시간부터 예약 가능합니다.",
      notIncluded:
        "식사 비용 및 관광지 입장료는 투어 요금에 포함되지 않으며 현장에서 별도 결제합니다.",
      jejuSingleRegion:
        "제주 투어는 하루에 동쪽, 서쪽, 남쪽 중 한 구역만 방문 가능합니다. 두 구역 방문 시 ₩60,000이 추가됩니다.",
      lines: {
        base: "기본 — {hours}시간 프라이빗 투어",
        van: "차량 — 밴 (7~9인)",
        solati: "차량 — 쏠라티 (10~13인)",
        solatiPeak: "차량 — 쏠라티 (10~13인, 성수기)",
        region: "시외 할증",
        jejuCrossRegion: "두 구역 방문 할증",
        jejuPickup: "픽업 지역 ({zone})",
        dmzBase: "DMZ 프라이빗 투어 ({pax}인)",
      },
      pickupZones: {
        city: "제주시내 — 할증 없음",
        north: "북쪽 (애월·삼양) +₩40,000",
        outer: "외곽 (성산·서귀포) +₩60,000",
        cross_island: "크로스 아일랜드 (150km 이상) +₩30,000",
      },
    },
  },
  ja: {
    eyebrow: "オーダーメイド旅程",
    guideLanguageLabel: "ガイドの言語",
    durationLabel: "ツアー時間",
    hoursOption: "{hours}時間",
    solatiUnavailable: "10〜13名は6時間〜",
    pickupLabel: "済州の送迎エリア",
    cartHeader: "選んだスポット",
    andNMore: "他{n}件",
    pricing: {
      title: "概算料金",
      total: "概算合計",
      estimateNote: "リアルタイムの概算です。最終料金はメールで確定します。",
      manualTitle: "メールでご案内します",
      manualNote:
        "人数やオプションの確認が必要です。24時間以内に正確な料金をご返信します。",
      solatiMinHint: "10〜13名（ソラティ）は6時間からのご予約となります。",
      notIncluded:
        "食事代および観光地の入場料はツアー料金に含まれておらず、当日現地にて別途お支払いいただきます。",
      jejuSingleRegion:
        "済州ツアーは1日につき東部・西部・南部のいずれか1エリアのみを巡ります。2エリアを巡る場合は₩60,000が追加されます。",
      lines: {
        base: "基本 — {hours}時間プライベートツアー",
        van: "車両 — バン（7〜9名）",
        solati: "車両 — ソラティ（10〜13名）",
        solatiPeak: "車両 — ソラティ（10〜13名・繁忙期）",
        region: "市外追加料金",
        jejuCrossRegion: "2エリア追加料金",
        jejuPickup: "送迎エリア（{zone}）",
        dmzBase: "DMZプライベートツアー（{pax}名）",
      },
      pickupZones: {
        city: "済州市内 — 追加料金なし",
        north: "北部（涯月・三陽）+₩40,000",
        outer: "郊外（城山・西帰浦）+₩60,000",
        cross_island: "島横断（150km以上）+₩30,000",
      },
    },
  },
  zh: {
    eyebrow: "定制行程",
    guideLanguageLabel: "向导语言",
    durationLabel: "行程时长",
    hoursOption: "{hours}小时",
    solatiUnavailable: "10–13人需6小时起",
    pickupLabel: "济州接送区域",
    cartHeader: "您选择的景点",
    andNMore: "+{n}个",
    pricing: {
      title: "预估价格",
      total: "预估总计",
      estimateNote: "实时预估——最终价格将通过电子邮件确认。",
      manualTitle: "我们将通过邮件确认",
      manualNote: "您的人数或选项需要人工核对——我们将在24小时内回复确切价格。",
      solatiMinHint: "10–13人（Solati商务车）最少预订6小时。",
      notIncluded: "餐饮费用及景点门票不含于行程费用中，请于当日现场另行支付。",
      jejuSingleRegion:
        "济州一日游仅限游览一个区域（东部、西部或南部）。若需跨越两个区域，需加收₩60,000。",
      lines: {
        base: "基础 — {hours}小时私人包车",
        van: "车辆 — 商务车（7–9人）",
        solati: "车辆 — Solati（10–13人）",
        solatiPeak: "车辆 — Solati（10–13人，旺季）",
        region: "市区外附加费",
        jejuCrossRegion: "跨两区附加费",
        jejuPickup: "接送区域（{zone}）",
        dmzBase: "DMZ私人之旅（{pax}人）",
      },
      pickupZones: {
        city: "济州市区 — 无附加费",
        north: "北部（涯月、三阳）+₩40,000",
        outer: "外围（城山、西归浦）+₩60,000",
        cross_island: "跨岛（150公里以上）+₩30,000",
      },
    },
  },
  "zh-TW": {
    eyebrow: "客製行程",
    guideLanguageLabel: "導遊語言",
    durationLabel: "行程時長",
    hoursOption: "{hours}小時",
    solatiUnavailable: "10–13人需6小時起",
    pickupLabel: "濟州接送區域",
    cartHeader: "您選擇的景點",
    andNMore: "+{n}個",
    pricing: {
      title: "預估價格",
      total: "預估總計",
      estimateNote: "即時預估——最終價格將以電子郵件確認。",
      manualTitle: "我們將以電子郵件確認",
      manualNote: "您的人數或選項需要人工確認——我們將在24小時內回覆確切價格。",
      solatiMinHint: "10–13人（Solati商務車）最少預訂6小時。",
      notIncluded: "餐飲費用及景點門票不含於行程費用中，請於當日現場另行支付。",
      jejuSingleRegion:
        "濟州一日遊僅限遊覽一個區域（東部、西部或南部）。若需跨越兩個區域，需加收₩60,000。",
      lines: {
        base: "基本 — {hours}小時私人包車",
        van: "車輛 — 商務車（7–9人）",
        solati: "車輛 — Solati（10–13人）",
        solatiPeak: "車輛 — Solati（10–13人，旺季）",
        region: "市區外附加費",
        jejuCrossRegion: "跨兩區附加費",
        jejuPickup: "接送區域（{zone}）",
        dmzBase: "DMZ私人之旅（{pax}人）",
      },
      pickupZones: {
        city: "濟州市區 — 無附加費",
        north: "北部（涯月、三陽）+₩40,000",
        outer: "外圍（城山、西歸浦）+₩60,000",
        cross_island: "跨島（150公里以上）+₩30,000",
      },
    },
  },
  es: {
    eyebrow: "Itinerario a medida",
    guideLanguageLabel: "Idioma del guía",
    durationLabel: "Duración del tour",
    hoursOption: "{hours} h",
    solatiUnavailable: "10–13 requiere 6 h+",
    pickupLabel: "Zona de recogida en Jeju",
    cartHeader: "Tus paradas",
    andNMore: "+{n} más",
    pricing: {
      title: "Precio estimado",
      total: "Total estimado",
      estimateNote: "Estimación en vivo: confirmamos el precio final por correo.",
      manualTitle: "Lo confirmamos por correo",
      manualNote:
        "El tamaño de tu grupo o las opciones requieren una revisión rápida; te responderemos en 24 horas con el precio exacto.",
      solatiMinHint: "Los grupos de 10–13 (furgoneta Solati) parten de 6 horas.",
      notIncluded:
        "Los costos de comidas y entradas a atracciones NO están incluidos en el precio del tour y se pagarán por separado el día del recorrido.",
      jejuSingleRegion:
        "Cada tour cubre UNA región de Jeju (Este, Oeste o Sur). Visitar dos regiones conlleva un cargo adicional de ₩60,000.",
      lines: {
        base: "Base — tour privado de {hours} h",
        van: "Vehículo — furgoneta (7–9 pers.)",
        solati: "Vehículo — Solati (10–13 pers.)",
        solatiPeak: "Vehículo — Solati (10–13, temporada alta)",
        region: "Recargo fuera de la ciudad",
        jejuCrossRegion: "Recargo por dos regiones",
        jejuPickup: "Zona de recogida ({zone})",
        dmzBase: "Tour privado DMZ ({pax} pers.)",
      },
      pickupZones: {
        city: "Ciudad de Jeju — sin recargo",
        north: "Costa norte (Aewol, Samyang) +₩40,000",
        outer: "Zonas exteriores (Seongsan, Seogwipo) +₩60,000",
        cross_island: "Cruce de la isla (150 km+) +₩30,000",
      },
    },
  },
};

const dmz = {
  en: {
    title: "DMZ Private Tour",
    body: "A fixed full-day itinerary to the edge of the Korean peninsula's most fortified border — Imjingak, the 3rd Infiltration Tunnel, Dora Observatory, and the Gamaksan suspension bridge. Flat price by group size, with your own car + guide.",
    cta: "See my price",
  },
  ko: {
    title: "DMZ 프라이빗 투어",
    body: "임진각, 제3땅굴, 도라전망대, 감악산 출렁다리까지 — 한반도 최전방을 둘러보는 하루 고정 일정입니다. 전용 차량과 가이드가 함께하며, 인원수에 따른 고정 요금으로 안내합니다.",
    cta: "요금 확인하기",
  },
  ja: {
    title: "DMZプライベートツアー",
    body: "臨津閣、第3トンネル、都羅展望台、紺岳山の吊り橋まで——朝鮮半島の最前線を巡る1日固定行程です。専用車とガイドが同行し、人数に応じた定額料金でご案内します。",
    cta: "料金を見る",
  },
  zh: {
    title: "DMZ私人之旅",
    body: "前往临津阁、第三隧道、都罗展望台与绀岳山吊桥——探访朝鲜半岛最前线的一日固定行程。专车与向导全程陪同，按团队人数收取固定费用。",
    cta: "查看价格",
  },
  "zh-TW": {
    title: "DMZ私人之旅",
    body: "前往臨津閣、第三隧道、都羅展望台與紺岳山吊橋——探訪朝鮮半島最前線的一日固定行程。專車與導遊全程陪同，依團隊人數收取固定費用。",
    cta: "查看價格",
  },
  es: {
    title: "Tour Privado de la DMZ",
    body: "Un itinerario fijo de día completo hasta la frontera más fortificada de la península coreana: Imjingak, el Tercer Túnel, el Observatorio Dora y el puente colgante de Gamaksan. Precio cerrado según el tamaño del grupo, con coche y guía privados.",
    cta: "Ver mi precio",
  },
};

for (const loc of LOCALES) {
  const file = new URL(`../messages/${loc}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.itineraryBuilder ??= {};
  const ib = json.itineraryBuilder;
  ib.intake = { ...(ib.intake ?? {}), ...intake[loc] };
  ib.dmz = { ...(ib.dmz ?? {}), ...dmz[loc] };
  const q = quote[loc];
  const prevPricing = ib.quote?.pricing ?? {};
  ib.quote = {
    ...(ib.quote ?? {}),
    ...q,
    pricing: {
      ...prevPricing,
      ...q.pricing,
      lines: { ...(prevPricing.lines ?? {}), ...q.pricing.lines },
      pickupZones: { ...(prevPricing.pickupZones ?? {}), ...q.pricing.pickupZones },
    },
  };
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc}.json`);
}
console.log("done");
