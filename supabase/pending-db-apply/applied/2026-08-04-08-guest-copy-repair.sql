-- =============================================================================
-- Guest-facing copy repair — dev comment in the booking bar + translator notes
-- =============================================================================
-- Generated: 2026-08-04 by scripts/gen-copy-repair-sql-2026-08.mjs
--
-- WHY THIS FILE EXISTS: tourProductPageBody.tsx loads the page from Supabase
-- FIRST and only falls back to the repo JSON bundle. Repairing the bundles does
-- not reach guests; tour_product_pages.detail_payload has to be repaired too.
--
-- TWO DEFECTS, both pre-existing:
--   1) sticky_booking_bar.note shipped a developer comment
--      ("checkout_tour_id resolves at runtime…") as guest-facing booking copy.
--   2) Translator working-notes were appended to live fields — itinerary
--      highlights, route phases, booking steps, pricing labels, and 40 CSS
--      class fields (iconBg), where the class string itself was corrupted so
--      the icon rendered with no background. See PASS 2 below.
--      were appended to live fields — itinerary highlights, route phases,
--      booking steps, pricing labels. Two were iconBg values, i.e. the CSS
--      class string itself was corrupted.
--
-- SAFETY: every statement is a surgical jsonb_set on ONE path, guarded by a
-- WHERE clause asserting the current value is still the exact polluted string.
-- It is therefore idempotent (re-running is a no-op) and cannot clobber a value
-- edited through the admin Product Editor, which also writes detail_payload.
-- Rows that no longer match are left alone.
--
-- page_sections.* mirrors are deliberately NOT repaired: segments.ts marks that
-- block DEAD and a test asserts the render path never reads it. (129 paths skipped.)
--
-- Statements: 228 across 31 products.
-- Run order: this file is 08 and must stay LAST — 02/03/05/07 rewrite whole
-- detail_payloads and Gyeongju (07) still writes five of the polluted strings.
-- =============================================================================

BEGIN;

-- ---- busan-cruise-shore-excursion-bus-tour -----------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"itineraryStops","2","timeUsed","2"}', '"Área Simbólica (22 banderas) + Muro del Recuerdo (~20 min)"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-cruise-shore-excursion-bus-tour' AND locale = 'es'
  AND detail_payload #>> '{"itineraryStops","2","timeUsed","2"}' = 'Área Simbólica (22 banderas) + Muro del Recuerdo (~20 min) > **Notes:** Lines 18–21 are file paths and have been left unchanged. Numeric durations (lines 12, 22) and proper nouns/place names (Daeungjeon, Haesu Gwaneum, Daeungjeon, AtoC Korea) are preserved as-is per travel content convention.';

-- ---- busan-gyeongju-unesco-legacy-tour-national-museum -----------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-gyeongju-unesco-legacy-tour-national-museum' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-gyeongju-unesco-legacy-tour-national-museum' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase／環境変数から解決されます。静的JSONBの一部ではありません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-gyeongju-unesco-legacy-tour-national-museum' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경변수에서 결정되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-gyeongju-unesco-legacy-tour-national-museum' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-gyeongju-unesco-legacy-tour-national-museum' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase / 環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju ------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = '`checkout_tour_id` se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase / envから解決されるものであり、静的なJSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- busan-private-car-charter-cruise-shore ----------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / env 中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析，不屬於靜態 JSONB 的一部分。';

-- ---- busan-small-group-sightseeing-tour-cruise-passengers --------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"itineraryStops","2","timeUsed","2"}', '"Área Simbólica (22 banderas) + Muro del Recuerdo (~20 min)"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'es'
  AND detail_payload #>> '{"itineraryStops","2","timeUsed","2"}' = 'Área Simbólica (22 banderas) + Muro del Recuerdo (~20 min) > **Notes:** Lines 18–21 are file paths and have been left unchanged. Numeric durations (lines 12, 22) and proper nouns/place names (Daeungjeon, Haesu Gwaneum, Daeungjeon, AtoC Korea) are preserved as-is per travel content convention.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","5","detail"}', '"Seguimiento y recomendaciones"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","5","detail"}' = 'Seguimiento y recomendaciones > **Notas:** Las líneas **6**, **9** y **12** (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) son clases CSS de Tailwind y se han mantenido sin cambios, ya que son código técnico y no texto traducible.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = '`checkout_tour_id` は実行時に Supabase / 環境変数から解決されます。静的 JSONB には含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임에 Supabase / 환경변수에서 결정됨; 정적 JSONB의 일부가 아님.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","5","detail"}', '"后续跟进及个性化推荐建议"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'zh'
  AND detail_payload #>> '{"bookingSupportSteps","5","detail"}' = '后续跟进及个性化推荐建议 > **说明：** 第6、9、12行为CSS样式类名（`bg-emerald-50/80`、`bg-sky-50/80`、`bg-amber-50/80`），属于技术代码字符串，保持原文不作翻译。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = '`checkout_tour_id` 在运行时从 Supabase / 环境变量解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-small-group-sightseeing-tour-cruise-passengers' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = '`checkout_tour_id` 於執行時期從 Supabase／環境變數動態解析；不屬於靜態 JSONB 的組成部分。';

