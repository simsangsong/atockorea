/**
 * 투어 상품 상세 페이지에서 컴포넌트에 하드코딩되던 섹션 제목·부제·공통 라벨.
 * `detail_payload.sectionUi`로 로케일별 주입; 없으면 EN 기본값.
 */

export type TourProductSectionUiV1 = {
  atAGlanceTitle: string;
  atAGlanceSubtitle: string;
  atmosphereTitle: string;
  atmosphereSubtitle: string;
  itineraryTitle: string;
  itinerarySubtitle: string;
  dayFlowStopsPrefix: string;
  stopHighlightsHeading: string;
  stopTimeUsedHeading: string;
  stopVisitBasicsHeading: string;
  stopVisitHoursLabel: string;
  stopVisitAdmissionLabel: string;
  stopVisitWalkingLabel: string;
  stopVisitClosedLabel: string;
  stopSmartNotesHeading: string;
  stopSmartNotesPhotoPrefix: string;
  stopSmartNotesTipPrefix: string;
  /** Detail-drawer collapsible: full description card title + sub-meta. EN defaults used when omitted. */
  stopFullDescriptionTitle?: string;
  stopFullDescriptionMeta?: string;
  fitTitle: string;
  fitSubtitle: string;
  fitBestForLabel: string;
  fitLessIdealLabel: string;
  fitFamiliesPrefix: string;
  fitFamiliesText: string;
  fitSeniorsPrefix: string;
  fitSeniorsText: string;
  fitRouteLogicTitle: string;
  fitRouteLogicSubtitle: string;
  practicalTitle: string;
  practicalSubtitle: string;
  seasonalTitle: string;
  seasonalSubtitle: string;
  bookingSupportTitle: string;
  bookingSupportSubtitle: string;
  bookingAfterTitle: string;
  bookingAfterSubtitle: string;
  /** Shown when `bookingSupportSteps` is empty (data not configured). */
  bookingSupportEmptyHint?: string;
  faqTitle: string;
  faqSubtitle: string;
  faqShowFewer: string;
  /** `{count}` 치환 */
  faqMoreQuestionsTemplate: string;
  faqFooterTitle: string;
  faqFooterLink: string;
  reviewsTitle: string;
  reviewsSubtitle: string;
  /** `{total}` 치환 */
  reviewsBasedOnTemplate: string;
  reviewsGuestsMention: string;
  reviewsShowFewerReviews: string;
  /** `{count}` 치환 */
  reviewsShowAllTemplate: string;
  reviewsVerified: string;
  reviewsReadMore: string;
  reviewsShowLess: string;
  /** `{count}` 치환 */
  reviewsHelpfulTemplate: string;
  reviewsCtaTitle: string;
  reviewsCtaSubtitle: string;
  reviewsWriteReview: string;
  /** Optional pickup/drop-off timeline copy; EN defaults used when omitted. */
  pickupCardTitle?: string;
  /** `{count}` placeholder */
  pickupLocationsTemplate?: string;
  pickupCategoryLabel?: string;
  dropoffCardTitle?: string;
  dropoffApproxLabel?: string;
  dropoffPointBadge?: string;
  dropoffLocationsTemplate?: string;
  dropoffReturnNote?: string;
  /** Optional port-selector copy used by cruise shore-excursion products. */
  portSelectorEyebrow?: string;
  portSelectorCtaPrefix?: string;
  /** Pickup & Drop-off dedicated section (rendered between itinerary and details). */
  pickupDropoffTitle?: string;
  pickupDropoffSubtitle?: string;
  /** `{pickup}` and `{dropoff}` placeholders — e.g., "{pickup} pickup · {dropoff} drop-off" */
  pickupMapBadgeTemplate?: string;
  /** `{time}` placeholder */
  pickupRouteDepartsTemplate?: string;
  pickupTrustFooter?: string;
  dropoffReturnHeading?: string;
  pickupApproximateLabel?: string;
  /** Recommendations / "You might also like" section copy. */
  recommendationsEyebrow?: string;
  recommendationsTitle?: string;
  recommendationsSubtitle?: string;
  recommendationsFromLabel?: string;
  /** Itinerary stop card "Tickets included" badge. */
  ticketsIncludedLabel?: string;
};

