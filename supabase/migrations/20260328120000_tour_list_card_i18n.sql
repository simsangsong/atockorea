-- Card list fields (title, badges, duration, highlight) merged into existing translations per locale.
-- Does not replace whole locale objects — only merges these keys.

-- jeju-private-car-charter-tour
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"제주 프라이빗 차량·전문 기사｜맞춤 일일 코스","badges":["프라이빗","인기"],"duration":"9시간","highlight":"맞춤 코스"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Jeju Private Car & Driver｜Custom Full-Day Island Tour","badges":["Private","Top rated"],"duration":"9 hours","highlight":"Custom route"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"济州私人包车含司机｜行程可定制一日游","badges":["私人定制","热门"],"duration":"9小时","highlight":"行程可定制"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"濟州私人包車含司機｜客製化一日遊","badges":["私人","熱門"],"duration":"9小時","highlight":"客製行程"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"済州島プライベート車＆ドライバー付き｜好みで決める日帰りツアー","badges":["プライベート","人気"],"duration":"9時間","highlight":"自由コース"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Jeju: coche privado con conductor｜Tour de día a medida","badges":["Privado","Popular"],"duration":"9 h","highlight":"Ruta a medida"}'::jsonb, true
) WHERE slug = 'jeju-private-car-charter-tour';

-- busan-top-attractions-authentic-one-day-guided-tour
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"부산 핵심 명소 정통 원데이 투어｜영어 가이드","badges":["클래식 버스","영어 가이드"],"duration":"약 9시간 30분","highlight":"부산 하루 만에"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Busan Highlights｜Authentic One-Day Guided Tour","badges":["Classic bus","English guide"],"duration":"9.5 hours","highlight":"Best of Busan"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"釜山经典一日游｜甘川、海东龙宫寺、札嘎其","badges":["经典巴士","英语导游"],"duration":"约9.5小时","highlight":"釜山精华"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"釜山經典一日遊｜甘川、海東龍宮寺、札嘎其","badges":["經典巴士","英語導遊"],"duration":"約9.5小時","highlight":"釜山精選"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"釜山定番スポット満営バスツアー｜英語ガイド同行","badges":["クラシックバス","英語ガイド"],"duration":"約9時間30分","highlight":"釜山の魅力を凝縮"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Busán en un día｜Tour guiado auténtico","badges":["Autobús clásico","Guía en inglés"],"duration":"9,5 h","highlight":"Lo esencial"}'::jsonb, true
) WHERE slug = 'busan-top-attractions-authentic-one-day-guided-tour';

-- jeju-island-full-day-tour-cruise-passengers
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"제주 크루즈 승객 전용｜일일 랜드 투어","badges":["크루즈","정시 픽업"],"duration":"종일","highlight":"터미널 픽업·드롭"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Jeju Full-Day Tour｜For Cruise Passengers","badges":["Cruise","On-time pickup"],"duration":"Full day","highlight":"Port pickup & drop-off"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"济州邮轮客专属｜全天岸上观光","badges":["邮轮","准时接送"],"duration":"全天","highlight":"码头接送"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"濟州郵輪客專屬｜全日岸上觀光","badges":["郵輪","準時接送"],"duration":"全日","highlight":"碼頭接送"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"済州島クルーズ客向け｜日帰り陸上観光","badges":["クルーズ","時間厳守送迎"],"duration":"終日","highlight":"ターミナル送迎"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Jeju en día completo｜Pasajeros de crucero","badges":["Crucero","Recogida puntual"],"duration":"Jornada completa","highlight":"Puerto recogida y regreso"}'::jsonb, true
) WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';

-- jeju-west-south-full-day-bus-tour (Korean base title in DB)
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"제주 서부·남부 올데이 버스 투어","badges":["버스 투어","유네스코"],"duration":"10시간","highlight":"서·남부 한 번에"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Jeju West & South｜Full-Day Bus Tour","badges":["Bus tour","UNESCO"],"duration":"10 hours","highlight":"West & south in one day"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"济州西部·南部全天巴士游","badges":["巴士游","世界遗产"],"duration":"10小时","highlight":"西线南线一天走完"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"濟州西部·南部全日巴士遊","badges":["巴士遊","世界遺產"],"duration":"10小時","highlight":"西線南線一日搞定"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"済州島西部・南部｜終日バスツアー","badges":["バスツアー","ユネスコ"],"duration":"10時間","highlight":"西と南を効率よく"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Jeju oeste y sur｜Tour de autobús de día completo","badges":["Autobús","UNESCO"],"duration":"10 h","highlight":"Oeste y sur en un día"}'::jsonb, true
) WHERE slug = 'jeju-west-south-full-day-bus-tour';

