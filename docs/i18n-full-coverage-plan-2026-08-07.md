# 전 표면 다국어 채우기 — 실행 플랜 (2026-08-07)

> **이 플랜의 목적:** 사이트 + 스마트앱 전 표면에서 미번역을 찾아 10로케일을 채운다.
> **API 를 쓰지 않는다.** 번역은 Claude Code 가 플랜 한도 안에서 직접 하고, 세션을 쪼갠다.
> 아래 숫자는 전부 **2026-08-07 실측**이다(추정은 「추정」이라고 표시했다).

---

## §0 🔴 시작 전에 읽을 것

### 0-1. 상시 규칙 — API 금지

CLAUDE.md 맨 위 규칙이다. `scripts/i18n/translate.ts` 는 `--yes-bill-the-api` 없이는 exit 2 다.
**「API 크레딧 대기」라고 적힌 인수인계를 만나면 그건 대기가 아니라 규칙 위반이다.**

### 0-2. 이 플랜이 지키는 안전 전제

| 대상 | 왜 안전한가 |
|---|---|
| `tour_product_pages` de/fr/it/ru | `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 가 막고 있어 **DB 에 넣어도 손님은 EN 을 본다**. 오픈은 사람 결정. |
| `messages/*.json` | 기존 키 **값만** 채운다. 키 추가·삭제 금지(파이프라인이 EN 키를 덮은 전례 있음 — `[[feedback-i18n-translate-script-drops-keys]]`). |
| `match_pois` | 🔴 **`names_other_locales` 는 게이트가 없어 쓰는 즉시 손님에게 반영된다. 절대 손대지 마라.** `content_locales` 는 별개 컬럼이지만 **§4 에서 안전성부터 확인**하고 착수한다. |

### 0-3. 🔴 사장님 결정 3건 — 착수 전에 받아야 한다

1. **은퇴/비공개 상품 14종을 번역할 것인가?** (§2-b, 45행)
   `en.is_published=false` 인 것들이다(계절 상품·구 상품). **권고: 하지 않는다.**
   지금 안 팔고, 되살릴 때 콘텐츠가 바뀔 가능성이 높다. 살아 있는 23종을 먼저 끝내는 게 낫다.
2. **`match_pois.content_locales` 를 채울 것인가?** (§4) — 게이트 유무 확인이 선행이다.
3. **챗봇 RAG(`knowledge_chunks`)·왓츠앱 템플릿에 de/fr/it/ru 를 넣을 것인가?** (§5)
   지금 6로케일만 있다. 손님이 그 4언어로 챗봇에 물으면 무엇이 나오는지 **먼저 실측**해야 한다.

---

## §1 전 표면 실측 결과 — 어디가 비어 있나

| # | 표면 | 상태 | 남은 일 |
|---|---|---|---|
| A | `messages/*.json` UI 크롬 | 키 패리티 **2,261 × 10 완전** · 값에 구멍 | **321 (키×로케일)** |
| B | `tour_product_pages` 투어 콘텐츠 | 6로케일 37슬러그 / de 18·fr 18·it 17·ru 11 | **판매중 39행** (+은퇴 45행) |
| C | `region_script_locales` 지역 해설 | **10로케일 완전** (160행) | 없음 |
| D | `match_pois.content_locales` | 125 POI — ja 77·ru 90·it 112·de 113·ko 114·fr 118 | ja 48·ru 35·it 13·de 12·ko 11·fr 7 |
| E | `knowledge_chunks` 챗봇 RAG | 1,397행 — **de/fr/it/ru 없음** | 결정 대기 |
| F | `ops_whatsapp_templates` | 30행 — **de/fr/it/ru 없음** | 결정 대기 |

**A 와 B 가 손님이 실제로 보는 것이다. 여기부터 한다.**

---

## §2 표면 B — 투어 콘텐츠 (가장 큰 덩어리)

### 2-a. 판매중 23슬러그 — **39행 부족** (우선순위 1)

| 그룹 | 슬러그 | 부족 | 상태 |
|---|---|---|---|
| **G1** 이미 추출됨 | `southwest-hallasan-osulloc-aewol` | it, ru | it 7 unit 은 `in/` 에 있다 |
| **G2** ru 만 부족 | `from-busan-gyeongju` · `jeju-cruise-small-group` · `jeju-eastern` · `jeju-island-private-car` · `jeju-southern` | ru ×5 | ru 77 unit 이 `in/` 에 있다 |
| **G3** 🔴 **추출조차 안 됨** | `busan-small-group-sightseeing-cruise-passengers` · `seoul-private-nami-morning-calm-petite-france` · `seoul-seoraksan-naksansa` · `seoul-seoraksan-nami-morning-calm` · `seoul-suburbs-private-chartered-car-10hr` · `seoul-suwon-hwaseong-folk-village` · `seoul-suwon-hwaseong-gwangmyeong-cave` · `seoul-suwon-hwaseong-waujeongsa` | 4언어 × 8 = **32행** | `i18n:extract` 부터 |

**G1·G2 = 84 unit 이 이미 `in/` 에 준비돼 있다.** 여기부터 하면 도구 작업이 0이다.

### 2-b. 은퇴 14슬러그 — 45행 (사장님 결정 §0-3-1, 권고: 보류)

### 2-c. 분량 (실측 원문 글자수)

| 대상 | unit | 원문 |
|---|---|---|
| it `southwest` | 7 | 28,819자 |
| ru 7슬러그 | 77 | 322,621자 |
| G3 8슬러그 × 4언어 | 미추출 | **추정** 30,000자/슬러그-로케일 → 약 96만자 |

🔴 **G3 가 전체의 70% 다. 만만찮다** — 이 플랜은 **G1 → G2 → G3** 순서를 권한다.
G3 착수 전에 §0-3 결정을 받아 범위를 확정하라.

---

## §3 표면 A — `messages/*.json` (작고 효과 큼 — **먼저 하라**)

### 3-a. 🔴 가장 큰 발견 — 예상과 정반대다

`home.customJoinTour.*`(AI 커스텀 투어 = **예약 퍼널**) 124키 중:

| ko | ja | zh | zh-TW | es | fr | de | it | ru |
|---|---|---|---|---|---|---|---|---|
| 6 | **63** | **69** | **69** | **71** | 12 | 13 | 12 | 6 |

**핵심 로케일(ja·zh·zh-TW·es)이 신규 로케일(fr·de·it·ru)보다 훨씬 나쁘다.**
기능을 만들 때 신규 4언어만 채우고 **구 핵심 로케일을 백필하지 않은 것**이다.
「핵심 로케일은 당연히 완전하다」는 가정으로 보면 영영 안 보인다.

### 3-b. 나머지 (키×로케일)

`settingsPage` 20 · `errors` 20 · `toursList` 18 · `tour` 9 · `cart` 2 · `admin` 12(스태프용, 후순위)

### 3-c. 번역하면 안 되는 것 — 오탐

`home.footer.registeredAddress`(법인 주소) · `platformOperator`(`AtoC Korea, LLC`) ·
고유명사(`Seoul`·`Busan`·`Jeju`·`UNESCO`·`Google`) · 사람 이름(`Sarah M.`) ·
독일어에서 그대로인 차용어(`Filter`·`Name`·`Route`·`Support`·`FAQ`).
**RULES.md §47 제품명 4언어 영어 유지도 그대로 적용된다**(`AtoC Korea`·`Tour Room`·`Smart Guide`·`Smart Pass`).

### 3-d. 분량

원문 총 3,274자(124키) 기준, 미번역 321건 = **추정 8,000~10,000자**.
→ **한 세션에 끝난다.** 효과 대비 가장 싼 작업이므로 **S1 에 배치**한다.

---

## §4 표면 D — POI 콘텐츠 (안전성 확인이 선행)

`match_pois.content_locales` 125 POI. **착수 전에 반드시 확인할 것:**
`content_locales` 를 채우면 손님 화면에 즉시 반영되는가? `names_other_locales` 처럼
게이트가 없다면 **`tour_product_pages` 같은 스테이징 장치가 없다는 뜻**이고, 그러면
이건 「번역 작업」이 아니라 「배포」다. 확인 전에는 한 행도 쓰지 마라.

---

## §5 표면 E·F — 챗봇 RAG · 왓츠앱 (결정 대기)

둘 다 de/fr/it/ru 가 **아예 없다**. 먼저 **실측**할 것: 손님이 독일어로 챗봇에 물으면
지금 무엇이 나오는가(영어 폴백인가, 빈 답인가). 그 결과가 우선순위를 정한다.

---

## §6 🔴 세션 운영 규약 — 이대로 하면 쪼개도 정확하다

### 6-1. 파일이 진척이다

**모든 표면을 파일 계약으로 돌린다.** 세션이 끝나도 진척은 파일에 남고, 다음 세션은
「출력 파일이 없는 것」만 집으면 된다. 사람이 다시 셀 필요가 없다.

| 표면 | 입력 | 출력 |
|---|---|---|
| B 투어 콘텐츠 | `i18n-work/in/tour_product_pages/<unit>.json` | `i18n-work/out/tour_product_pages/<loc>/<unit>.json` |
| A messages | `messages/en.json` | `messages/<loc>.json` (**값만 교체**) |

### 6-2. 한 세션의 모양 (그대로 따라라)

1. **남은 것 확인** — §6-4 의 명령 하나. 인수인계 문장을 믿지 말고 직접 세라.
2. **RULES.md 전문 + `styleguide/<locale>.md` 를 읽는다.** 요약하지 마라(RULES.md 스스로 금지).
3. **unit 하나씩** 번역해 출력 파일을 쓴다. 🔴 **포인터 키 집합은 입력과 정확히 같아야 한다.**
4. `npm run i18n:verify -- --locale=<loc>` → **fail 0** 확인.
5. **커버리지 100% 가 된 슬러그는 그 자리에서 발행한다** —
   `npm run i18n:apply -- --locale=<loc> --slugs=<slug> --apply`.
   🔴 **`--partial` 금지**: `apply.ts` 는 INSERT-only라 부분 발행한 행은 **영원히 그대로**다.
6. 커밋 + 인수인계 문서에 **남은 수치**를 갱신한다.

### 6-3. 세션당 분량 — 실측 기반

2026-08-07 세션에서 **독일어 4 unit = 19,444자**를 다른 작업과 병행하며 끝냈다.
→ 번역만 하는 세션이면 **25,000~30,000자 / 세션**이 안전한 계획치다(**추정**).

| 단계 | 대상 | 원문 | 세션(추정) |
|---|---|---|---|
| **S1** | §3 messages 전체 | ~10,000자 | **1** |
| **S2** | it `southwest` 7 unit → 1행 | 28,819자 | **1** |
| **S3~S14** | ru 7슬러그 77 unit → 5행 | 322,621자 | **12** |
| S15~ | G3 8슬러그(결정 후) | ~96만자 | **32+** |

**S1~S14 = 14세션이면 판매중 상품의 de/fr/it 가 완전해지고 ru 가 12행이 된다.**

### 6-4. 남은 것 세는 명령 (복붙)

```bash
# B 투어 콘텐츠 — 출력 파일이 아직 없는 unit
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('i18n-work/manifest.json','utf8'));for(const u of m.units){const f=u.id.replace(/[^\w.-]+/g,'_');if(fs.existsSync('i18n-work/out/tour_product_pages/'+u.locale+'/'+f+'.json'))continue;console.log(u.locale+' '+u.slug+' '+u.chunk+' — 세그먼트 '+u.segments)}"
```

```bash
# A messages — 영어와 값이 같은 키(고유명사 오탐 포함, 눈으로 거르기)
node -e "const fs=require('fs');const F=(o,p='',t={})=>{for(const[k,v]of Object.entries(o)){const K=p?p+'.'+k:k;typeof v==='string'?t[K]=v:v&&typeof v==='object'&&F(v,K,t)}return t};const en=F(JSON.parse(fs.readFileSync('messages/en.json','utf8')));for(const L of ['ko','ja','zh','zh-TW','es','fr','de','it','ru']){const m=F(JSON.parse(fs.readFileSync('messages/'+L+'.json','utf8')));const g=Object.keys(en).filter(k=>m[k]===en[k]&&/\p{L}/u.test(en[k])&&en[k].trim().split(/\s+/).length>=3);console.log(L+': '+g.length)}"
```

### 6-5. 🔴 이번에 배운 함정 — 다음 세션도 밟는다

1. **워크트리엔 `.env.local` 도 `node_modules` 도 없다.** 본체에서 복사 + 정션. `ERR_MODULE_NOT_FOUND` 는 크레딧 문제가 아니다.
2. **포인터 집합만 맞으면 통과한다 — 내용 완결성은 별개다.** `findTruncatedSegments` 가 잡지만, 직접 번역할 땐 **끝까지 옮겼는지 스스로 확인**하라.
3. **독일어 숫자 서식은 안전하다** — `numberMultiset` 은 숫자 런으로 쪼개므로 `5,5` 와 `5.5` 가 같다. 천단위 `1.000` 도 정규화된다.
4. **`**강조**` 개수를 맞춰라**(G6). 긴 설명문은 20~25쌍이 흔하다.
5. **`⟦G숫자⟧` 토큰은 그대로.** 번역·공백 삽입 금지(G2 즉시 실패).
6. **갤러리 캡션처럼 고유명사뿐인 문자열은 원문과 같아도 정상**이다(G9 flag, 발행됨).
7. **매니페스트 `pending` 을 잔여로 세지 마라** — 이미 DB 행이 있는 슬러그가 섞여 있다. **판정은 DB 로.**

---

## §7 다음 세션 첫 명령

```bash
cp /c/Users/sangsong/atockorea/.env.local .env.local
```
그리고 **§3 messages 부터**(S1). 가장 싸고 예약 퍼널을 직접 고친다.
`home.customJoinTour.*` 의 **ja·zh·zh-TW·es 63~71건**이 첫 타깃이다.

착수 전에 **§0-3 사장님 결정 3건**을 확인하라 — 특히 G3(8슬러그 32행)는 전체 분량의
70% 라 결정이 바뀌면 플랜의 크기가 바뀐다.