-- ---- busan-spring-cherry-blossom-gyeongju-highlights-day-tour ----------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id は実行時にSupabase／環境変数から解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임에 Supabase / 환경 변수에서 결정되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase／环境变量解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時期從 Supabase／環境變數解析；非靜態 JSONB 的一部分。';

-- ---- busan-top-attractions-day-tour ------------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id は実行時に Supabase / 環境変数から解決されます。静的 JSONB の一部ではありません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / env에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量解析，不属于静态 JSONB 的组成部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／env 動態解析；不屬於靜態 JSONB 的一部分。';

-- ---- east-signature-nature-core ----------------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routeFlowStops","0","theme"}', '"Geología"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core' AND locale = 'es'
  AND detail_payload #>> '{"routeFlowStops","0","theme"}' = 'Geología > **Note:** *Seongeup Folk Village* is retained as a proper place name (standard practice for named landmarks in travel content). All descriptive terms have been fully translated.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","items","0","label"}', '"Comienza con la cultura de la piedra, luego se abre hacia el mar"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","items","0","label"}' = 'Comienza con la cultura de la piedra, luego se abre hacia el mar **Notes:** - Items **1, 5, 7, 9** are proper Korean place names — kept as-is per travel content convention. - Item **24** is a CSS utility class — kept unchanged as it is code, not translatable text. - Item **4** ("Reset") is rendered as **Pausa** (pause/break) to fit the travel itinerary context naturally.';

-- ---- from-busan-gyeongju-ancient-capital-day-tour ----------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(código CSS — no se traduce)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / entorno; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / env 解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- from-incheon-seoul-day-tour-cruise-guests -------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'El checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase / 環境変数から解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경변수에서 확인됩니다. 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數動態解析；不屬於靜態 JSONB 的一部分。';

-- ---- incheon-seoul-private-car-shore-excursion-cruise ------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id はSupabase／環境変数から実行時に解決されます。静的なJSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析，不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；非靜態 JSONB 的一部分。';

-- ---- jeju-cherry-blossom-tour-east-route -------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routePhases","0","phase"}', '"Picos de floración de los cerezos"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"routePhases","0","phase"}' = 'Picos de floración de los cerezos --- **Notes:** - **haenyeo** (12) — retained as a proper Korean cultural term (female sea divers of Jeju). - **Jeonnong-ro / Noksan-ro** (13, 15) — retained as proper Korean street names (*로* = road/avenue). - **Micheongul** (19) — retained as the proper cave name. - **Ilchul Land** (21) / **Seongsan** (23) — retained as proper place names.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","items","0","label"}', '"**La ventana de los cerezos dura de 7 a 10 días**"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","items","0","label"}' = '**La ventana de los cerezos dura de 7 a 10 días** > **Note:** Lines 16 and 24 (`bg-amber-50/80`, `bg-pink-50/80`) are CSS utility class names and have been kept as-is, since they are technical code values, not translatable text.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","1","timing"}', '"**2 días antes**"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","1","timing"}' = '**2 días antes** > **Note:** Lines 15, 18, and 21 are Tailwind CSS utility class names — they are technical strings and should remain unchanged in code.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인됩니다. 정적 JSONB에는 포함되지 않습니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routeFlowStops","1","theme"}', '"田园花开"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh'
  AND detail_payload #>> '{"routeFlowStops","1","theme"}' = '田园花开 --- **Notes:** - **Lines 1–5**: File paths kept as-is (technical strings, not translatable). - **Line 21** *haenyeo* → **海女** — standard Chinese rendering of the Jeju female diver cultural term. - **Line 22** *Jeonnong-ro* → **典农路** — Hanja-based rendering (典農 + 路). - **Line 23** *Urban Bloom* → **都市花开** — natural Chinese equivalent for an urban floral scene. - **Line 24** *Noksan-ro* → **绿山路** — Hanja-based rendering (綠山 + 路). - **Line 25** *Country Bloom* → **田园花开** — standard Chinese phrasing for a rural blossom scene.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","lessIdealFor","2"}', '"携带婴儿车较多的团体（乡村路边景点）"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh'
  AND detail_payload #>> '{"whyTourWorks","lessIdealFor","2"}' = '携带婴儿车较多的团体（乡村路边景点） > **说明：** 第8条（`bg-pink-50/80`）和第16条（`bg-sky-50/80`）为CSS样式类名，属于技术代码，保留原文不作翻译。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routeFlowStops","1","theme"}', '"田園花海"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"routeFlowStops","1","theme"}' = '田園花海 --- **Notes:** - **1–5**: File paths are left unchanged (technical strings, not translated). - **城山日出峰**: Standard Traditional Chinese rendering of Seongsan Ilchulbong. - **海女** (haenyeo): The classic Chinese term for Jeju''s traditional female divers. - **田農路 / 鹿山路**: Hanja-based renderings of the Korean road names. - **都市花海 / 田園花海**: Natural travel-copy phrasing for "Urban/Country Bloom."';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行階段從 Supabase／環境變數中解析，不屬於靜態 JSONB 的一部分。';