export const DEFAULT_TOUR_PRODUCT_SECTION_UI_EN: TourProductSectionUiV1 = {
  atAGlanceTitle: "At a glance",
  atAGlanceSubtitle: "A quick read on scenery, walking comfort, and overall fit.",
  atmosphereTitle: "See the route atmosphere",
  atmosphereSubtitle: "Before the details, this is how the day feels.",
  itineraryTitle: "Your Day, Stop by Stop",
  itinerarySubtitle: "Each stop builds naturally into the next. Expand any for full detail.",
  dayFlowStopsPrefix: "Stops",
  stopHighlightsHeading: "Highlights",
  stopTimeUsedHeading: "How the time is used",
  stopVisitBasicsHeading: "Visit basics",
  stopVisitHoursLabel: "Hours",
  stopVisitAdmissionLabel: "Admission",
  stopVisitWalkingLabel: "Walking",
  stopVisitClosedLabel: "Closed",
  stopSmartNotesHeading: "Smart notes",
  stopSmartNotesPhotoPrefix: "Photo:",
  stopSmartNotesTipPrefix: "Tip:",
  fitTitle: "Why this tour suits you",
  fitSubtitle: "Who this cadence suits and how the day is sequenced.",
  fitBestForLabel: "Best for",
  fitLessIdealLabel: "Less ideal for",
  fitFamiliesPrefix: "Families:",
  fitFamiliesText:
    "Fits depend on this route’s stops and pacing—see the day-flow and practical sections for age notes.",
  fitSeniorsPrefix: "Seniors:",
  fitSeniorsText:
    "Comfort levels vary by segment; use lighter options where offered and confirm walking expectations for this itinerary.",
  fitRouteLogicTitle: "Route logic",
  fitRouteLogicSubtitle: "Pacing, sequence, stop timing, and why the day flows this way",
  practicalTitle: "Practical details",
  practicalSubtitle: "Pickup, walking, weather, packing, and inclusions.",
  seasonalTitle: "Seasonal variations",
  seasonalSubtitle: "How this route feels through the year.",
  bookingSupportTitle: "Booking & support",
  bookingSupportSubtitle: "Add reachable contact at checkout, then your confirmation email, then your guide the day before.",
  bookingAfterTitle: "After booking",
  bookingAfterSubtitle:
    "At checkout, add a phone, WhatsApp, and LINE you actually use. You’ll get a confirmation email next, and the day before the tour your guide contacts you on WhatsApp, LINE, or phone.",
  bookingSupportEmptyHint:
    "Support steps for this product are not configured yet. Be sure the phone / WhatsApp / LINE you add at booking are ones you check.",
  faqTitle: "Questions",
  faqSubtitle: "The few questions that usually decide it.",
  faqShowFewer: "Show fewer",
  faqMoreQuestionsTemplate: "{count} more questions",
  faqFooterTitle: "Questions before booking?",
  faqFooterLink: "Message us anytime",
  reviewsTitle: "Guest Reviews",
  reviewsSubtitle: "What travelers say about this experience.",
  reviewsBasedOnTemplate: "Based on {total} reviews",
  reviewsGuestsMention: "Guests frequently mention",
  reviewsShowFewerReviews: "Show fewer reviews",
  reviewsShowAllTemplate: "Show all {count} reviews",
  reviewsVerified: "Verified",
  reviewsReadMore: "Read more",
  reviewsShowLess: "Show less",
  reviewsHelpfulTemplate: "Helpful ({count})",
  reviewsCtaTitle: "Been on this tour?",
  reviewsCtaSubtitle: "Share your experience to help other travelers.",
  reviewsWriteReview: "Write a Review",
  pickupCardTitle: "Pickup",
  pickupLocationsTemplate: "{count} locations",
  pickupCategoryLabel: "Hotel pickup",
  dropoffCardTitle: "Drop-off",
  dropoffApproxLabel: "approx.",
  dropoffPointBadge: "Drop-off Point",
  dropoffLocationsTemplate: "{count} drop-off locations",
  dropoffReturnNote: "Return to pickup points available on request",
  portSelectorEyebrow: "Choose your docking port",
  portSelectorCtaPrefix: "Docking at",
};

