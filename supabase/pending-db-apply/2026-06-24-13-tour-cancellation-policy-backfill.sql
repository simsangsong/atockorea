-- ============================================================================
-- 2026-06-24-13 — tour cancellation-policy backfill (AI-readability)
-- ============================================================================
-- Adds the standard cancellation accordion item to tour_product_pages.detail_payload
-- for the 15 tours whose authored bundle lacked one. Mirrors the static-bundle
-- backfill committed alongside (the bundle is the authoring source; this syncs
-- the live DB the page reads first, and feeds the Offer.cancellationPolicy JSON-LD).
--
-- APPEND-ONLY + IDEMPOTENT: each UPDATE only appends when no 'cancellation' item
-- already exists, and never rewrites the rest of detail_payload (no full-refresh,
-- no regression of other admin edits). Safe to re-run.
-- Keyed by (slug, locale). 90 rows across 6 locales.
-- ============================================================================

BEGIN;

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'busan-top-attractions-day-tour' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'east-signature-nature-core' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-cherry-blossom-tour-east-route' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-bus-tour' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-cruise-shore-excursion-small-group-tour' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-grand-highlights-loop' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-hydrangea-festival-tour-southwest-route' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'jeju-island-private-car-charter-tour' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'seoul-dmz-private-3rd-tunnel-suspension-bridge' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'seoul-private-nami-morning-calm-petite-france' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'seoul-suburbs-private-chartered-car-10hr' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'seoul-suwon-hwaseong-waujeongsa-starfield' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancellation","preview":"Free cancellation up to 24 hours before pickup.","content":["Free cancellation up to 24 hours before pickup.","Same-day cancellations and no-shows are non-refundable."]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'en'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"취소 정책","preview":"픽업 24시간 전까지 무료 취소.","content":["픽업 24시간 전까지 무료 취소.","당일 취소 및 노쇼는 환불되지 않습니다."]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'ko'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"キャンセルポリシー","preview":"ピックアップの24時間前まで無料キャンセル可能。","content":["ピックアップの24時間前まで無料キャンセル可能。","当日のキャンセルおよびノーショーは返金不可です。"]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'ja'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小时可免费取消。","content":["接送前24小时可免费取消。","当天取消及未出现恕不退款。"]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'zh'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"取消政策","preview":"接送前24小時可免費取消。","content":["接送前24小時可免費取消。","當天取消及未出現恕不退款。"]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'zh-TW'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

UPDATE public.tour_product_pages
SET detail_payload = jsonb_set(detail_payload, '{practicalAccordionItems}',
      (detail_payload->'practicalAccordionItems') || '{"id":"cancellation","title":"Cancelación","preview":"Cancelación gratuita hasta 24 horas antes de la recogida.","content":["Cancelación gratuita hasta 24 horas antes de la recogida.","Las cancelaciones el mismo día y las ausencias no son reembolsables."]}'::jsonb)
WHERE slug = 'southwest-hallasan-osulloc-aewol' AND locale = 'es'
  AND jsonb_typeof(detail_payload->'practicalAccordionItems') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
    WHERE e->>'id' = 'cancellation');

COMMIT;

-- ── Verification: every targeted row should now have a cancellation item ──────
SELECT slug, locale,
  EXISTS (SELECT 1 FROM jsonb_array_elements(detail_payload->'practicalAccordionItems') e
          WHERE e->>'id' = 'cancellation') AS has_cancellation
FROM public.tour_product_pages
WHERE slug IN ('busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju', 'busan-spring-cherry-blossom-gyeongju-highlights-day-tour', 'busan-top-attractions-day-tour', 'east-signature-nature-core', 'jeju-cherry-blossom-tour-east-route', 'jeju-cruise-shore-excursion-bus-tour', 'jeju-cruise-shore-excursion-small-group-tour', 'jeju-grand-highlights-loop', 'jeju-hydrangea-festival-tour-southwest-route', 'jeju-island-private-car-charter-tour', 'seoul-dmz-private-3rd-tunnel-suspension-bridge', 'seoul-private-nami-morning-calm-petite-france', 'seoul-suburbs-private-chartered-car-10hr', 'seoul-suwon-hwaseong-waujeongsa-starfield', 'southwest-hallasan-osulloc-aewol')
ORDER BY slug, locale;
