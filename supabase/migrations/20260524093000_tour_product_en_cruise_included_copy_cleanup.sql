-- Clarify Jeju cruise included/excluded copy in live EN detail payloads.
-- The UI splits this accordion item after the first five entries, so the
-- title and preview should make the excluded lunch/shopping/gratuities items explicit.

UPDATE public.tour_product_pages
SET detail_payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              detail_payload,
              '{practicalAccordionItems,4,title}',
              to_jsonb('What''s included / not included'::text),
              true
            ),
            '{practicalAccordionItems,4,preview}',
            to_jsonb('Guide, vehicle, pickup, admissions; lunch and gratuities separate'::text),
            true
          ),
          '{practicalAccordionItems,4,includedCount}',
          '5'::jsonb,
          true
        ),
        '{page_sections,7,props,practicalAccordionItems,4,title}',
        to_jsonb('What''s included / not included'::text),
        true
      ),
      '{page_sections,7,props,practicalAccordionItems,4,preview}',
      to_jsonb('Guide, vehicle, pickup, admissions; lunch and gratuities separate'::text),
      true
    ),
    '{page_sections,7,props,practicalAccordionItems,4,includedCount}',
    '5'::jsonb,
    true
  )
WHERE locale = 'en'
  AND slug IN (
    'jeju-cruise-shore-excursion-bus-tour',
    'jeju-cruise-shore-excursion-small-group-tour'
  )
  AND jsonb_path_exists(detail_payload, '$.practicalAccordionItems[*] ? (@.id == "included")');