/** 정적 번들 한국어 — DB `detail_payload.sectionUi` 없을 때 Jeju 등에서 사용 */
export const DEFAULT_TOUR_PRODUCT_SECTION_UI_KO: TourProductSectionUiV1 = {
  atAGlanceTitle: "한눈에 보기",
  atAGlanceSubtitle: "풍경, 도보 부담, 전체적인 맞춤도를 빠르게 살펴보세요.",
  atmosphereTitle: "코스의 분위기",
  atmosphereSubtitle: "세부 일정 전에, 하루가 어떻게 느껴지는지부터 보세요.",
  itineraryTitle: "정차지별 하루 일정",
  itinerarySubtitle: "각 정차는 자연스럽게 이어집니다. 펼쳐서 상세 정보를 확인하세요.",
  dayFlowStopsPrefix: "정차",
  stopHighlightsHeading: "하이라이트",
  stopTimeUsedHeading: "시간 활용",
  stopVisitBasicsHeading: "방문 정보",
  stopVisitHoursLabel: "운영 시간",
  stopVisitAdmissionLabel: "입장",
  stopVisitWalkingLabel: "도보",
  stopVisitClosedLabel: "휴무",
  stopSmartNotesHeading: "현장 팁",
  stopSmartNotesPhotoPrefix: "사진:",
  stopSmartNotesTipPrefix: "팁:",
  fitTitle: "이 투어가 잘 맞는 이유",
  fitSubtitle: "이 템포가 어울리는 분과 하루를 어떻게 배치하는지 안내합니다.",
  fitBestForLabel: "이렇게 추천",
  fitLessIdealLabel: "덜 맞을 수 있는 분",
  fitFamiliesPrefix: "가족:",
  fitFamiliesText:
    "이 일정의 정차·템포에 따라 다릅니다. 연령 관련 안내는 일정·실용 정보를 확인하세요.",
  fitSeniorsPrefix: "시니어:",
  fitSeniorsText:
    "구간별로 편차가 있습니다. 가벼운 옵션이 있으면 활용하고, 도보·계단은 실제 코스 기준으로 확인하세요.",
  fitRouteLogicTitle: "코스 설계",
  fitRouteLogicSubtitle: "템포, 순서, 정차 시간, 하루가 이렇게 흘러가는 이유",
  practicalTitle: "실용 정보",
  practicalSubtitle: "픽업, 도보, 날씨, 준비물, 포함 사항.",
  seasonalTitle: "계절별 느낌",
  seasonalSubtitle: "이 코스가 사계절에 어떻게 다가오는지.",
  bookingSupportTitle: "예약과 지원",
  bookingSupportSubtitle: "예약 시 실제로 받는 연락처 → 예약 확정 메일 → 투어 전날 가이드 직접 연락 순서입니다.",
  bookingAfterTitle: "예약 이후",
  bookingAfterSubtitle:
    "예약할 때 먼저 꼭 확인하는 휴대폰·왓스앱·라인(또는 링크)을 남기세요. 이어서 예약 확정 메일이 가고, 투어 전날 가이드가 왓스앱·라인·전화로 직접 연락드립니다.",
  bookingSupportEmptyHint:
    "이 상품에 대한 단계 안내가 아직 없습니다. 예약 시 기재한 휴대폰/왓스앱/라인이 실제로 확인 가능한지 다시 점검해 주세요.",
  faqTitle: "자주 묻는 질문",
  faqSubtitle: "결정에 도움이 되는 핵심 질문들.",
  faqShowFewer: "접기",
  faqMoreQuestionsTemplate: "추가 질문 {count}개",
  faqFooterTitle: "예약 전 더 궁금하신가요?",
  faqFooterLink: "언제든 메시지 주세요",
  reviewsTitle: "게스트 후기",
  reviewsSubtitle: "이 경험에 대해 여행자들이 말하는 것.",
  reviewsBasedOnTemplate: "총 {total}개 후기 기준",
  reviewsGuestsMention: "후기에 자주 등장하는 키워드",
  reviewsShowFewerReviews: "후기 접기",
  reviewsShowAllTemplate: "전체 {count}개 후기 보기",
  reviewsVerified: "인증됨",
  reviewsReadMore: "더 읽기",
  reviewsShowLess: "접기",
  reviewsHelpfulTemplate: "도움됨 ({count})",
  reviewsCtaTitle: "이 투어 다녀오셨나요?",
  reviewsCtaSubtitle: "다른 여행자에게 경험을 공유해 주세요.",
  reviewsWriteReview: "후기 작성",
  pickupDropoffTitle: "픽업 · 드롭오프",
  pickupDropoffSubtitle: "호텔 픽업 포함. 위치를 탭하면 상세 안내가 열립니다.",
  pickupMapBadgeTemplate: "픽업 {pickup}곳 · 드롭오프 {dropoff}곳",
  pickupRouteDepartsTemplate: "마지막 픽업 후 {time}에 출발",
  pickupTrustFooter: "호텔 픽업 포함 · 추가 비용 없음",
  dropoffReturnHeading: "드롭오프 가능 위치",
  pickupApproximateLabel: "대략",
  recommendationsEyebrow: "다음 탐색",
  recommendationsTitle: "이런 투어도 있어요",
  recommendationsSubtitle: "템포도, 강조점도 달라요. 각자 하루를 만듭니다.",
  recommendationsFromLabel: "최저",
  ticketsIncludedLabel: "입장권 포함",
};