-- ---- jeju-cruise-shore-excursion-bus-tour ------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"itineraryStops","2","highlights","1"}', '"**Faro de Bangdupo** — octagonal, **destella cada 4 seg**, en la cima del cono volcánico rojo Bulgeun Oreum"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'es'
  AND detail_payload #>> '{"itineraryStops","2","highlights","1"}' = '**Faro de Bangdupo** — octagonal, **destella cada 4 seg**, en la cima del cono volcánico rojo Bulgeun Oreum --- **Notas de traducción:** - **Líneas 1, 2, 23** — Rutas de archivo técnicas; no se traducen. - **Líneas 3–17** — *Seongsan Ilchulbong* es nombre propio; se conserva en todas las repeticiones. - **Línea 18** — *Haenyeo* es un término cultural coreano sin equivalente directo; se mantiene tal cual. - **Línea 22** — Las etiquetas `
` se conservan íntegras tal como aparecen en el original.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"itineraryStops","3","highlights","0"}', '"Restaurante del este de Jeju aprobado por el guía — área de Seongsan / Seongeup / Pyoseon"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'es'
  AND detail_payload #>> '{"itineraryStops","3","highlights","0"}' = 'Restaurante del este de Jeju aprobado por el guía — área de Seongsan / Seongeup / Pyoseon --- **Notes:** - Lines 1–3 are file paths and are kept unchanged, as URLs/paths are not translated. - Korean dish names (제주 흑돼지, 갈치조림, *banchan*, *heukdwaeji*, *Galchi Jorim*) and Korean won (₩) symbols are preserved as-is, consistent with travel content conventions. - All `
