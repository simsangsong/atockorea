-- Optional: merge situation-specific weather copy into site_settings.cms_content_overrides
-- Keys must match app: rain | strong_wind | rain_and_wind (see lib/weather/advisory-templates.ts).
-- Locales: en | ko | zh | zh-TW | es | ja

UPDATE public.site_settings
SET cms_content_overrides =
  COALESCE(cms_content_overrides, '{}'::jsonb)
  || jsonb_build_object(
    'weatherTourAdvisories',
    jsonb_build_object(
      'ko',
      jsonb_build_object(
        'rain',
        jsonb_build_object(
          'title',
          '우천 시 준비물',
          'body',
          '레인코트나 접이식 우산을 챙겨 주세요. 미끄럼 방지 신발이 도움이 됩니다.'
        ),
        'strong_wind',
        jsonb_build_object(
          'title',
          '강풍이 예상될 때',
          'body',
          '바람막이나 얇은 자켓을 추가로 챙기세요. 모자는 날릴 수 있으니 주의하세요.'
        ),
        'rain_and_wind',
        jsonb_build_object(
          'title',
          '비·바람이 함께 예상될 때',
          'body',
          '방수 겉옷과 후드, 조절 가능한 레이어링을 권장합니다. 체감 온도가 낮게 느껴질 수 있습니다.'
        )
      ),
      'en',
      jsonb_build_object(
        'rain',
        jsonb_build_object(
          'title',
          'Rain in the forecast',
          'body',
          'Pack a raincoat or compact umbrella. Shoes with grip help on wet paths.'
        ),
        'strong_wind',
        jsonb_build_object(
          'title',
          'Strong wind expected',
          'body',
          'Bring a windbreaker or light jacket. Hats can blow off easily on the coast.'
        ),
        'rain_and_wind',
        jsonb_build_object(
          'title',
          'Rain and wind together',
          'body',
          'Waterproof shell with a hood and adjustable layers are best. It may feel colder than the number.'
        )
      )
    )
  )
WHERE id = 'default';