/** 정적 번들 日本語 */
export const DEFAULT_TOUR_PRODUCT_SECTION_UI_JA: TourProductSectionUiV1 = {
  atAGlanceTitle: "ひと目でわかる",
  atAGlanceSubtitle: "景色・歩きやすさ・全体の向き不向きを短時間で把握。",
  atmosphereTitle: "このルートの雰囲気",
  atmosphereSubtitle: "詳細の前に、まずは一日のトーンをイメージ。",
  itineraryTitle: "一日の行程・停留所",
  itinerarySubtitle: "各停留所は自然につながります。タップして詳細を表示。",
  dayFlowStopsPrefix: "停留所",
  stopHighlightsHeading: "見どころ",
  stopTimeUsedHeading: "時間の使い方",
  stopVisitBasicsHeading: "訪問の基本情報",
  stopVisitHoursLabel: "時間",
  stopVisitAdmissionLabel: "料金",
  stopVisitWalkingLabel: "歩行",
  stopVisitClosedLabel: "休み",
  stopSmartNotesHeading: "現地のヒント",
  stopSmartNotesPhotoPrefix: "写真:",
  stopSmartNotesTipPrefix: "ヒント:",
  fitTitle: "このツアーが向いている理由",
  fitSubtitle: "誰に合うペースか、一日がどう組み立てられているか。",
  fitBestForLabel: "こんな方に",
  fitLessIdealLabel: "向かない場合",
  fitFamiliesPrefix: "ファミリー:",
  fitFamiliesText:
    "向き不向きは停留所とペース次第です。年齢の目安は行程・実用情報をご確認ください。",
  fitSeniorsPrefix: "シニア:",
  fitSeniorsText:
    "区間ごとに差があります。軽めの見学があれば活用し、この行程の歩行イメージをご確認ください。",
  fitRouteLogicTitle: "ルートの考え方",
  fitRouteLogicSubtitle: "テンポ・順序・時間配分、なぜこの流れになるか",
  practicalTitle: "実用情報",
  practicalSubtitle: "送迎・歩行・天候・持ち物・含まれるもの。",
  seasonalTitle: "季節ごとの雰囲気",
  seasonalSubtitle: "一年を通じてこのルートがどう感じられるか。",
  bookingSupportTitle: "予約とサポート",
  bookingSupportSubtitle: "予約時の連絡先 → 予約確定メール → 前日のガイドからの直接連絡。",
  bookingAfterTitle: "予約後",
  bookingAfterSubtitle:
    "先に、普段使う番号・WhatsApp・LINE（ID・リンク）を登録してください。次に予約確定メール。ツアー前日、ガイドがWhatsApp・LINE・電話で直接連絡します。",
  bookingSupportEmptyHint:
    "手順のデータが未設定の場合があります。予約で入力した電話番号・WhatsApp・LINEが、実際に受け取れるかご確認ください。",
  faqTitle: "よくある質問",
  faqSubtitle: "決めるときに多い質問です。",
  faqShowFewer: "閉じる",
  faqMoreQuestionsTemplate: "あと{count}件",
  faqFooterTitle: "予約前に確認したいことがありますか？",
  faqFooterLink: "いつでもメッセージください",
  reviewsTitle: "ゲストレビュー",
  reviewsSubtitle: "参加された方の声です。",
  reviewsBasedOnTemplate: "レビュー {total} 件を反映",
  reviewsGuestsMention: "よく出るキーワード",
  reviewsShowFewerReviews: "レビューを閉じる",
  reviewsShowAllTemplate: "レビューをすべて表示（{count}）",
  reviewsVerified: "確認済み",
  reviewsReadMore: "続きを読む",
  reviewsShowLess: "閉じる",
  reviewsHelpfulTemplate: "参考になった（{count}）",
  reviewsCtaTitle: "このツアーに参加しましたか？",
  reviewsCtaSubtitle: "体験を共有して、他の旅行者の参考にしてください。",
  reviewsWriteReview: "レビューを書く",
  pickupDropoffTitle: "送迎・解散",
  pickupDropoffSubtitle: "ホテル送迎込み。各地点をタップで詳細を表示。",
  pickupMapBadgeTemplate: "ピックアップ {pickup} · 解散 {dropoff}",
  pickupRouteDepartsTemplate: "最終ピックアップ後 {time} に出発",
  pickupTrustFooter: "ホテル送迎込み・追加料金なし",
  dropoffReturnHeading: "解散可能な場所",
  pickupApproximateLabel: "目安",
  recommendationsEyebrow: "次に見る",
  recommendationsTitle: "こちらもおすすめ",
  recommendationsSubtitle: "テンポも見どころも別もの。それぞれが一日になります。",
  recommendationsFromLabel: "から",
  ticketsIncludedLabel: "入場料込み",
};