` markup tags and `**bold**`/`*italic*` formatting are preserved exactly.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","items","1","detail"}', '"汉拿山1100高山区+柱状节理带+天帝渊瀑布+偶来市场。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","items","1","detail"}' = '汉拿山1100高山区+柱状节理带+天帝渊瀑布+偶来市场。 > **Note:** Item 21 (`bg-sky-50/80`) is a Tailwind CSS class name and has been left untranslated as it is a technical code value.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"itineraryStops","2","highlights","1"}', '"**防頭浦燈塔** — 八角形，**每 4 秒閃爍一次**，矗立於불근오름（紅色火山錐）頂端"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"itineraryStops","2","highlights","1"}' = '**防頭浦燈塔** — 八角形，**每 4 秒閃爍一次**，矗立於불근오름（紅色火山錐）頂端 > **Notes:** File paths (lines 1, 2, 23) are left unchanged as technical values. Korean proper noun 불근오름 in line 25 is retained with a parenthetical translation.';

-- ---- jeju-cruise-shore-excursion-small-group-tour ----------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","items","0","detail"}', '"Grupo más pequeño, mayor atención del guía, ritmo más rápido en las paradas."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","items","0","detail"}' = 'Grupo más pequeño, mayor atención del guía, ritmo más rápido en las paradas. > **Note:** Lines **20** and **28** (`bg-sky-50/80`, `bg-amber-50/80`) are CSS utility classes and have been left untranslated as they are technical code values, not natural language content.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","0","timing"}', '"Inmediatamente"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","0","timing"}' = 'Inmediatamente > **Notes:** Lines 23, 26, and 29 are CSS utility class names (Tailwind) and have been kept as-is, since they are technical/code values and should not be translated.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático. user_port se resuelve en el momento de la reserva a partir del itinerario del crucero.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"priceSource","discountNote"}', '"10 % de descuento sobre el precio base del marketplace"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'es'
  AND detail_payload #>> '{"priceSource","discountNote"}' = '**10 % de descuento sobre el precio base del marketplace** --- > **Notas:** > - **Líneas 3 y 4:** Son nombres de componentes de interfaz de usuario (UI). Se conservan en su forma original, ya que traducirlos podría romper referencias en el código. > - **Línea 5:** El contenido técnico (nombres de variables, términos de sistema) se mantiene en inglés; solo se traduce el texto descriptivo en prosa.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。user_portは予約時にクルーズ旅程から解決されます。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"priceSource","discountNote"}', '"マーケットプレイス基準価格より10%割引"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ja'
  AND detail_payload #>> '{"priceSource","discountNote"}' = '**マーケットプレイス基準価格より10%割引**';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인됩니다. 정적 JSONB의 일부가 아닙니다. user_port는 크루즈 일정에서 예약 시 확인됩니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"priceSource","discountNote"}', '"마켓플레이스 기준가 대비 10% 할인"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ko'
  AND detail_payload #>> '{"priceSource","discountNote"}' = '**마켓플레이스 기준가 대비 10% 할인** --- > **참고 (3, 4번):** `TourReviewsSection`, `TourStickyBookingBar`는 코드 컴포넌트 명칭으로, 소스 코드 내에서는 번역 없이 원문을 그대로 사용하는 것이 일반적입니다. UI에 표시되는 레이블이 별도로 필요하다면 각각 **"투어 리뷰"**, **"예약하기"** 등으로 현지화할 수 있습니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","0","timing"}', '"立即"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh'
  AND detail_payload #>> '{"bookingSupportSteps","0","timing"}' = '立即 > **Note:** Items 23, 26, and 29 (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are Tailwind CSS class names and have been left untranslated as they are technical identifiers, not display text.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量解析，不属于静态 JSONB 的一部分。user_port 在预订时从邮轮行程中解析。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。user_port 於預訂時從郵輪行程解析。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"priceSource","discountNote"}', '"較市場基準價格優惠 10%"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"priceSource","discountNote"}' = '較市場基準價格優惠 10% **Notes:** - **Lines 3 & 4** — Retained as-is; these are UI component identifiers (code names) with no translatable natural-language content. - **Line 5** — Technical/developer note; code tokens (`checkout_tour_id`, `user_port`, `JSONB`) kept verbatim, surrounding descriptive text translated. - **Line 6** — Rendered as a natural marketing phrase (較市場基準價格優惠 10%) rather than a literal word-for-word render.';

-- ---- jeju-grand-highlights-loop ----------------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","5","title"}', '"Asistencia posterior al recorrido"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","5","title"}' = 'Asistencia posterior al recorrido > **Note:** Items **7**, **10**, and **13** (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are CSS utility class names and have been left untranslated as they are technical identifiers, not natural language.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase / envから実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- jeju-hydrangea-festival-tour-southwest-route ----------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","items","2","label"}', '"Camellia Hill no es temporada de camelias"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","items","2","label"}' = 'Camellia Hill no es temporada de camelias > **Notes:** > - Items **17** and **25** (`bg-amber-50/80`, `bg-pink-50/80`) are Tailwind CSS class names and have been left untranslated as they are technical identifiers. > - Proper nouns (Hyeopjae, Hallim, Camellia Hill, Osulloc, Hallasan, Aewol, UNESCO) are retained as-is, which is standard practice in travel content.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"practicalAccordionItems","3","title"}', '"Política en caso de mal tiempo"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'es'
  AND detail_payload #>> '{"practicalAccordionItems","3","title"}' = 'Política en caso de mal tiempo > **Nota sobre la línea 3:** `bg-sky-50/80` es un nombre de clase CSS/Tailwind y se ha dejado sin traducir, ya que es código técnico.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase / 環境変数から解決されます。静的なJSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임에 Supabase / 환경변수에서 확인됩니다. 정적 JSONB의 구성 요소가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id在运行时从Supabase/环境变量中解析；不属于静态JSONB的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- jeju-island-private-car-charter-tour ------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-amber-50/80 > **Notas:** Las líneas **22** y **30** (`bg-sky-50/80`, `bg-amber-50/80`) son clases de CSS de Tailwind y se han dejado sin traducir, ya que son nombres de código técnico.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","1","timing"}', '"12 horas antes"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","1","timing"}' = '12 horas antes > **Notes:** Items 20, 23, and 26 (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are Tailwind CSS class names — kept as-is since they are code values, not translatable text. All proper nouns (Hyeopjae, Hamdeok, Hallasan, Seongsan, Camellia Hill, Jeju) are retained unchanged.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / entorno; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","1","timing"}', '"出發前12小時"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"bookingSupportSteps","1","timing"}' = '出發前12小時 > **Notes:** Items 20, 23, and 26 (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are CSS class names and have been left untranslated. Jeju place names follow standard Traditional Chinese travel conventions: 狹才 (Hyeopjae), 咸德 (Hamdeok), 漢拏山 (Hallasan), 城山 (Seongsan).';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- jeju-southern-top-unesco-spots-tour -------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","3","timing"}', '"La mañana del tour"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-southern-top-unesco-spots-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","3","timing"}' = 'La mañana del tour > **Note:** Items **3**, **7**, and **11** (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are Tailwind CSS utility class names — these are code identifiers and are left untranslated as they are not natural-language content.';

-- ---- jeju-west-south-full-day-authentic-tour ---------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id は実行時にSupabase / 環境変数から解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임에 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"practicalAccordionItems","2","content","0"}', '"轻度至中度。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'zh'
  AND detail_payload #>> '{"practicalAccordionItems","2","content","0"}' = '轻度至中度。 > **说明：** 第2项（`bg-amber-50/80`）和第10项（`bg-sky-50/80`）为Tailwind CSS样式类名，属于代码标识符，保持原文不译。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id在运行时从Supabase/环境变量中解析，不属于静态JSONB的组成部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id於執行時從Supabase／環境變數解析；非靜態JSONB的一部分。';

-- ---- jeju-winter-southwest-tangerine-snow-camellia-tour ----------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routeFlowStops","0","theme"}', '"Salida"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-winter-southwest-tangerine-snow-camellia-tour' AND locale = 'es'
  AND detail_payload #>> '{"routeFlowStops","0","theme"}' = 'Salida > **Notes:** Lines 1–3 are file paths/URLs and have been left unchanged, as they are technical identifiers that should not be translated. The `