-- jeju-eastern-unesco-spots-bus-tour
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"제주 동부 유네스코 명소 버스 투어","badges":["유네스코","버스"],"duration":"10시간","highlight":"동부 명소 집중"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Eastern Jeju｜UNESCO Highlights Bus Tour","badges":["UNESCO","Bus"],"duration":"10 hours","highlight":"East coast classics"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"济州东部世界遗产巴士一日游","badges":["世界遗产","巴士"],"duration":"10小时","highlight":"东线精华"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"濟州東部世界遺產巴士一日遊","badges":["世界遺產","巴士"],"duration":"10小時","highlight":"東線精華"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"済州島東部｜ユネスコ名所バスツアー","badges":["ユネスコ","バス"],"duration":"10時間","highlight":"東海岸の定番"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Jeju este｜Autobús por lugares UNESCO","badges":["UNESCO","Autobús"],"duration":"10 h","highlight":"Lo mejor del este"}'::jsonb, true
) WHERE slug = 'jeju-eastern-unesco-spots-bus-tour';

-- jeju-southern-unesco-geopark-day-tour
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"제주 남부 유네스코 지질공원 버스 투어","badges":["지질공원","버스"],"duration":"10시간","highlight":"남부 지질 명소"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Southern Jeju｜UNESCO Geopark Bus Tour","badges":["Geopark","Bus"],"duration":"10 hours","highlight":"Volcanic south"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"济州南部世界地质公园巴士游","badges":["地质公园","巴士"],"duration":"10小时","highlight":"南部火山地貌"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"濟州南部世界地質公園巴士遊","badges":["地質公園","巴士"],"duration":"10小時","highlight":"南部火山景觀"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"済州島南部｜ユネスコジオパークバスツアー","badges":["ジオパーク","バス"],"duration":"10時間","highlight":"南部の火山地形"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Jeju sur｜Geoparque UNESCO en autobús","badges":["Geoparque","Autobús"],"duration":"10 h","highlight":"Volcanes del sur"}'::jsonb, true
) WHERE slug = 'jeju-southern-unesco-geopark-day-tour';

-- busan-city-tour-shore-excursion-cruise-guests
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ko}',
  COALESCE(translations->'ko', '{}'::jsonb) || '{"title":"부산 시내 투어｜크루즈 승객 쇼어 엑스커션","badges":["크루즈","정시 복귀"],"duration":"가변","highlight":"항구 맞춤 일정"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{en}',
  COALESCE(translations->'en', '{}'::jsonb) || '{"title":"Busan City Tour｜Shore Excursion for Cruise Guests","badges":["Cruise","On-time return"],"duration":"Flexible","highlight":"Port schedule"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh}',
  COALESCE(translations->'zh', '{}'::jsonb) || '{"title":"釜山市区游｜邮轮岸上观光","badges":["邮轮","准时回港"],"duration":"弹性","highlight":"按船期安排"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{zh-TW}',
  COALESCE(translations->'zh-TW', '{}'::jsonb) || '{"title":"釜山市區遊｜郵輪岸上觀光","badges":["郵輪","準時回港"],"duration":"彈性","highlight":"配合船期"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{ja}',
  COALESCE(translations->'ja', '{}'::jsonb) || '{"title":"釜山市内観光｜クルーズ寄港ツアー","badges":["クルーズ","定時帰港"],"duration":"可変","highlight":"寄港スケジュール対応"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
UPDATE tours SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb), '{es}',
  COALESCE(translations->'es', '{}'::jsonb) || '{"title":"Busán ciudad｜Excursión para cruceros","badges":["Crucero","Regreso a tiempo"],"duration":"Flexible","highlight":"Según el barco"}'::jsonb, true
) WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