/** 简体中文 UI */
export const DEFAULT_TOUR_PRODUCT_SECTION_UI_ZH: TourProductSectionUiV1 = {
  atAGlanceTitle: "快速了解",
  atAGlanceSubtitle: "快速把握风景、步行强度与整体适合度。",
  atmosphereTitle: "路线氛围",
  atmosphereSubtitle: "先看氛围，再读细节。",
  itineraryTitle: "一日行程 · 逐站说明",
  itinerarySubtitle: "每一站自然衔接，点开后可查看完整信息。",
  dayFlowStopsPrefix: "站点",
  stopHighlightsHeading: "亮点",
  stopTimeUsedHeading: "时间怎么安排",
  stopVisitBasicsHeading: "参观要点",
  stopVisitHoursLabel: "开放时间",
  stopVisitAdmissionLabel: "门票",
  stopVisitWalkingLabel: "步行",
  stopVisitClosedLabel: "休园",
  stopSmartNotesHeading: "现场提示",
  stopSmartNotesPhotoPrefix: "拍照：",
  stopSmartNotesTipPrefix: "提示：",
  fitTitle: "为什么这条路线适合你",
  fitSubtitle: "适合谁、节奏如何安排、站点如何串联。",
  fitBestForLabel: "更适合",
  fitLessIdealLabel: "不太适合",
  fitFamiliesPrefix: "亲子：",
  fitFamiliesText: "是否适合取决于站点与节奏，年龄相关说明请见行程与实用信息。",
  fitSeniorsPrefix: "长辈：",
  fitSeniorsText: "不同路段差异较大；如有更轻松的选择可优先采用，并请确认步行强度。",
  fitRouteLogicTitle: "路线逻辑",
  fitRouteLogicSubtitle: "节奏、顺序、停留时间，以及为什么这样走",
  practicalTitle: "实用信息",
  practicalSubtitle: "接送、步行、天气、穿着与包含项目。",
  seasonalTitle: "四季感受",
  seasonalSubtitle: "这条路线在一年四季分别是什么体验。",
  bookingSupportTitle: "预订与支持",
  bookingSupportSubtitle: "预定时留下能接到的联系方式，然后是确认邮件，再是出发前一日导游直接联系。",
  bookingAfterTitle: "预订之后",
  bookingAfterSubtitle:
    "请先在预定时留下常用手机、WhatsApp、Line 或可加好友的链接。随后您会收到确认邮件，出发前一天导游会通过 WhatsApp、Line 或电话直接联系您。",
  bookingSupportEmptyHint:
    "此产品的分步说明尚未配置。请确认预订时填写的手机、WhatsApp、Line 能正常接收信息。",
  faqTitle: "常见问题",
  faqSubtitle: "通常会决定选择的关键问题。",
  faqShowFewer: "收起",
  faqMoreQuestionsTemplate: "还有 {count} 个问题",
  faqFooterTitle: "预订前还有疑问？",
  faqFooterLink: "随时给我们留言",
  reviewsTitle: "用户评价",
  reviewsSubtitle: "看看其他旅客怎么说。",
  reviewsBasedOnTemplate: "基于 {total} 条评价",
  reviewsGuestsMention: "大家常提到",
  reviewsShowFewerReviews: "收起评价",
  reviewsShowAllTemplate: "查看全部 {count} 条评价",
  reviewsVerified: "已验证",
  reviewsReadMore: "展开",
  reviewsShowLess: "收起",
  reviewsHelpfulTemplate: "有帮助（{count}）",
  reviewsCtaTitle: "参加过这条路线吗？",
  reviewsCtaSubtitle: "分享你的体验，帮助更多旅客做决定。",
  reviewsWriteReview: "写评价",
  pickupDropoffTitle: "接送说明",
  pickupDropoffSubtitle: "包含酒店接送。点击任一地点查看详情。",
  pickupMapBadgeTemplate: "接 {pickup} 处 · 送 {dropoff} 处",
  pickupRouteDepartsTemplate: "最后一站接客后 {time} 出发",
  pickupTrustFooter: "包含酒店接送 · 无额外费用",
  dropoffReturnHeading: "可送达地点",
  pickupApproximateLabel: "大约",
  recommendationsEyebrow: "下一站",
  recommendationsTitle: "你可能也喜欢",
  recommendationsSubtitle: "节奏不同，重点不同。每一条都是一天的故事。",
  recommendationsFromLabel: "起价",
  ticketsIncludedLabel: "含门票",
};