` tags in line 16 have been preserved as-is.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","0","detail"}', '"Confirmación de reserva con resumen del itinerario"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-winter-southwest-tangerine-snow-camellia-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","0","detail"}' = 'Confirmación de reserva con resumen del itinerario > **Notes:** Items **13**, **17**, and **21** (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are Tailwind CSS class names and were left untranslated as they are UI/code tokens, not display text.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","0","detail"}', '"附行程摘要的訂位確認通知"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-winter-southwest-tangerine-snow-camellia-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"bookingSupportSteps","0","detail"}' = '附行程摘要的訂位確認通知 > **Notes:** Lines 1, 13, 17, and 21 were kept as-is — the dash (—) and CSS class strings (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are non-translatable tokens.';

-- ---- seoul-dmz-private-3rd-tunnel-suspension-bridge --------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routePhases","0","phase"}', '"Memorial y Túnel"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'es'
  AND detail_payload #>> '{"routePhases","0","phase"}' = 'Memorial y Túnel > **Note:** Lines 4–7 are file paths and have been left unchanged, as they are not translatable text. Lines 17 (*Imjingak*) and 18 (*Memorial*) are retained as-is — *Imjingak* is a proper noun, and *Memorial* is identical in Spanish.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'El checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"pricingTiers","tiers","11","paxLabel"}', '"14–15 pax"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'es'
  AND detail_payload #>> '{"pricingTiers","tiers","11","paxLabel"}' = '14–15 pax > **Note:** The abbreviation **pax** (from Latin *pax*, widely used in the travel industry to mean *pasajeros/personas*) is kept as-is in lines 2–13, as it is standard and universally understood in Spanish-language travel and tourism contexts. Line 1 **"flat"** is rendered as **"tarifa fija"** (fixed/flat rate), the standard Spanish travel industry term for a set price regardless of minor variable factors.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id は Supabase / 環境変数から実行時に解決されます。静的 JSONB の一部ではありません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"pricingTiers","tiers","11","paxLabel"}', '"14〜15名"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ja'
  AND detail_payload #>> '{"pricingTiers","tiers","11","paxLabel"}' = '14〜15名 > **Note:** *pax*（旅行業界用語：人数）は日本語で **名（めい）** と訳しています。*flat* は料金文脈で「一律」または「フラット」と表現しています。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","description"}', '"专为该路线量身定制的规模"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh'
  AND detail_payload #>> '{"bookingTrustItems","2","description"}' = '专为该路线量身定制的规模 > **Notes:** Lines 20 and 23 are CSS utility class strings — left untranslated as-is. "Dora Observatory" rendered as **都拉展望台** (standard transliteration); "Gamaksan" rendered as **甘岳山** (phonetic Hanja approximation); "DMZ" rendered as **非军事区** (standard Chinese term).';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / env 解析，不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"pricingTiers","tiers","11","paxLabel"}', '"14–15人"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh'
  AND detail_payload #>> '{"pricingTiers","tiers","11","paxLabel"}' = '14–15人 **Notes:** - **flat** → 统一价 (flat/fixed rate, common in travel pricing contexts) - **pax** → 人 (standard travel industry term for passengers/persons, rendered as 人 in Chinese)';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","description"}', '"專為本路線量身調配的人數規模"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh-TW'
  AND detail_payload #>> '{"bookingTrustItems","2","description"}' = '專為本路線量身調配的人數規模 > **Notes:** Lines 20 & 23 (`bg-emerald-50/80`, `bg-sky-50/80`) are Tailwind CSS class names — kept as-is since they are code tokens, not translatable text. Korean place names rendered in Hanja: 都羅展望台 (도라전망대 · Dora Observatory), 紺岳山 (감악산 · Gamaksan).';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時期從 Supabase／環境變數解析；非靜態 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"pricingTiers","tiers","11","paxLabel"}', '"14–15 人"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh-TW'
  AND detail_payload #>> '{"pricingTiers","tiers","11","paxLabel"}' = '14–15 人 > **Note:** *pax* (travel industry term for passengers/persons) is rendered as **人** throughout. *Flat* is rendered as **統一價** (fixed/flat rate), appropriate for a pricing-tier context.';

-- ---- seoul-private-nami-morning-calm-petite-france ---------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routePhases","0","phase"}', '"Apertura de la Isla Nami"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'es'
  AND detail_payload #>> '{"routePhases","0","phase"}' = 'Apertura de la Isla Nami > **Notes:** Lines 8–10 are file paths and kept unchanged. Proper nouns (*Petite France*, *Italian Village*, *Gapyeong*, *Cheongpyeong*, *Saint-Exupéry*) are preserved as-is. "My Love from the Star" is rendered as *"Mi amor de las estrellas"*, its widely used Spanish title.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-amber-50/80 > **Notes:** Lines **17** and **25** (`bg-sky-50/80`, `bg-amber-50/80`) appear to be Tailwind CSS utility classes and have been left unchanged, as they are not translatable content.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","3","detail"}', '"Resumen matutino basado en las condiciones en tiempo real"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'es'
  AND detail_payload #>> '{"bookingSupportSteps","3","detail"}' = 'Resumen matutino basado en las condiciones en tiempo real > **Notes:** Items **7**, **10**, and **13** (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are CSS utility class names — technical strings with no natural-language equivalent — so they are left untranslated as-is.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routePhases","0","phase"}', '"南怡島オープナー"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'ja'
  AND detail_payload #>> '{"routePhases","0","phase"}' = '南怡島オープナー > **Notes:** File paths (8–10) are kept verbatim. Proper nouns — *Petite France, Nami Island (南怡島), Garden of Morning Calm (朝の静寂の庭), My Love from the Star (星から来たあなた), Saint-Exupéry, Gapyeong (加平), Cheongpyeong (清平)* — are rendered in their established Japanese equivalents or phonetic katakana where no standard kanji form exists.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id は Supabase / 環境変数から実行時に解決されます。静的 JSONB には含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"routePhases","0","phase"}', '"南怡岛开篇"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh'
  AND detail_payload #>> '{"routePhases","0","phase"}' = '南怡岛开篇 > **Notes:** File paths (8–10) are left unchanged as they are technical strings. "Reset" (20) is rendered as **休整** (rest/recharge) to fit travel-itinerary context. "Morning Calm" (21) is rendered as **晨静**, aligning with the established Korean attraction name 晨静树木园 (Garden of Morning Calm).';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingSupportSteps","3","detail"}', '"根据实时路况的晨间行程简报"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh'
  AND detail_payload #>> '{"bookingSupportSteps","3","detail"}' = '根据实时路况的晨间行程简报 > **Notes:** Items 7, 10, and 13 (`bg-emerald-50/80`, `bg-sky-50/80`, `bg-amber-50/80`) are Tailwind CSS utility class names — technical strings that are kept as-is since they are not natural-language content.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时通过 Supabase / 环境变量解析，不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數動態解析，不屬於靜態 JSONB 的一部分。';

-- ---- seoul-seoraksan-national-park-sokcho-beach-day-trip ---------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase／環境変数から解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；非靜態 JSONB 的一部分。';

-- ---- seoul-suburbs-private-chartered-car-10hr --------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"practicalAccordionItems","0","content","1"}', '"Los alojamientos fuera del centro de Seúl pueden incurrir en una tarifa adicional de recogida"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"practicalAccordionItems","0","content","1"}' = 'Los alojamientos fuera del centro de Seúl pueden incurrir en una tarifa adicional de recogida > **Note:** Lines 3 and 11 (`bg-amber-50/80` and `bg-slate-50/80`) are Tailwind CSS utility classes — they are code values, not natural language, so they are left unchanged.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析，不属于静态 JSONB 的组成部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行階段從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- seoul-suwon-hwaseong-folk-village-starfield-library ---------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／envから実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인됩니다. 정적 JSONB에는 포함되지 않습니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析，不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時期由 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library -----------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'El checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 결정되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量解析，不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在執行時從 Supabase／環境變數解析；不屬於靜態 JSONB 的一部分。';

-- ---- seoul-suwon-hwaseong-waujeongsa-starfield -------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Select your date and group size to check live availability and complete your booking."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'en'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idは実行時にSupabase／環境変数から解決されます。静的なJSONBには含まれません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임 시 Supabase / 환경 변수에서 확인되며, 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析，不屬於靜態 JSONB 的一部分。';

-- ---- southwest-hallasan-osulloc-aewol ----------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selecciona la fecha y el tamaño de tu grupo para comprobar la disponibilidad en tiempo real y completar tu reserva."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'es'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id se resuelve en tiempo de ejecución desde Supabase / env; no forma parte del JSONB estático.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"日付と人数を選択すると、リアルタイムの空き状況を確認して予約を完了できます。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'ja'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_idはSupabase／環境変数から実行時に解決されます。静的JSONBの一部ではありません。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"날짜와 인원을 선택하면 실시간 예약 가능 여부를 확인하고 예약을 완료할 수 있습니다."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'ko'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id는 런타임에 Supabase / 환경변수에서 확인됩니다. 정적 JSONB의 일부가 아닙니다.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"选择日期与人数，即可查看实时可订状态并完成预订。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'zh'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 在运行时从 Supabase / 环境变量中解析；不属于静态 JSONB 的一部分。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"選擇日期與人數，即可查看即時可訂狀態並完成預訂。"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'zh-TW'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id 於執行時從 Supabase／環境變數解析；非靜態 JSONB 的一部分。';


-- =============================================================================
-- PASS 2 — variants the first sweep missed (found 2026-08-04, same session)
-- =============================================================================
-- The first sweep grepped one Spanish phrasing ("no se traduce") and missed the
-- others ("sin traducción", "clase CSS", "código técnico", the zh/ja/zh-TW
-- equivalents, and values wrapped in ** or backticks). A stricter detector —
-- "does this CSS-class field still look like a class list?" — found 38 more
-- corrupted iconBg values plus 2 more translator notes.
--
-- Every replacement class name is taken from the product's OWN en.json at the
-- same path (class names are locale-invariant), not guessed. One had the colour
-- word itself translated: bg-ámbar-50/80 -> bg-amber-50/80.
-- =============================================================================

-- ---- jeju-cherry-blossom-tour-east-route -------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","iconBg"}' = '**bg-amber-50/80**';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-pink-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = '**bg-pink-50/80**';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = '**bg-emerald-50/80** *(clase CSS — sin cambios)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-pink-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = '**bg-pink-50/80** *(clase CSS — sin cambios)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = '**bg-sky-50/80** *(clase CSS — sin cambios)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ja'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 *(UIクラス名・翻訳対象外)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-pink-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ja'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = 'bg-pink-50/80 *(UIクラス名・翻訳対象外)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ja'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-sky-50/80 *(UIクラス名・翻訳対象外)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","iconBg"}' = 'bg-amber-50/80 > **注：** 第25项（`bg-amber-50/80`）为 Tailwind CSS 样式类名，属技术代码，保持原文不译。第3项"迷川窟"（미천굴）为济州岛熔岩洞窟专有名称，按音译处理。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","iconBg"}' = 'bg-amber-50/80 > **注意 (Note 25):** `bg-amber-50/80` is a Tailwind CSS utility class — left untranslated as it is a code token, not display text.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 *(保留原文——Tailwind CSS 樣式類別，無需翻譯)*';

-- ---- jeju-cruise-shore-excursion-bus-tour ------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 *(CSS 类名，保留原文)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = 'bg-sky-50/80 *(CSS 类名，保留原文)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(CSS 类名，保留原文)*';

-- ---- jeju-grand-highlights-loop ----------------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","iconBg"}' = '**bg-amber-50/80** → bg-amber-50/80';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = '**bg-sky-50/80** → bg-sky-50/80';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","2","iconBg"}', '"bg-slate-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","2","iconBg"}' = '**bg-slate-50/80** → bg-slate-50/80';

-- ---- jeju-hydrangea-festival-tour-southwest-route ----------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'ja'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 > **注：** 30行目はCSSクラス名のため、翻訳せずそのまま記載しています。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"practicalAccordionItems","3","title"}', '"天氣政策"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'zh-TW'
  AND detail_payload #>> '{"practicalAccordionItems","3","title"}' = '天氣政策 > **Note on line 3:** `bg-sky-50/80` is a Tailwind CSS utility class name — left untranslated as it is a code token, not readable content.';

-- ---- jeju-island-private-car-charter-tour ------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-amber-50/80 > **注：** 第 22 项（`bg-sky-50/80`）和第 30 项（`bg-amber-50/80`）为 CSS 样式类名，属于技术标识符，保留原文不作翻译。';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh-TW'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-amber-50/80 > **注意**：第 22 行（`bg-sky-50/80`）及第 30 行（`bg-amber-50/80`）為 Tailwind CSS 樣式類別名稱，屬於技術代碼，保持原文不譯。';

-- ---- jeju-west-south-full-day-authentic-tour ---------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = '`bg-emerald-50/80` *(clase CSS — se mantiene igual)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = '`bg-sky-50/80` *(clase CSS — se mantiene igual)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'jeju-west-south-full-day-authentic-tour' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = '`bg-amber-50/80` *(clase CSS — se mantiene igual)*';

-- ---- seoul-dmz-private-3rd-tunnel-suspension-bridge --------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","2","iconBg"}', '"bg-rose-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","2","iconBg"}' = 'bg-rose-50/80 *(CSS类名，无需翻译)*';

-- ---- seoul-seoraksan-national-park-sokcho-beach-day-trip ---------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-emerald-50/80 *(clase CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-seoraksan-national-park-sokcho-beach-day-trip' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","2","iconBg"}' = 'bg-amber-50/80 *(clase CSS — sin traducción)*';

-- ---- seoul-suburbs-private-chartered-car-10hr --------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","0","items","2","label"}', '"El conocimiento de tu conductor-guía"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","0","items","2","label"}' = 'El conocimiento de tu conductor-guía > **Note on line 20:** `bg-sky-50/80` is a Tailwind CSS utility class — it has been left untranslated as it is a code token, not display text.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","1","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","1","iconBg"}' = 'bg-amber-50/80 *(clase CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","2","iconBg"}', '"bg-slate-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","2","iconBg"}' = 'bg-slate-50/80 *(clase CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 *(código técnico — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = 'bg-sky-50/80 *(código técnico — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(código técnico — sin traducción)*';

-- ---- seoul-suwon-hwaseong-folk-village-starfield-library ---------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"whyTourWorks","routeLogicSections","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"whyTourWorks","routeLogicSections","2","iconBg"}' = 'bg-ámbar-50/80';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-folk-village-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(clase CSS — sin traducción)*';

-- ---- seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library -----------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = 'bg-sky-50/80 *(código CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(código CSS — sin traducción)*';

-- ---- southwest-hallasan-osulloc-aewol ----------------------------------
UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","0","iconBg"}', '"bg-emerald-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","0","iconBg"}' = 'bg-emerald-50/80 *(código CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","1","iconBg"}', '"bg-sky-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","1","iconBg"}' = 'bg-sky-50/80 *(código CSS — sin traducción)*';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"bookingTrustItems","2","iconBg"}', '"bg-amber-50/80"'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'es'
  AND detail_payload #>> '{"bookingTrustItems","2","iconBg"}' = 'bg-amber-50/80 *(código CSS — sin traducción)*';

-- ---- staged locales (de/fr/it/ru) — DB-only rows, no repo bundle ------
-- These four rows per product were seeded by the i18n expansion track and have
-- no bundle file, so the bundle-diff generator above could not see them. Guests
-- do not read them yet (TOUR_PRODUCT_FALLBACK_URL_LOCALES narrows these locales
-- to EN) but the dev comment would ship the day that gate opens.
-- Written per row with an exact guard, like every other statement in this file:
-- the dev comment exists in four different phrasings across these three
-- products (two of them ship the ENGLISH sentence under a de/fr/it heading),
-- so the guards are the values read back from the live rows, not a pattern.
-- Replacement copy is the wording already authored for these locales in the
-- Pocheon and Busan bundles — the sentence is product-independent.

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Wählen Sie Datum und Gruppengröße, um die aktuelle Verfügbarkeit zu prüfen und Ihre Buchung abzuschließen."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'de'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Sélectionnez votre date et la taille de votre groupe pour vérifier les disponibilités en direct et finaliser votre réservation."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'fr'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id est résolu à l''exécution depuis Supabase / env ; ne fait pas partie du JSONB statique.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selezioni la data e il numero di partecipanti per verificare la disponibilità in tempo reale e completare la prenotazione."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'it'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id viene risolto a runtime da Supabase / env; non fa parte del JSONB statico.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Выберите дату и размер группы, чтобы проверить актуальные места и завершить бронирование."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'from-incheon-seoul-day-tour-cruise-guests' AND locale = 'ru'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id определяется во время выполнения из Supabase / env; не является частью статического JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Wählen Sie Datum und Gruppengröße, um die aktuelle Verfügbarkeit zu prüfen und Ihre Buchung abzuschließen."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'de'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id wird zur Laufzeit aus Supabase / env aufgelöst; nicht Teil des statischen JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Sélectionnez votre date et la taille de votre groupe pour vérifier les disponibilités en direct et finaliser votre réservation."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'fr'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id est résolu à l''exécution depuis Supabase / env ; ne fait pas partie du JSONB statique.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selezioni la data e il numero di partecipanti per verificare la disponibilità in tempo reale e completare la prenotazione."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'it'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id viene risolto a runtime da Supabase / env; non fa parte del JSONB statico.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Выберите дату и размер группы, чтобы проверить актуальные места и завершить бронирование."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'incheon-seoul-private-car-shore-excursion-cruise' AND locale = 'ru'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id определяется во время выполнения из Supabase / env; не является частью статического JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Wählen Sie Datum und Gruppengröße, um die aktuelle Verfügbarkeit zu prüfen und Ihre Buchung abzuschließen."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'de'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Sélectionnez votre date et la taille de votre groupe pour vérifier les disponibilités en direct et finaliser votre réservation."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'fr'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Selezioni la data e il numero di partecipanti per verificare la disponibilità in tempo reale e completare la prenotazione."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'it'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.';

UPDATE public.tour_product_pages SET
  detail_payload = jsonb_set(detail_payload, '{"sticky_booking_bar","note"}', '"Выберите дату и размер группы, чтобы проверить актуальные места и завершить бронирование."'::jsonb, false),
  updated_at = NOW()
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ru'
  AND detail_payload #>> '{"sticky_booking_bar","note"}' = 'checkout_tour_id определяется во время выполнения из Supabase / env; не является частью статического JSONB.';

COMMIT;

-- =============================================================================
-- Verify — expect 0 for all three (run after this file)
-- =============================================================================
-- The previous version of this check matched only the ENGLISH dev comment, so
-- it read 0 while 145 localised rows were still polluted. Match the field, not
-- one phrasing.
--
-- WITH bar AS (
--   SELECT slug, locale FROM public.tour_product_pages
--    WHERE detail_payload #>> '{sticky_booking_bar,note}' LIKE '%checkout_tour_id%'),
-- trust AS (
--   SELECT p.slug, p.locale FROM public.tour_product_pages p
--   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.detail_payload->'bookingTrustItems','[]'::jsonb)) e(v)
--    WHERE e.v->>'iconBg' IS NOT NULL AND e.v->>'iconBg' !~ '^[-a-z0-9/:.\[\]% ]+$'),
-- route AS (
--   SELECT p.slug, p.locale FROM public.tour_product_pages p
--   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.detail_payload#>'{whyTourWorks,routeLogicSections}','[]'::jsonb)) e(v)
--    WHERE e.v->>'iconBg' IS NOT NULL AND e.v->>'iconBg' !~ '^[-a-z0-9/:.\[\]% ]+$')
-- SELECT 'booking-bar dev comment' AS defect, count(*) FROM bar
-- UNION ALL SELECT 'bookingTrustItems iconBg', count(*) FROM trust
-- UNION ALL SELECT 'routeLogicSections iconBg', count(*) FROM route;
--
-- Baseline before this file: 145 / 24 / 14.
