-- ============================================================================
-- 2026-06-24-14 — "Not suitable for" (lessIdealFor) backfill, 3 tours
-- ============================================================================
-- 31 of 34 tours already author whyTourWorks.lessIdealFor with tour-specific
-- copy; only these 3 were empty across all 6 locales. Fills them with grounded,
-- tour-specific content (season window / per-vehicle pricing / cruise timing).
-- Mirrors the static-bundle backfill committed alongside.
--
-- IDEMPOTENT + NON-DESTRUCTIVE: only writes when lessIdealFor is absent/empty;
-- never overwrites the 31 existing entries. Keyed by (slug, locale). 18 rows.
-- ============================================================================

BEGIN;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Off-season visitors — the plum-and-cherry overlap only runs roughly Feb 25 – Apr 10","Travelers who want minimal walking (temple grounds and blossom paths have steps and uneven ground)","Stroller-heavy groups (rural blossom roadsides and temple stairs)","Anyone wanting a shopping- or city-focused day rather than temples and seasonal blossoms"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'en'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["비수기 방문객 — 매화와 벚꽃이 겹치는 시기는 대략 2월 25일–4월 10일뿐입니다","걷는 것을 최소화하고 싶은 여행객 (사찰 경내와 꽃길에 계단과 고르지 않은 길이 있음)","유모차가 많은 그룹 (농촌 꽃길 도로변과 사찰 계단)","사찰과 계절 꽃보다 쇼핑이나 도심 위주의 하루를 원하는 분"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ko'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["オフシーズンの方 — 梅と桜が重なるのは概ね2月25日〜4月10日のみです","歩行を最小限にしたい方（寺院の境内や花見の道は階段や不整地があります）","ベビーカー利用の多いグループ（農村の花道の路肩や寺院の階段）","寺院や季節の花よりも、ショッピングや都市中心の一日を望む方"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ja'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["非花季游客 — 梅花与樱花重叠期大约只在2月25日至4月10日","希望尽量少步行的游客（寺院庭院和赏花步道有台阶和不平路面）","婴儿车较多的团体（乡间花道路边和寺院台阶）","想要购物或城市为主的一天，而非寺院与时令花卉的游客"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["非花季遊客 — 梅花與櫻花重疊期大約只在2月25日至4月10日","希望盡量少步行的遊客（寺院庭園和賞花步道有台階和不平路面）","嬰兒車較多的團體（鄉間花道路邊和寺院台階）","想要購物或城市為主的一天，而非寺院與時令花卉的遊客"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh-TW'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Visitantes fuera de temporada: la coincidencia de ciruelo y cerezo solo ocurre aproximadamente del 25 de febrero al 10 de abril","Viajeros que quieren caminar lo mínimo (los recintos de los templos y los senderos de flores tienen escalones y terreno irregular)","Grupos con muchos cochecitos (bordes de caminos rurales floridos y escaleras de templos)","Cualquiera que prefiera un día de compras o de ciudad en lugar de templos y flores de temporada"]'::jsonb, true)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'es'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Solo or budget travelers — private pricing is per vehicle, not per person","Travelers who want to mix with other guests for a social, group-tour atmosphere","Cruise passengers whose port call is too short for a full 8-hour day ashore","Anyone wanting a fixed, pre-set route rather than planning the day with the guide"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'en'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["1인 또는 예산 중시 여행객 — 프라이빗 요금은 인원당이 아니라 차량당입니다","다른 손님들과 어울리는 단체 투어 분위기를 원하는 여행객","기항 시간이 짧아 8시간 종일 일정이 어려운 크루즈 승객","가이드와 함께 일정을 짜기보다 고정된 사전 코스를 원하는 분"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'ko'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["お一人様や予算重視の方 — プライベート料金は人数単位ではなく車両単位です","他のゲストと交流する団体ツアーの雰囲気を求める方","寄港時間が短く、8時間の終日上陸が難しいクルーズ乗客","ガイドと一緒に計画するより、固定の事前ルートを望む方"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'ja'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["单人或预算有限的游客 — 私人价格按车辆计算，而非按人数","希望与其他客人同行、享受团体氛围的游客","靠港时间过短、无法安排8小时全天上岸的邮轮乘客","想要固定预设路线，而非与向导一起规划行程的游客"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'zh'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["單人或預算有限的遊客 — 私人價格按車輛計算，而非按人數","希望與其他客人同行、享受團體氛圍的遊客","靠港時間過短、無法安排8小時全天上岸的郵輪乘客","想要固定預設路線，而非與嚮導一起規劃行程的遊客"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'zh-TW'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Viajeros solos o con presupuesto ajustado: el precio privado es por vehículo, no por persona","Viajeros que quieren mezclarse con otros huéspedes en un ambiente de grupo","Pasajeros de crucero cuya escala es demasiado corta para un día completo de 8 horas en tierra","Cualquiera que prefiera una ruta fija y predefinida en lugar de planificar el día con el guía"]'::jsonb, true)
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'es'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Off-season visitors — departures run only late March to early April for peak bloom","Travelers who want minimal walking (blossom strolls at Bomun Lake and Daereungwon)","Stroller-heavy groups on crowded peak-season blossom paths","Anyone wanting deep, unhurried time at one site rather than a highlights circuit"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'en'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["비수기 방문객 — 만개 시기에 맞춰 3월 말–4월 초에만 운행합니다","걷는 것을 최소화하고 싶은 여행객 (보문호수와 대릉원의 꽃길 산책)","성수기 붐비는 꽃길에서 유모차가 많은 그룹","하이라이트 순회보다 한 곳에서 깊고 여유로운 시간을 원하는 분"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ko'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["オフシーズンの方 — 満開に合わせて3月下旬〜4月上旬のみ運行します","歩行を最小限にしたい方（普門湖や大陵苑の花見散策）","繁忙期の混雑した花道でベビーカー利用の多いグループ","ハイライト周遊より、一か所でゆっくり過ごす時間を望む方"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ja'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["非花季游客 — 仅在3月下旬至4月上旬盛花期运营","希望尽量少步行的游客（普门湖与大陵苑赏花漫步）","在盛季拥挤花道上婴儿车较多的团体","想在一处深度从容停留，而非高光景点环游的游客"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["非花季遊客 — 僅在3月下旬至4月上旬盛花期運營","希望盡量少步行的遊客（普門湖與大陵苑賞花漫步）","在盛季擁擠花道上嬰兒車較多的團體","想在一處深度從容停留，而非高光景點環遊的遊客"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh-TW'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{whyTourWorks,lessIdealFor}', '["Visitantes fuera de temporada: las salidas solo operan de finales de marzo a principios de abril para la floración máxima","Viajeros que quieren caminar lo mínimo (paseos entre flores en el lago Bomun y Daereungwon)","Grupos con muchos cochecitos en senderos de flores concurridos en plena temporada","Cualquiera que prefiera tiempo profundo y sin prisas en un solo lugar en vez de un circuito de lo más destacado"]'::jsonb, true)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'es'
  AND detail_payload->'whyTourWorks' IS NOT NULL
  AND jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor', '[]'::jsonb)) = 0;

COMMIT;

-- Verification
SELECT slug, locale,
  jsonb_array_length(COALESCE(detail_payload->'whyTourWorks'->'lessIdealFor','[]'::jsonb)) AS n
FROM public.tour_product_pages
WHERE slug IN ('busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju', 'busan-private-car-charter-cruise-shore', 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour')
ORDER BY slug, locale;