/** 繁體中文 UI */
export const DEFAULT_TOUR_PRODUCT_SECTION_UI_ZH_TW: TourProductSectionUiV1 = {
  atAGlanceTitle: "快速了解",
  atAGlanceSubtitle: "快速掌握風景、步行強度與整體適合度。",
  atmosphereTitle: "路線氛圍",
  atmosphereSubtitle: "先看氛圍，再讀細節。",
  itineraryTitle: "一日行程 · 逐站說明",
  itinerarySubtitle: "每一站自然銜接，點開後可查看完整資訊。",
  dayFlowStopsPrefix: "站點",
  stopHighlightsHeading: "亮點",
  stopTimeUsedHeading: "時間怎麼安排",
  stopVisitBasicsHeading: "參觀要點",
  stopVisitHoursLabel: "開放時間",
  stopVisitAdmissionLabel: "門票",
  stopVisitWalkingLabel: "步行",
  stopVisitClosedLabel: "休園",
  stopSmartNotesHeading: "現場提示",
  stopSmartNotesPhotoPrefix: "拍照：",
  stopSmartNotesTipPrefix: "提示：",
  fitTitle: "為什麼這條路線適合你",
  fitSubtitle: "適合誰、節奏如何安排、站點如何串連。",
  fitBestForLabel: "更適合",
  fitLessIdealLabel: "不太適合",
  fitFamiliesPrefix: "親子：",
  fitFamiliesText: "是否適合取決於站點與節奏，年齡相關說明請見行程與實用資訊。",
  fitSeniorsPrefix: "長輩：",
  fitSeniorsText: "不同路段差異較大；如有更輕鬆的選擇可優先採用，並請確認步行強度。",
  fitRouteLogicTitle: "路線邏輯",
  fitRouteLogicSubtitle: "節奏、順序、停留時間，以及為什麼這樣走",
  practicalTitle: "實用資訊",
  practicalSubtitle: "接送、步行、天氣、穿著與包含項目。",
  seasonalTitle: "四季感受",
  seasonalSubtitle: "這條路線在一年四季分別是什麼體驗。",
  bookingSupportTitle: "預訂與支援",
  bookingSupportSubtitle: "預訂時留下能接到的聯絡方式，然後是確認信，再是出發前一日導遊直接聯絡。",
  bookingAfterTitle: "預訂之後",
  bookingAfterSubtitle:
    "請先在預訂時留下常用手機、WhatsApp、Line 或加好友連結。隨後會收到預訂確認信，出發前一日導遊會以 WhatsApp、Line 或電話直接聯絡。",
  bookingSupportEmptyHint:
    "此產品步驟說明尚未建立。請確認預訂所填手機、WhatsApp、Line 能正常收訊。",
  faqTitle: "常見問題",
  faqSubtitle: "通常會決定選擇的關鍵問題。",
  faqShowFewer: "收合",
  faqMoreQuestionsTemplate: "還有 {count} 個問題",
  faqFooterTitle: "預訂前還有疑問？",
  faqFooterLink: "隨時傳訊給我們",
  reviewsTitle: "旅客評價",
  reviewsSubtitle: "看看其他旅客怎麼說。",
  reviewsBasedOnTemplate: "依 {total} 則評價",
  reviewsGuestsMention: "大家常提到",
  reviewsShowFewerReviews: "收合評價",
  reviewsShowAllTemplate: "查看全部 {count} 則評價",
  reviewsVerified: "已驗證",
  reviewsReadMore: "展開",
  reviewsShowLess: "收合",
  reviewsHelpfulTemplate: "有幫助（{count}）",
  reviewsCtaTitle: "參加過這條路線嗎？",
  reviewsCtaSubtitle: "分享你的體驗，幫助更多旅客做決定。",
  reviewsWriteReview: "寫評價",
  pickupDropoffTitle: "接送說明",
  pickupDropoffSubtitle: "包含飯店接送。點擊任一地點查看詳情。",
  pickupMapBadgeTemplate: "接 {pickup} 處 · 送 {dropoff} 處",
  pickupRouteDepartsTemplate: "最後一站接客後 {time} 出發",
  pickupTrustFooter: "包含飯店接送 · 無額外費用",
  dropoffReturnHeading: "可送達地點",
  pickupApproximateLabel: "約略",
  recommendationsEyebrow: "下一站",
  recommendationsTitle: "你可能也會喜歡",
  recommendationsSubtitle: "節奏不同，重點不同。每一條都是一天的故事。",
  recommendationsFromLabel: "起價",
  ticketsIncludedLabel: "含門票",
};

