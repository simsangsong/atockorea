const fs = require('fs');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SERVICE_KEY;

const rules = [
  // region
  {locale:"ko",pattern:"동쪽",match_type:"contains",intent_key:"region_east",slot_key:"region_preference",slot_value:"east",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"동부",match_type:"contains",intent_key:"region_east",slot_key:"region_preference",slot_value:"east",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"성산",match_type:"contains",intent_key:"region_east",slot_key:"region_preference",slot_value:"east",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"서쪽",match_type:"contains",intent_key:"region_west",slot_key:"region_preference",slot_value:"west",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"서부",match_type:"contains",intent_key:"region_west",slot_key:"region_preference",slot_value:"west",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"애월",match_type:"contains",intent_key:"region_west",slot_key:"region_preference",slot_value:"west",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"서귀포",match_type:"contains",intent_key:"region_south",slot_key:"region_preference",slot_value:"south",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"남쪽",match_type:"contains",intent_key:"region_south",slot_key:"region_preference",slot_value:"south",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"중문",match_type:"contains",intent_key:"region_south",slot_key:"region_preference",slot_value:"south",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"북쪽",match_type:"contains",intent_key:"region_north",slot_key:"region_preference",slot_value:"north",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"제주시",match_type:"contains",intent_key:"region_central",slot_key:"region_preference",slot_value:"central",confidence:0.95,priority:10,is_active:true},
  // first visit
  {locale:"ko",pattern:"첫 제주",match_type:"contains",intent_key:"first_visit",slot_key:"first_visit",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"처음 제주",match_type:"contains",intent_key:"first_visit",slot_key:"first_visit",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"제주 처음",match_type:"contains",intent_key:"first_visit",slot_key:"first_visit",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"첫방문",match_type:"contains",intent_key:"first_visit",slot_key:"first_visit",slot_value:true,confidence:0.95,priority:10,is_active:true},
  // walking easy
  {locale:"ko",pattern:"많이 안 걷",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"걷기 싫",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"걷기 힘",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"편하게",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.90,priority:20,is_active:true},
  {locale:"ko",pattern:"무리 없이",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.90,priority:20,is_active:true},
  {locale:"ko",pattern:"여유롭게",match_type:"contains",intent_key:"walking_easy",slot_key:"max_walking_level",slot_value:"easy",confidence:0.85,priority:30,is_active:true},
  // walking hard
  {locale:"ko",pattern:"등산",match_type:"contains",intent_key:"walking_hard",slot_key:"max_walking_level",slot_value:"hard",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"트레킹",match_type:"contains",intent_key:"walking_hard",slot_key:"max_walking_level",slot_value:"hard",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"한라산",match_type:"contains",intent_key:"walking_hard",slot_key:"max_walking_level",slot_value:"hard",confidence:0.95,priority:10,is_active:true},
  // seniors
  {locale:"ko",pattern:"부모님",match_type:"contains",intent_key:"with_seniors",slot_key:"with_seniors",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"어르신",match_type:"contains",intent_key:"with_seniors",slot_key:"with_seniors",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"할머니",match_type:"contains",intent_key:"with_seniors",slot_key:"with_seniors",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"할아버지",match_type:"contains",intent_key:"with_seniors",slot_key:"with_seniors",slot_value:true,confidence:0.95,priority:10,is_active:true},
  // children
  {locale:"ko",pattern:"유아",match_type:"contains",intent_key:"with_children",slot_key:"with_children",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"아기",match_type:"contains",intent_key:"with_children",slot_key:"with_children",slot_value:true,confidence:0.95,priority:10,is_active:true},
  // photo
  {locale:"ko",pattern:"사진 맛집",match_type:"contains",intent_key:"photo_high",slot_key:"photo_priority",slot_value:9,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"포토스팟",match_type:"contains",intent_key:"photo_high",slot_key:"photo_priority",slot_value:9,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"사진 예쁜",match_type:"contains",intent_key:"photo_high",slot_key:"photo_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"인스타",match_type:"contains",intent_key:"photo_high",slot_key:"photo_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  // hidden gem / avoid touristy
  {locale:"ko",pattern:"숨은 명소",match_type:"contains",intent_key:"hidden_gem",slot_key:"hidden_gem_priority",slot_value:8,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"덜 알려진",match_type:"contains",intent_key:"hidden_gem",slot_key:"hidden_gem_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"덜 관광지",match_type:"contains",intent_key:"avoid_touristy",slot_key:"avoid_overly_touristy",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"뻔한 곳 말고",match_type:"contains",intent_key:"avoid_touristy",slot_key:"avoid_overly_touristy",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"뻔하지 않",match_type:"contains",intent_key:"avoid_touristy",slot_key:"avoid_overly_touristy",slot_value:true,confidence:0.90,priority:10,is_active:true},
  // food
  {locale:"ko",pattern:"맛집",match_type:"contains",intent_key:"food_high",slot_key:"food_priority",slot_value:9,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"흑돼지",match_type:"contains",intent_key:"food_high",slot_key:"food_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"해산물",match_type:"contains",intent_key:"food_high",slot_key:"food_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  // cafe
  {locale:"ko",pattern:"카페",match_type:"contains",intent_key:"cafe_high",slot_key:"cafe_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  // nature
  {locale:"ko",pattern:"오름",match_type:"contains",intent_key:"nature_high",slot_key:"nature_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"폭포",match_type:"contains",intent_key:"nature_high",slot_key:"nature_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"바다",match_type:"contains",intent_key:"nature_high",slot_key:"nature_priority",slot_value:7,confidence:0.85,priority:20,is_active:true},
  {locale:"ko",pattern:"해변",match_type:"contains",intent_key:"nature_high",slot_key:"nature_priority",slot_value:7,confidence:0.85,priority:20,is_active:true},
  // rainy
  {locale:"ko",pattern:"비 와도",match_type:"contains",intent_key:"rainy_ok",slot_key:"need_indoor_if_rain",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"비가 와도",match_type:"contains",intent_key:"rainy_ok",slot_key:"need_indoor_if_rain",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"우천",match_type:"contains",intent_key:"rainy_ok",slot_key:"need_indoor_if_rain",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"실내 위주",match_type:"contains",intent_key:"indoor_pref",slot_key:"need_indoor_if_rain",slot_value:true,confidence:0.90,priority:10,is_active:true},
  // morning/sunset
  {locale:"ko",pattern:"오전",match_type:"contains",intent_key:"morning_pref",slot_key:"morning_preference",slot_value:true,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"아침",match_type:"contains",intent_key:"morning_pref",slot_key:"morning_preference",slot_value:true,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"일출",match_type:"contains",intent_key:"morning_pref",slot_key:"morning_preference",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"노을",match_type:"contains",intent_key:"sunset_pref",slot_key:"sunset_preference",slot_value:true,confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"일몰",match_type:"contains",intent_key:"sunset_pref",slot_key:"sunset_preference",slot_value:true,confidence:0.95,priority:10,is_active:true},
  // group
  {locale:"ko",pattern:"혼자",match_type:"contains",intent_key:"group_solo",slot_key:"group_type",slot_value:"solo",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"커플",match_type:"contains",intent_key:"group_couple",slot_key:"group_type",slot_value:"couple",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"연인",match_type:"contains",intent_key:"group_couple",slot_key:"group_type",slot_value:"couple",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"가족",match_type:"contains",intent_key:"group_family",slot_key:"group_type",slot_value:"family",confidence:0.95,priority:10,is_active:true},
  {locale:"ko",pattern:"친구",match_type:"contains",intent_key:"group_friends",slot_key:"group_type",slot_value:"friends",confidence:0.90,priority:10,is_active:true},
  // culture
  {locale:"ko",pattern:"박물관",match_type:"contains",intent_key:"culture_high",slot_key:"culture_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"미술관",match_type:"contains",intent_key:"culture_high",slot_key:"culture_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"역사",match_type:"contains",intent_key:"culture_high",slot_key:"culture_priority",slot_value:7,confidence:0.85,priority:20,is_active:true},
  // iconic
  {locale:"ko",pattern:"필수 코스",match_type:"contains",intent_key:"iconic_high",slot_key:"iconic_spot_priority",slot_value:9,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"꼭 가야",match_type:"contains",intent_key:"iconic_high",slot_key:"iconic_spot_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"명소",match_type:"contains",intent_key:"iconic_high",slot_key:"iconic_spot_priority",slot_value:7,confidence:0.85,priority:20,is_active:true},
  // shopping
  {locale:"ko",pattern:"쇼핑",match_type:"contains",intent_key:"shopping_high",slot_key:"shopping_priority",slot_value:8,confidence:0.90,priority:10,is_active:true},
  {locale:"ko",pattern:"기념품",match_type:"contains",intent_key:"shopping_high",slot_key:"shopping_priority",slot_value:7,confidence:0.85,priority:20,is_active:true},
  // quick photo
  {locale:"ko",pattern:"빠르게",match_type:"contains",intent_key:"quick_photo",slot_key:"quick_photo_mode",slot_value:true,confidence:0.80,priority:30,is_active:true}
];

async function post(table, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({status: res.statusCode, body: d}));
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

post('request_phrase_rules', rules).then(r => {
  console.log('phrase_rules:', r.status, r.body.slice(0,200));
}).catch(e => console.error(e));