/** UI en español */
export const DEFAULT_TOUR_PRODUCT_SECTION_UI_ES: TourProductSectionUiV1 = {
  atAGlanceTitle: "De un vistazo",
  atAGlanceSubtitle: "Paisaje, caminata y encaje general, en lectura rápida.",
  atmosphereTitle: "Ambiente de la ruta",
  atmosphereSubtitle: "Antes del detalle, así se siente el día.",
  itineraryTitle: "Tu día, parada por parada",
  itinerarySubtitle: "Cada parada encaja con la siguiente. Abre cualquiera para ver el detalle.",
  dayFlowStopsPrefix: "Paradas",
  stopHighlightsHeading: "Destacados",
  stopTimeUsedHeading: "Uso del tiempo",
  stopVisitBasicsHeading: "Datos básicos",
  stopVisitHoursLabel: "Horario",
  stopVisitAdmissionLabel: "Entrada",
  stopVisitWalkingLabel: "Caminata",
  stopVisitClosedLabel: "Cierre",
  stopSmartNotesHeading: "Consejos",
  stopSmartNotesPhotoPrefix: "Foto:",
  stopSmartNotesTipPrefix: "Tip:",
  fitTitle: "Por qué este tour te encaja",
  fitSubtitle: "A quién le encaja el ritmo y cómo se ordena el día.",
  fitBestForLabel: "Ideal para",
  fitLessIdealLabel: "Menos ideal para",
  fitFamiliesPrefix: "Familias:",
  fitFamiliesText:
    "Depende de las paradas y el ritmo; consulta el flujo del día y la sección práctica para notas por edades.",
  fitSeniorsPrefix: "Mayores:",
  fitSeniorsText:
    "El confort varía por tramo; usa opciones más ligeras si las hay y confirma el nivel de caminata de este itinerario.",
  fitRouteLogicTitle: "Lógica de la ruta",
  fitRouteLogicSubtitle: "Ritmo, orden, tiempos y por qué el día fluye así",
  practicalTitle: "Detalles prácticos",
  practicalSubtitle: "Recogida, caminata, clima, equipaje e inclusiones.",
  seasonalTitle: "Variaciones por estación",
  seasonalSubtitle: "Cómo se siente esta ruta a lo largo del año.",
  bookingSupportTitle: "Reserva y apoyo",
  bookingSupportSubtitle: "Contacto al reservar, luego el email de confirmación y, el día anterior, tu guía.",
  bookingAfterTitle: "Tras reservar",
  bookingAfterSubtitle:
    "Al reservar, deja un móvil, WhatsApp y LINE con los que realmente respondas. Llegará el email de confirmación, y el día anterior tu guía te contactará (WhatsApp, LINE o teléfono).",
  bookingSupportEmptyHint:
    "Aún no hay pasos definidos. Comprueba que el móvil, WhatsApp o LINE que dejaste al reservar sean accesibles.",
  faqTitle: "Preguntas",
  faqSubtitle: "Las dudas que suelen decidir la reserva.",
  faqShowFewer: "Ver menos",
  faqMoreQuestionsTemplate: "{count} preguntas más",
  faqFooterTitle: "¿Dudas antes de reservar?",
  faqFooterLink: "Escríbenos cuando quieras",
  reviewsTitle: "Opiniones",
  reviewsSubtitle: "Lo que dicen los viajeros sobre esta experiencia.",
  reviewsBasedOnTemplate: "Según {total} opiniones",
  reviewsGuestsMention: "Menciones frecuentes",
  reviewsShowFewerReviews: "Ver menos opiniones",
  reviewsShowAllTemplate: "Ver las {count} opiniones",
  reviewsVerified: "Verificada",
  reviewsReadMore: "Leer más",
  reviewsShowLess: "Leer menos",
  reviewsHelpfulTemplate: "Útil ({count})",
  reviewsCtaTitle: "¿Hiciste este tour?",
  reviewsCtaSubtitle: "Comparte tu experiencia para ayudar a otros viajeros.",
  reviewsWriteReview: "Escribir opinión",
  pickupDropoffTitle: "Recogida y regreso",
  pickupDropoffSubtitle: "Recogida en hotel incluida. Toca cualquier punto para ver detalles.",
  pickupMapBadgeTemplate: "{pickup} recogida · {dropoff} regreso",
  pickupRouteDepartsTemplate: "La ruta sale tras la última recogida a las {time}",
  pickupTrustFooter: "Recogida en hotel incluida · Sin coste extra",
  dropoffReturnHeading: "Regreso disponible en",
  pickupApproximateLabel: "Aproximado",
  recommendationsEyebrow: "Explora más",
  recommendationsTitle: "También te puede gustar",
  recommendationsSubtitle: "Ritmo distinto, énfasis distinto. Cada uno es su propio día.",
  recommendationsFromLabel: "desde",
  ticketsIncludedLabel: "Entrada incluida",
};

function pickSectionUiKeys(raw: unknown): Partial<TourProductSectionUiV1> {
  if (typeof raw !== "object" || raw === null) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<TourProductSectionUiV1> = {};
  for (const key of Object.keys(DEFAULT_TOUR_PRODUCT_SECTION_UI_EN) as (keyof TourProductSectionUiV1)[]) {
    const v = o[key];
    if (typeof v === "string" && v.trim() !== "") {
      out[key] = v;
    }
  }
  return out;
}

/** Locale-aware defaults so partial `detail_payload.sectionUi` does not mix EN strings into KO rows. */
export function mergeTourProductSectionUi(raw?: unknown, locale?: string | null): TourProductSectionUiV1 {
  let loc = (locale ?? "en").toLowerCase();
  if (loc === "zh-cn") loc = "zh";
  const base: TourProductSectionUiV1 =
    loc === "ko"
      ? DEFAULT_TOUR_PRODUCT_SECTION_UI_KO
      : loc === "ja"
        ? DEFAULT_TOUR_PRODUCT_SECTION_UI_JA
        : loc === "zh"
          ? DEFAULT_TOUR_PRODUCT_SECTION_UI_ZH
          : loc === "zh-tw"
            ? DEFAULT_TOUR_PRODUCT_SECTION_UI_ZH_TW
            : loc === "es"
              ? DEFAULT_TOUR_PRODUCT_SECTION_UI_ES
              : DEFAULT_TOUR_PRODUCT_SECTION_UI_EN;
  return { ...base, ...pickSectionUiKeys(raw) };
}
