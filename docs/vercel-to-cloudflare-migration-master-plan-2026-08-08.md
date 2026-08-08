# Vercel → Cloudflare 전면 이주 마스터 플랜 (2026-08-08, v1)

**상태:** 플랜 확정 전 초안 — §C 사장님 결정 6건이 열려 있다. 실행은 CF0부터 순서대로.
**작성 근거:** 이 세션에서 레포·DNS·라이브 응답을 직접 실측(§A·§N). 표기: ✅실측 · 📄공식문서 · ⚠추정(실행 중 확인).
**한 줄 요약:** Next.js 16 앱을 `@opennextjs/cloudflare` 어댑터로 Cloudflare Workers 에 올리고,
DNS 존을 먼저 무변경 이관(회색 구름)한 뒤, 트래픽 전환은 **레코드 1개 교체**로 끝낸다.
전환 실패 시 롤백은 **5분 내 레코드 원복**. Vercel 은 전환 후 2주+ 살려 둔다.

---

## §0 한눈 요약

### 이사 전/후 아키텍처

| 레이어 | 지금 (Vercel) | 이사 후 (Cloudflare) |
|---|---|---|
| 앱 서버 | Vercel Serverless (icn1 서울 고정) | Workers + `@opennextjs/cloudflare` (Smart Placement로 서울 근접 배치) |
| 정적 자산 | Vercel CDN | Workers Static Assets (public 648파일 276.5MB ✅ — 한도 내) |
| ISR 캐시 | Vercel Data Cache | R2 버킷 + DO 큐 + D1 태그 캐시 📄 |
| 이미지 최적화 | Vercel Image Optimization | Cloudflare Images binding (변환 5천/월 무료 후 $0.5/1천 📄) |
| 크론 9종 | vercel.json crons | **전용 크론 디스패처 워커** → 기존 `/api/cron/*` HTTPS 호출 (라우트 코드 무변경) |
| 빌드/배포 | GitHub 연동 vercel[bot] | Workers Builds (GitHub 연동, PR 프리뷰) |
| DNS | Namecheap NS (registrar-servers) ✅ | Cloudflare DNS (존 이관) |
| DB/인증/메일/결제 | Supabase·Resend·SES·Stripe | **무변경** (호스팅만 이사) |

### 왜 안전한가 — 설계 원칙 5
1. **트래픽 전환은 맨 마지막 1스텝** — 그 전의 모든 페이즈(CF0~CF5)는 라이브에 영향 0.
2. **DNS 이관과 트래픽 전환을 분리** — 존을 먼저 CF로 옮기되 전 레코드 DNS-only(회색)로 두면 서빙은 Vercel 그대로. 전환·롤백이 "레코드 편집" 수준으로 내려온다.
3. **게이트 없는 페이즈 없음** — 각 페이즈 끝에 통과 조건과 롤백 절차 명시(§D).
4. **기존 QA 하니스 총동원** — gate(tsc+jest 5,926)·tap-reachability·rail-scrollbars·CJK 실렌더 등을 스테이징 URL에 재사용(§I).
5. **돈이 걸린 크론 2개(홀드 재캡처·당일 결제 캡처)는 이중 실행 절대 금지** — 공백 > 중복 원칙으로 전환 순서 고정(§H).

### 총 작업량 추정
코드 티켓 12건(§E, 대부분 소형) + 인프라 절차. **세션 4~6회 분량** (CF1 1세션 · CF2~3 1~2세션 · CF4 반나절+전파 대기 · CF5~6 1세션+컷오버 창 · CF7 1세션).

---

## §A 현황 실측 인벤토리 (2026-08-08 이 세션에서 잼)

### A-1 앱 규모 ✅
- API 라우트 **273** · 페이지 **133** · `public/` **648파일 276.5MB, 20MB 초과 0건**
- Next **16.1.7** (webpack 빌드 강제, `--webpack`) · React 19.2.4 · Tailwind 3
- 빌드 커맨드: `node scripts/build-catalog-cards.mjs && next build --webpack` (프리스텝 존재 — CF 빌드에도 유지 필요)
- **엣지 런타임 0건** ✅ (`runtime = 'edge'` grep 0) — OpenNext 는 Node 런타임만 지원하므로 정합
- middleware.ts = 표준 미들웨어(로케일 라우팅 + Supabase 세션 갱신) — Node Middleware(15.2+) 아님 → 지원 범위 내 📄

### A-2 Vercel 결합 지점 ✅ (전수 grep)
| 결합 | 위치 | 이사 시 처리 |
|---|---|---|
| 크론 9종 | `vercel.json` crons | 디스패처 워커로 이식 (§H) |
| rewrites 3종 | `vercel.json` (`/api/tours/:id`→`[id]`) | **불필요** — Next 동적 라우팅이 원래 처리(B12) |
| 리전 icn1 | `vercel.json` | Smart Placement로 대체 (B6) |
| ISR | 홈 600s · 카탈로그/상품 3600s · llms.txt/feed/mcp-card 3600s | R2+DO+D1 구성 (B2) |
| on-demand 재검증 | `app/api/admin/tour-product-pages/[slug]/route.ts` — `revalidatePath` 12곳 | D1 태그 캐시 필요 (B2) |
| `maxDuration` | 30/60/300 — rag 크론 2종이 300 | wrangler `limits.cpu_ms` 300000 (CT-9) |
| `@vercel/speed-insights` | `app/(marketing)/layout.tsx` | 제거 → CF Web Analytics (CT-4) |
| `x-vercel-ip-country` | `app/api/analytics/events/route.ts:105` | **이미 `cf-ipcountry` 폴백 존재** ✅ — 무변경 |
| `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL` | `lib/origin-check.ts:80-81` | 기본 origin 하드코딩 + `ALLOWED_ORIGINS` env 로 이미 커버 — 스테이징 origin 만 주입 (CT-3) |
| `CRON_SECRET` | `lib/cron-auth.ts` | 디스패처가 같은 헤더로 호출 — 무변경 |
| SSE 3계통 | `app/api/tour-rooms/[bookingId]/events` · 챗봇 스트림 · ops parse | Workers 스트리밍 응답으로 동작 ⚠(CF2 검증) — 60s 사이클+재연결 설계 이미 있음 |

### A-3 Workers 런타임 호환성 위험 ✅ (전수 grep — 이것만 고치면 된다)
| # | 항목 | 위치 | 판정 |
|---|---|---|---|
| 1 | **sharp** (네이티브 — Workers 불가) | `lib/image-compress.ts` ← `app/api/upload/route.ts` · `app/api/admin/upload/route.ts` (동적 import) | **필수 교체** (CT-1) |
| 2 | 런타임 fs 읽기 4곳 | `lib/ops/finance/pdf/fonts.server.ts`(한글 .ttf) · `lib/cms-baseline.server.ts:37` · `lib/admin/poi-override-pins.ts:37` · `lib/ops/parse/llm.ts:15`(system.txt) | 정적 import 화 (CT-2) |
| 3 | web-push (node crypto) | `lib/tour-room/guestPush.ts` · `lib/tour-ops/push.ts` · `lib/push-endpoint.ts` | `nodejs_compat` 로 우선 시도, 실패 시 라이브러리 스왑 (B8) |
| 4 | @react-pdf/renderer | `app/api/admin/ops-finance/.../pdf/route.ts` + `lib/ops/finance/pdf/**` | 순수 JS — CT-2(폰트)만 해결하면 ⚠동작 예상, CF2 검증 |
| 5 | isomorphic-dompurify | `app/(marketing)/admin/emails/page.tsx` | **`'use client'`** ✅ — 서버 jsdom 미유입, 무변경 |
| 6 | stripe v20 `constructEvent` | `app/api/stripe/webhook/route.ts` | nodejs_compat crypto 로 동작 예상 ⚠, 실패 시 `constructEventAsync` 1줄 (CT-12) |
| 7 | supabase-js / resend / svix / @anthropic-ai / @google-generative-ai / groq | 전부 fetch 기반 | 무변경 |

### A-4 DNS·메일 레코드 ✅ (nslookup 실측 — 이관 시 1:1 필사 대상)
| 레코드 | 값 | 용도 |
|---|---|---|
| NS | `dns1/dns2.registrar-servers.com` | Namecheap 기본 DNS |
| apex A | `216.198.79.1` (Vercel 애니캐스트) | **라이브: apex→www 307** ✅ |
| www CNAME | `cab20a0a00b0f27e.vercel-dns-017.com` | **정본 서빙 호스트 = www** ✅ |
| apex MX 9 | `inbound-smtp.ap-northeast-1.amazonaws.com` | **인바운드 메일(SES)** → `app/api/inbound/email` |
| apex TXT | `google-site-verification=05dsI_...` | Search Console 소유 확인 |
| `send` TXT | `v=spf1 include:amazonses.com ~all` | Resend 발신 SPF |
| `send` MX 10 | `feedback-smtp.ap-northeast-1.amazonses.com` | Resend 발신 피드백 |
| `resend._domainkey` TXT | `p=MIGf...` | Resend DKIM |
| `_dmarc` TXT | `v=DMARC1; p=none;` | DMARC |

⚠ 위는 외부에서 조회 가능한 레코드만이다. **Namecheap 대시보드의 전체 존 export 가 정본** — CF4 첫 스텝.

### A-5 계정 현실 (이전 세션 실측, 메모리)
- 🔴 **Vercel CLI = 엉뚱한 계정**(`jejufun-5115`). 진짜 프로젝트는 `shen-xiangsongs-projects` 스코프 — **우리는 멤버가 아니라 대시보드 조작 불가**(env·도메인·롤백 전부). 배포만 GitHub 연동으로 자동.
- 🔴 **`vercel env pull` 절대 금지** — 빈 프로젝트의 env 0개로 `.env.local` 49키를 덮어쓴 사고 경로.
- ❌ **Cloudflare 는 이 스택에 아예 없음** — 계정·wrangler 설정·존 전부 제로에서 시작.
- → **이 플랜은 Vercel 대시보드를 한 번도 만지지 않고 완주 가능하게 설계했다**(전환=DNS, 크론 정지=vercel.json 커밋). 단 CF7 의 "Vercel 정리"만 사장님 로그인 필요(D4).

---

## §B 기술 결정 (바인딩)

- **B1 어댑터 = `@opennextjs/cloudflare` (Workers).** Next 16 전 마이너 공식 지원 📄. Cloudflare Pages 가 아니라 Workers 인 이유: Pages 는 next-on-pages(엣지 런타임 강제) 계보로 사실상 동결, Workers+OpenNext 가 공식 권장 경로.
- **B2 ISR/재검증 스택** 📄: R2 `NEXT_INC_CACHE_R2_BUCKET`(증분 캐시) + DO `DOQueueHandler`(시간 기반 재검증 큐) + `WORKER_SELF_REFERENCE` 서비스 바인딩 + **D1 `NEXT_TAG_CACHE_D1`**(revalidatePath 용 — 小사이트 권장안). `open-next.config.ts` 에 r2IncrementalCache + doQueue + d1NextTagCache.
- **B3 이미지 = Images binding** (`"images": {"binding":"IMAGES"}`) — 코드 무변경으로 next/image 호환 📄. ⚠ `minimumCacheTTL`(현재 1년) 미지원 — immutable/no-cache 패턴으로 대체됨 📄. next.config 의 remotePatterns 26호스트는 그대로 유효(바인딩 방식은 Next 검증 경유). 커스텀 로더 방식은 remotePatterns 우회라 **불채택**.
- **B4 크론 = 전용 디스패처 워커.** OpenNext 워커에 scheduled 핸들러를 섞지 않고, `workers/cron-dispatcher/` 별도 워커가 8개 크론 표현식(§H)으로 깨어나 `https://www.atockorea.com/api/cron/*` 를 `Authorization: Bearer ${CRON_SECRET}` 로 호출. **라우트 코드 0줄 변경** — Vercel 크론과 완전히 같은 계약. 한도: 크론 트리거 계정당 250(Paid) 📄 — 여유.
- **B5 빌드/배포 = Workers Builds** (GitHub 연동). 🔴 **로컬 Windows 빌드는 공식 미보장** 📄 — PoC 포함 모든 `opennextjs-cloudflare build` 는 Workers Builds/GitHub Actions(리눅스) 또는 WSL 에서. 로컬 `next dev` 개발 흐름은 무변경.
- **B6 배치 = Smart Placement ON.** Vercel 은 icn1 고정으로 Supabase(서울 ⚠확인)와 동거였다. Workers 기본값은 방문자 근접 실행이라 **미주 방문자 SSR 이 서울 DB 를 수십 번 왕복**하면 오히려 느려진다 — Smart Placement 가 DB 근접 배치로 이를 되돌린다. CF7 에서 p50/p95 실측 대조(기존 perf 트랙 수치와).
- **B7 정본 호스트 = www 유지.** ✅실측: 현재 apex→www 307. 재현: www 를 워커 커스텀 도메인으로, apex 는 CF Redirect Rule(307, path+query 보존).
- **B8 web-push = nodejs_compat 우선.** 실패 시 `@block65/webcrypto-web-push`(WebCrypto 기반, Workers 공식 호환) 로 스왑 — 영향 3파일 한정.
- **B9 DNS 이관 선행(CF4), 트래픽 전환 후행(CF6).** 회색 구름 이관은 동작 무변경이면서 전환·롤백을 초 단위 레코드 편집으로 만든다.
- **B10 스테이징 = 라이브 DB 공유.** 별도 DB 를 만들지 않는다(기존 QA 하니스 관행과 동일). 대신 **스테이징에서 금지 목록**: `/api/cron/*` 호출 · 실 이메일 대량 발송 · Stripe 캡처/환불 경로. (§I 금지 표)
- **B11 존 부가기능은 전부 OFF 에서 시작.** Rocket Loader·Email Obfuscation·Mirage/Polish 는 HTML/JS 를 주입·변형해 **React 하이드레이션을 깨는 대표 원인** — 명시적으로 끄고 시작(§G-2). 성능 기능은 안정화(CF7) 후 하나씩.
- **B12 vercel.json rewrites 3종 이식 안 함.** `/api/tours/:id`→`[id]` 는 Next 파일 라우팅이 원래 하는 일 — 레거시 no-op.

---

## §C 사장님 결정 게이트 (실행 전 필요)

| # | 결정 | 기본 권고 |
|---|---|---|
| D1 | **Cloudflare 계정 생성 주체·이메일·결제 카드** (Workers Paid $5/월 + Images 종량 §K). Vercel 사고(엉뚱한 계정)의 재발 방지: 계정은 사장님 소유로 만들고, 작업용 **API 토큰**(Workers·DNS·R2·D1·Images 스코프)만 발급해 주시는 구조 | 사장님 계정 + 스코프 토큰 |
| D2 | **컷오버 시점** — 예약·문의가 가장 적은 요일/시간대(KST 심야 권장). 크론 표(§H)의 KST 시각과 겹치지 않는 창 | 화~목 KST 01:00 이후 (10:00 결제캡처 크론 전 완료) |
| D3 | Namecheap 로그인 — **NS 변경과 존 export 는 레지스트라 대시보드에서만 가능**. 사장님이 직접 하시거나 화면 공유로 진행 | CF4 에서 15분 |
| D4 | **Vercel 정리 시점** — 전환 후 유예 기간(권고 2~4주) 뒤 프로젝트의 도메인 해제·크론 잔재 확인. 사장님 대시보드 로그인 필요 | 2주 후 |
| D5 | 스테이징에서 **LINE 로그인 테스트 여부** — 하려면 LINE 콘솔에 스테이징 콜백 URL 등록 필요. 안 하면 프로덕션 전환 직후 확인으로 갈음 | 갈음(전환 후 확인) |
| D6 | **Images 변환 과금 승인** — 무료 5천/월 초과분 $0.5/1천. 현 카탈로그 규모 추정 월 $3~8 ⚠ | 승인 |

---

## §D 페이즈 플랜 (나노 체크리스트)

### CF0 — 계정·권한 준비 (사람 게이트, 라이브 영향 0)
- [ ] D1 결정 → Cloudflare 계정 생성, **Workers Paid** 구독($5/월 — 10MB 워커·CPU 30s→5min·크론 250 이 전부 Paid 조건 📄)
- [ ] API 토큰 발급(스코프: Workers Scripts·Workers Builds·DNS·R2·D1·Durable Objects·Images·Zone Settings) → 로컬 `wrangler login` 또는 `CLOUDFLARE_API_TOKEN`
- [ ] GitHub 앱 연결(Workers Builds 용, `simsangsong` 레포 권한)
- [ ] **사장님 5분 — Vercel 대시보드 env 페이지 "이름 목록" 스크린샷**(§F-1 ② — sensitive 여도 이름은 보인다. 그 자리에서 표로 기록) + 같은 김에 Vercel 플랜/과금 화면 1장(§K 확정용)
- **게이트:** `wrangler whoami` 가 새 계정을 가리킴. (🔴 과거 교훈: whoami 만 믿지 말고 계정 이메일까지 대조)

### CF1 — 레포 호환성 패스 (Vercel 무영향 — 즉시 머지 가능)
§E 코드 티켓 중 **CT-1~CT-7** 을 구현한다. 전부 "추가" 또는 "Vercel 에서도 동작 동일" 변경이라 컷오버 전 언제든 main 머지 가능.
- [ ] CT-1 sharp 교체 · CT-2 fs 정적화 4곳 · CT-3 ALLOWED_ORIGINS 운영값 정리 · CT-4 SpeedInsights 제거
- [ ] CT-5 `wrangler.jsonc` + `open-next.config.ts` + npm 스크립트 추가 (아래 초안)
- [ ] CT-6 크론 디스패처 워커 폴더 추가 (배포는 아직 안 함)
- **게이트:** `npm run gate`(tsc 0 · jest 전그린) + Vercel 프리뷰 빌드 green + 업로드 경로 수동 확인(어드민 이미지 업로드 1건)
- **롤백:** 일반 PR revert — 라이브 영향 없음

**`wrangler.jsonc` 초안** (CT-5, 값은 CF3 에서 채움):
```jsonc
{
  "name": "atockorea",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "images": { "binding": "IMAGES" },
  "limits": { "cpu_ms": 300000 },
  "placement": { "mode": "smart" },
  "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "atockorea-inc-cache" }],
  "d1_databases": [{ "binding": "NEXT_TAG_CACHE_D1", "database_name": "atockorea-tag-cache", "database_id": "<CF3>" }],
  "durable_objects": { "bindings": [{ "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["DOQueueHandler"] }],
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "atockorea" }],
  "vars": { "APP_ORIGIN": "https://www.atockorea.com" }
}
```
**`open-next.config.ts` 초안:**
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
  // 빌드 프리스텝(build-catalog-cards.mjs)과 --webpack 을 보존하기 위해 npm run build 를 그대로 쓴다
  buildCommand: "npm run build",
});
```

### CF2 — PoC 빌드 게이트 (배포 없음, 라이브 영향 0)
🔴 Windows 로컬 빌드 미보장(B5) — **GitHub Actions(ubuntu) 일회용 워크플로 또는 WSL** 에서 실행.
- [ ] `npx opennextjs-cloudflare build` 성공
- [ ] **게이트 A — 워커 크기:** `.open-next/worker.js` gzip 크기 측정. **Paid 한도 10MB(gzip)/64MB(raw)** 📄. 273 라우트 규모라 최우선 확인 항목. 초과 시: 서버 번들 유입 대형 의존성 추적(`ANALYZE=true`)·불용 라우트 정리 후 재측정
- [ ] **게이트 B — 기동 스모크:** `wrangler dev`(원격 모드)로 홈 200 · 상품 상세 200 · `/api/tours` 200 · 챗봇 스트림 청크 수신 · SSE `events` 연결 · 로케일 리다이렉트(ko) · 이미지 변환 응답
- [ ] **게이트 C — 호환 판정 3건:** web-push 발송 1건(B8) · 재무 PDF 생성 1건(A-3 #4) · Stripe webhook 서명 검증(테스트 시크릿, CT-12)
- **산출물:** 판정표를 이 문서 §N 아래에 추가 커밋
- **롤백:** 없음(라이브 무접촉)

### CF3 — 스테이징 워커 (workers.dev, 라이브 영향 0)
- [ ] 리소스 생성: `wrangler r2 bucket create atockorea-inc-cache-staging` · `wrangler d1 create atockorea-tag-cache-staging`
- [ ] 스테이징 워커 배포(`atockorea-staging`, wrangler env 분리) → `https://atockorea-staging.<subdomain>.workers.dev`
- [ ] **환경변수 이식(§F):** NEXT_PUBLIC 9키는 **빌드 시점** 주입, 나머지 ~38키는 `wrangler secret put` (일괄 스크립트로. 🔴 값 원본은 `.env.local` — Vercel 에서 pull 금지)
- [ ] 외부 서비스 allowlist 에 스테이징 origin 추가: **Google Maps 키 referrer**(🔴 빠뜨리면 흰 지도 — 과거 실사고) · Supabase Auth redirect URL · `ALLOWED_ORIGINS` env
- [ ] **QA 1차(§I)** — 금지 목록(B10) 지키면서
- **게이트:** §I 스테이징 체크 전항목 + 콘솔 에러 0 + `wrangler tail` 로 런타임 에러 0
- **롤백:** 워커 삭제 — 라이브 무접촉

### CF4 — DNS 존 이관 (트래픽는 여전히 Vercel — 동작 무변경 이관)
- [ ] **(D3) Namecheap 존 전체 export/스크린샷** — §A-4 표와 대조해 누락 레코드 색출(특히 MX·TXT·서브도메인)
- [ ] Namecheap **DNSSEC 활성 여부 확인** — 활성이면 먼저 해제(미해제 시 NS 변경 후 해석 실패)
- [ ] CF에 존 추가 → 자동 스캔 결과를 export 본과 **1:1 대조**, 빠진 것 수동 추가
- [ ] 🔴 **전 레코드 DNS only(회색 구름)** — apex A `216.198.79.1` · www CNAME `cab20a0a00b0f27e.vercel-dns-017.com` · MX/TXT/DKIM/DMARC 전부 그대로
- [ ] Namecheap 에서 NS 를 CF 지정 2개로 교체 → 전파 대기(수 시간~48h)
- [ ] 검증: `dig @1.1.1.1` / `@8.8.8.8` 로 NS·A·CNAME·MX·TXT 신구 대조 전항목 일치
- **게이트(메일이 핵심):** ① Resend 로 발신 1통 → 헤더 DKIM=pass ② 인바운드 주소로 수신 1통 → `app/api/inbound/email` 처리 확인 ③ Stripe 대시보드 webhook 테스트 이벤트 200 ④ 사이트 정상(Server: Vercel 유지 확인)
- **롤백:** Namecheap NS 원복(레코드는 Namecheap 쪽에 그대로 남아 있음 — export 본이 보험)

### CF5 — 커스텀 도메인 스테이징 + 프로덕션 워커 준비 (라이브 영향 0)
- [ ] CF 존에 `staging.atockorea.com` → 스테이징 워커 커스텀 도메인 연결 → **실도메인 하위 최종 QA**(HSTS·쿠키 도메인·PWA 설치·웹푸시 구독까지)
- [ ] 프로덕션 리소스 별도 생성: R2 `atockorea-inc-cache` · D1 `atockorea-tag-cache`
- [ ] 프로덕션 워커 `atockorea` 배포(아직 도메인 미연결) + 시크릿 전체 세팅 + **키 존재 검증 스크립트**(값 말고 키 목록만 대조)
- [ ] Workers Builds 연결: `main` push → 프로덕션 배포 · PR → 프리뷰 버전. **GitHub PR 체크 상태가 뜨는지 확인**(현재 "Vercel 빌드 green"이 머지 게이트 — 동급 대체 필수, 안 되면 GH Actions 빌드 체크 추가 R11)
- [ ] 존 설정 체크리스트(§G-2) 적용 + WAF skip 룰(webhook 경로)
- **게이트:** staging.atockorea.com 에서 §I 전항목 + Workers Builds 가 main 커밋을 자동 배포하는 것 확인
- **롤백:** 커스텀 도메인 해제 — 라이브 무접촉

### CF6 — 컷오버 런북 (D2 승인된 창에서, 분 단위)
사전 조건: CF5 게이트 전부 green · Vercel 최신 main 배포 정상 · 담당(사장님 or 세션) 대기.
- [ ] **T-30m** 스테이징 최종 스모크 재실행 · `wrangler tail atockorea` 켜 둠
- [ ] **T-0** DNS 전환 — ① www 레코드를 워커 커스텀 도메인으로 교체(기존 CNAME 값은 메모) ② apex 는 Redirect Rule(→ https://www.atockorea.com, 307, path+query 보존) + 자리표시 A 레코드(프록시 ON)
- [ ] **T+5m** 스모크 15(§I-3): 홈/상품/목록/체크아웃 세션 생성/로그인/마이페이지/투어룸 SSE/챗봇 스트림/이미지 변환/robots/sitemap/PWA sw 로드/ko·ja 로케일/어드민/업로드
- [ ] **T+15m** Stripe webhook 테스트 이벤트 → 200 · Resend 발신 1통 · 인바운드 1통 (메일은 DNS 무변경이라 영향 없어야 정상 — 확인만)
- [ ] **T+30m** **크론 전환(§H 순서):** ① vercel.json 에서 crons 제거 커밋→머지(=Vercel 크론 정지. 🔴 Vercel 크론은 *.vercel.app 배포 URL 을 직접 때리므로 DNS 와 무관하게 계속 돈다 — 반드시 명시적으로 꺼야 함) ② 디스패처 워커 배포(크론 활성)
- [ ] **T+당일 04:15 KST** 재승인 크론 첫 실행 로그 확인(`wrangler tail` 디스패처) — 놓쳤으면 다음날 자동 회복(§H-1)이지만 확인은 한다
- [ ] **T+당일 10:15 KST** 💰 **캡처 크론 실행 확인** — 응답 summary(`captured`/`alreadyCaptured`/`failed`) 확인. 미실행/실패 시 §H-1 보충 커맨드로 즉시 수동 캡처(멱등이라 재실행 안전). **이 항목 전까지 컷오버는 끝난 게 아니다**
- [ ] **T+60m~24h** 관찰: Workers 대시보드 에러율 · `wrangler tail` · Supabase 로그 · 첫 ISR 재검증 히트 · 나머지 크론 실행 로그
- **롤백 트리거(즉시 원복):** 5xx 급증 · 결제/체크아웃 실패 · webhook 실패 · SSE 불통. **원복 절차 = www 레코드를 기존 Vercel CNAME 으로 되돌리고(회색), apex Redirect Rule 끄고 기존 A 복원 — 5분.** vercel.json 크론을 아직 안 지웠다면 크론도 자동 원상.

### CF7 — 안정화·관측·철거
- [ ] Smart Placement 효과 실측: 주요 라우트 p50/p95 를 기존 perf 트랙 수치(예: plan p95 973ms)와 대조 — 나빠진 라우트는 원인 추적
- [ ] CF Web Analytics 비콘 삽입(CT-4 후속) · Workers Logs 보존 설정 · (선택) Logpush
- [ ] Images 변환 카운트 모니터링 — 무료 5천 초과 시점·월 비용 확정(D6 실측치 보고)
- [ ] ISR 히트율 확인(R2 오브젝트 생성·재검증 큐 동작) + 어드민 상품 편집→즉시 반영(revalidatePath) 실사
- [ ] 2~4주 후(D4): 사장님 로그인으로 Vercel 프로젝트 도메인 해제·프로젝트 정리, `.vercel/project.json`(엉뚱한 jejufun 링크) 삭제, `@vercel/speed-insights` 의존성 제거 커밋
- [ ] 문서화: 이 문서에 실측 결과·최종 아키텍처 확정판 추가, CLAUDE.md 인프라 절 갱신, 메모리 갱신

---

## §E 코드 티켓 (파일 단위)

| # | 티켓 | 파일 | 크기 |
|---|---|---|---|
| CT-1 | sharp → Workers 호환 이미지 압축. 1순위: 업로드 라우트에서 **IMAGES binding**으로 리사이즈/재인코딩, 로컬(next dev)은 sharp 폴백 유지(런타임 분기) | `lib/image-compress.ts` + 업로드 라우트 2 | 중 |
| CT-2 | 런타임 fs 4곳 정적화: .ttf→base64 모듈 생성 스크립트, system.txt→.ts 문자열, cms-baseline·poi-override-pins→정적 import | A-3 #2 의 4파일 | 중 |
| CT-3 | 스테이징/프리뷰 origin 을 `ALLOWED_ORIGINS` 로 주입(코드 무변경, env 운영값 문서화) + `.env.local` 중복 `NEXT_PUBLIC_APP_URL` 2줄→1줄 정리 | env 만 | 소 |
| CT-4 | `<SpeedInsights/>` 제거 (CF7 에서 CF Web Analytics 비콘으로 대체) | `app/(marketing)/layout.tsx` | 소 |
| CT-5 | `wrangler.jsonc`·`open-next.config.ts`·`.dev.vars.example`·npm 스크립트(`cf:build`·`cf:preview`·`cf:deploy`)·`@opennextjs/cloudflare`+`wrangler` devDeps | 신규 파일 | 소 |
| CT-6 | 크론 디스패처 워커(§H 표를 코드로, `controller.cron` 매칭 → fetch, 실패 시 1회 재시도+로그) | `workers/cron-dispatcher/` 신규 | 소 |
| CT-7 | Images allowed-origins 대시보드 설정 목록 = next.config remotePatterns 26호스트 문서화(운영 체크리스트) | 문서 | 소 |
| CT-8 | (no-op 확인) `cf-ipcountry` 폴백 이미 존재 — 테스트만 추가 | analytics route | 소 |
| CT-9 | `limits.cpu_ms: 300000`(rag 크론 300s 대응) — CT-5 에 포함 | wrangler.jsonc | — |
| CT-10 | 컷오버 날: vercel.json crons 블록 제거 커밋(파일 잔여는 무해) | vercel.json | 소 |
| CT-11 | (선택, 재발 방지 게이트) `__tests__/audit/workersRuntimeCompat.test.ts` — app/lib 런타임 경로에 sharp import·`readFileSync(process.cwd()` 신규 유입 금지 래칫 | 신규 테스트 | 소 |
| CT-12 | CF2 판정에 따라 stripe webhook `constructEvent`→`constructEventAsync` | webhook route | 소 |

## §F 환경변수 이식 — "복사"가 아니라 "원본 재수집"이다

### F-0 전제 두 가지 (✅ 실측, 2026-08-08 — 사장님 질문에 대한 답)

1. **Vercel 의 sensitive env 는 설계상 아무도 못 꺼낸다** — 대시보드에서도, CLI 에서도, Vercel 자신도
   값을 다시 보여주지 않는다(쓰기 전용). 우리가 권한이 없어서가 아니라 원래 그런 물건이다.
   → 이식은 "Vercel 에서 복사"가 아니라 **각 시크릿의 원 발급처(Stripe·Supabase·Resend·각 콘솔)에서
   재수집**하는 작업이다. 단, **이름 목록은 sensitive 여도 대시보드에 다 보인다** — 이게 열쇠.
2. **코드가 읽는 env 전수 = ~120개** (`git grep process.env` ✅) vs `.env.local` 49키. 차이 ~70개의
   정체를 실측했다: **대부분이 "미설정 시 코드 기본값으로 동작"하는 선택 튜너블**(모델명·캡·플래그·
   STT 파라미터 등 — 안 옮겨도 지금과 동일 동작)이고, 시크릿류도 전부 dev 폴백 설계였다
   (`TOUR_ROOM_TOKEN_SECRET`·`OPS_GUIDE_SCHEDULE_TOKEN_SECRET`·`AGENT_QUOTE_SECRET` — 미설정 시
   경고 로그 + dev 폴백 ✅ 코드 확인). 즉 **"로컬에 없는 키" 때문에 앱이 안 켜지는 일은 없다.**
   문제는 딱 하나 — *라이브에서 실제 설정돼 있는* 키를 다른 값으로 시작하면 그 키로 서명/암호화된
   기존 산출물(링크·암호문)이 무효가 되는 것. 그 대상과 처치를 F-3/F-4 에 못 박는다.

### F-1 절차 5스텝

1. **필요 목록의 정본 = 코드** (✅ 완료 — ~120키 추출). Vercel 에 있어도 코드가 안 읽으면 죽은 키.
2. **사장님 5분: Vercel 대시보드 env 페이지에서 "이름 목록" 스크린샷** (값 말고 이름·대상환경은
   sensitive 여도 다 보인다) → 그 자리에서 표로 기록. 이것으로 "라이브에 실제 설정된 키" 확정 —
   특히 F-3 후보들과 `UPSTASH_REDIS_REST_URL`(설정돼 있으면 우리가 모르던 Redis 가 있는 것)의 존재 판정.
3. **값 수집 우선순위:**
   - (a) `.env.local` 49키 → 그대로 사용 (로컬 dev 가 실 Stripe·실 DB·실 Resend 로 돌아온 이력 =
     프로덕션과 같은 값일 개연성 높음. 개연성은 증거가 아니므로 검증은 F-4)
   - (b) 발급처 콘솔 재조회: Supabase 서비스롤 키·Stripe 시크릿/웹훅 서명(대시보드 reveal)·Resend·
     각종 API 키·Upstash — 로그인만 하면 언제든 다시 보인다
   - (c) 우리가 양끝을 다 제어해서 **그냥 새로 정하면 되는 것**: `CRON_SECRET`(앱+디스패처 동시 교체)·
     Telegram webhook secret(`setWebhook` 재호출로 새 값 지정)
   - (d) 발급처 없는 자체 난수 + 값 복구 불가 → **로테이션**(F-3 — 지금은 영향 미미)
   - (e) **최후 수단**(교체 불가인데 값 복구가 꼭 필요한 키가 남을 때만): 배포 권한은 살아 있으므로
     (git push → vercel[bot] 자동 배포), `requireAdmin`+일회용 헤더로 잠근 임시 라우트가 **지정 키
     몇 개만** 사장님 화면에 표시 → 읽고 → 즉시 revert. Vercel 대시보드가 해 주던 일을 우리 손으로
     하는 것뿐이지만, 진짜 필요할 때만 쓴다.
4. **특별 관리 키 검증 — 값 비교가 아니라 기능으로 (F-4)**
5. **CF 주입:** NEXT_PUBLIC 9종=Workers Builds 빌드 env(번들에 구워짐), 나머지=`wrangler secret put`
   일괄 스크립트(.env.local 을 읽어 키별 put, 값은 화면에 안 찍음) + 키 존재 대조 스크립트.

### F-2 이식 표 (✅ `.env.local` 실측 — 값 아닌 키만)

- **빌드 시(Workers Builds 빌드 env, NEXT_PUBLIC 은 번들에 인라인):** `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` · `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` · `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` · `NEXT_PUBLIC_REVIEW_FLOW_PREVIEW` · `NEXT_PUBLIC_TOUR_MODE_V1`
- **런타임 시크릿(`wrangler secret put`):** `SUPABASE_SERVICE_ROLE_KEY` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `RESEND_WEBHOOK_SECRET` · `RESEND_FROM_EMAIL` · `GEMINI_API_KEY` · `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `GROQ_API_KEY` · `GOOGLE_MAPS_API_KEY` · `KAKAO_REST_API_KEY` · `KAKAO_MOBILITY_REST_API_KEY` · `TOUR_API_KEY` · `VISIT_JEJU_TOUR_API` · `EXCHANGE_RATE_API_KEY` · `LINE_CHANNEL_ID` · `LINE_CHANNEL_SECRET` · `CRON_SECRET`(디스패처 워커에도) · `ADMIN_SUPPORT_API_TOKEN` · `IP_HASH_SALT` · `OPS_INBOUND_WEBHOOK_SECRET` · `OPS_GUIDE_PII_ENC_KEY`(🔴 교체 금지 키) · `WEB_PUSH_VAPID_PRIVATE_KEY` · `WEB_PUSH_CONTACT` · `SLACK_QUOTE_WEBHOOK_URL` · `TELEGRAM_BOT_TOKEN` · `TELEGRAM_BOOKING_CHAT_ID` · `PEXELS_API_KEY` · `UNSPLASH_ACCESS_KEY` · `UNSPLASH_SECRET_KEY` · `UNSPLASH_VERIFICATION_CODE` · `PIXABAY_API_KEY` · `FLICKR_API_KEY` · `FLICKR_SECRET_KEY` · `JEJU_UPSERT_SUPABASE` · `TOUR_PRODUCT_USE_SUPABASE` · `CHAT_AUDIT_LOG` · `SEED_PLACES_SECRET`(스크립트용 — 필요 시)
- **버리는 것:** `VERCEL_OIDC_TOKEN`(Vercel CLI 잔재) + Vercel 이름 목록(F-1 ②)에서 코드가 안 읽는 죽은 키 전부

### F-3 서명·암호화 시크릿 — 라이브 값과 달라지면 무엇이 죽나 (✅ 코드 확인)

| 키 | 서명/암호화 대상 | 값 복구 실패 시(=로테이션) 영향 | 처치 |
|---|---|---|---|
| `TOUR_ROOM_TOKEN_SECRET`(+`_PREV`) | 투어룸 장문 토큰(`?rt=`)·동반자·좌석 클레임/체크인·QR 논스 | 기존 발송 링크 무효. **현재 실발송 0(사장님 결정)·입장은 DB 원장 코드(PR #814)라 영향 미미**. 재발급 도구 존재(/reinvite·어드민 발송) | 라이브 값 복구되면 `_PREV` 에 넣어 무단절 로테이션(이중 검증 슬롯이 이미 코드에 있다 ✅). 복구 안 되면 새 값+링크 재발급 |
| `OPS_GUIDE_SCHEDULE_TOKEN_SECRET`(+`_PREV`) | 가이드 셀프 스케줄 링크 `/g/schedule/[token]` | 기발송 링크 무효 → 재발송 버튼으로 회복 | 동일(_PREV 슬롯 존재) |
| `AGENT_QUOTE_SECRET` | 에이전트 견적 토큰 | 미결 견적 링크 무효 | 동일 |
| 🔴 `OPS_GUIDE_PII_ENC_KEY` | **가이드 PII 암호문(DB 저장)** — CLAUDE.md "한 번 넣으면 교체 금지" | **로테이션 불가** — 다른 값이면 기존 암호문 영구 복호 불능 | `.env.local` 에 있음 ✅. F-4 복호화 테스트로 프로덕션 동일 여부 판정. 불일치면 최후 수단(F-1 ③e) 1순위 |
| `WEB_PUSH_VAPID_PRIVATE_KEY`(+공개키) | 웹푸시 구독 | 키쌍 바꾸면 **기존 푸시 구독 전멸**(재구독 필요) | `.env.local` 에 있음 ✅. 공개키는 라이브 클라이언트 번들에 노출되므로 라이브 vs 로컬 문자열 대조로 즉시 판정(F-4) |
| `STRIPE_WEBHOOK_SECRET` | webhook 서명 검증 | — (Stripe 대시보드에서 언제든 reveal) | 같은 엔드포인트 URL 유지 = 같은 시크릿. 재조회 (b) |
| `IP_HASH_SALT` | 분석용 IP 해시 | 해시 연속성만 끊김(치명 아님) | 로컬 값 사용 |

### F-5 Vercel 실명단 대사 완료 (✅ 2026-08-08 — 사장님 스크린샷 3장 × 코드 × 로컬 3방향, F-4 뒤에 이어 읽어라)

스크린샷 기준 Vercel 등록 43키(마지막 화면이 목록 끝 — System Env 체크박스 확인. 첫 장 위쪽이 잘렸다면 한 장 추가 필요). **전 키의 회수 경로가 확정됐고, 최후 수단(F-1 ③e)은 불필요해졌다.**

| 그룹 | 키 | 회수 경로 |
|---|---|---|
| **평문·열람 가능 17** (눈 아이콘, All Environments) | STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET · SUPABASE_SERVICE_ROLE_KEY · RESEND_API_KEY · RESEND_WEBHOOK_SECRET · RESEND_FROM_EMAIL · ANTHROPIC_API_KEY · GEMINI_API_KEY · LINE_CHANNEL_ID · LINE_CHANNEL_SECRET · GOOGLE_MAPS_API_KEY · NEXT_PUBLIC_GOOGLE_MAPS_API_KEY · NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY · NEXT_PUBLIC_APP_URL · MAPS_API_KEY | **사장님이 대시보드에서 지금도 reveal 가능** → CF 주입 시 직접 복사(채팅·문서에 값 옮기지 않는다). 로컬 49키와의 동일성 최종 판정은 F-4 기능 테스트. ⚠ "Needs Attention" 뱃지 7개는 Vercel 이 평문 저장된 고가치 시크릿에 다는 권고 표시로 보임(⚠추정) — 이사와 무관 |
| **sensitive 이지만 로컬 보유** | GROQ · KAKAO_REST · OPENAI · OPS_INBOUND_WEBHOOK_SECRET · CHAT_AUDIT_LOG · IP_HASH_SALT · ADMIN_SUPPORT_API_TOKEN · TELEGRAM 2종 · SLACK_QUOTE_WEBHOOK_URL · WEB_PUSH_CONTACT · CRON_SECRET · NEXT_PUBLIC_TOUR_MODE_V1 · 🔴 OPS_GUIDE_PII_ENC_KEY | `.env.local` 값 사용. PII 키만 F-4 복호화 테스트로 프로덕션 동일성 **필수 판정**. CRON_SECRET 은 어차피 신규 발급(F-1 ③c) |
| **sensitive + 로컬 없음, 그러나 공개값** | NEXT_PUBLIC_TOUR_OPS_PHONE · NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID · NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY | NEXT_PUBLIC 은 라이브 클라이언트 번들에 그대로 인라인 — **라이브 사이트 JS 에서 그대로 복구 가능**(sensitive 잠금이 무의미한 부류) |
| **sensitive + 로컬 없음, 운영값** | OPS_ALERT_EMAIL · ADMIN_BOOKING_NOTIFICATION_EMAILS · OPS_INBOUND_ADDRESSES · CHAT_STREAMING | 사장님이 아는 값(메일 주소 3개) + CHAT_STREAMING 은 킬스위치 `"1"`(✅ 코드 확인 — 설정돼 있다는 것 자체가 프로덕션 스트리밍 ON 이라는 뜻 → CF 에도 `1`) |
| **회수 불가 → 신규 발급으로 확정 2** | TOUR_ROOM_TOKEN_SECRET · WEB_PUSH_VAPID_PRIVATE_KEY | 백업 부재 실측: 문서(2026-07-15)가 말한 `.env.vapid-production.local` 은 **4개 경로 전수 검색에서 부재**(대청소 때 소실 추정). 파급 실측: ① 룸 장문 토큰 — 실발송 0 + 입장은 DB 원장 코드(PR #814)라 죽는 링크 없음 ② 푸시 구독 — **DB 전체 3건**(✅ 라이브 쿼리, 전부 테스트 성격) → 재구독 3기기. **둘 다 신규 발급이 최저비용** — 최후 수단 라우트 불필요 |
| **죽은 키 2 — 이식 제외** | EB_PUSH_CONTACT(WEB_ 오타 중복 추정 — 코드 참조 0 ✅) · ALLOW_SIM_SEED(서버 코드가 안 읽음 — `scripts/k4-seed.ts` 등 로컬 스크립트 전용 ✅) | — |

추가 확정 2건: **Upstash Redis 미설정**(숨은 인프라 없음 — 프로덕션 레이트리밋은 인스턴스 메모리, 현상 유지) · `OPS_GUIDE_SCHEDULE_TOKEN_SECRET`/`AGENT_QUOTE_SECRET` **프로덕션에도 미설정**(dev 폴백으로 동작 중 — CF 에서도 미설정이 동작 보존. 진짜 시크릿 승격은 이사 후 별도 티켓).
로컬에만 있고 Vercel 에 없는 나머지(사진 소싱 키 8종·KAKAO_MOBILITY·JEJU_UPSERT 등)는 **스크립트 전용** — 워커에 넣지 않는다.

### F-4 검증 — 값을 눈으로 비교하지 않고 판정하는 법

- 🔴 **PII 키:** 라이브 DB 의 암호화된 가이드 PII 1행을 **로컬 키로 복호화하는 스크립트** → 성공=로컬 값이 프로덕션과 동일 확정 / 실패=불일치 조기 발견(조용한 데이터 손실을 이사 전에 잡는다)
- ~~**VAPID:** 라이브 번들 공개키 vs 로컬 대조~~ → **F-5 로 종결** — 프로덕션 키쌍은 로컬과 다른 별도 생성본이었고(2026-07-15 문서) 백업 파일 소실 → **신규 발급 확정**(구독 3건 재등록)
- **Stripe/Supabase/Resend 등:** 스테이징 워커에서 기능 호출 1건씩(PI 목록 조회·서비스롤 쿼리·테스트 발송) — §I 스모크가 곧 키 검증
- ~~**토큰 시크릿:** 라이브 토큰 검증 대조~~ → **F-5 로 종결** — 신규 발급 확정(죽는 링크 없음)

## §G DNS·존 설정

**G-1 레코드:** §A-4 표 그대로 1:1 이관(회색) → CF6 에서 www/apex 만 전환. 이관 후에도 MX·TXT·DKIM·DMARC 는 영원히 DNS only.

**G-2 존 설정 체크리스트(CF5 적용):**
- OFF: Rocket Loader · Email Obfuscation · Mirage/Polish · Auto Minify(존재 시) · Always Online (🔴 전부 하이드레이션/콘텐츠 변형 위험 — B11)
- ON: Brotli · HTTP/2·3 · IPv6 · Tiered Cache(무해) · SSL **Full (Strict)** · Min TLS 1.2
- HSTS: 앱이 이미 `Strict-Transport-Security` 전송(next.config ✅) — CF 존 레벨 HSTS 는 **중복 설정하지 않음**(이중 관리 방지)
- WAF: Managed Rules 기본 ON + **Skip 룰**: `/api/stripe/webhook` · `/api/webhooks/*` · `/api/inbound/*` · `/api/cron/*` (봇 판정·챌린지 금지 — 서명 검증이 인증) · Bot Fight Mode **OFF**
- Cache Rules: `/api/*` Bypass 명시(워커 응답은 기본 비캐시지만 벨트&서스펜더)
- Redirect Rule: apex→www 307 (B7)

## §H 크론 이식 표 (vercel.json ✅ → 디스패처 워커)

| 경로 | UTC | KST | 성격 | 이중 실행 정책 |
|---|---|---|---|---|
| /api/emails/reminders | `0 9 * * *` | 18:00 | 이메일 발송 | 공백 허용(다음날 재집계) |
| /api/cron/ops-daily-report | `0 9 * * *` | 18:00 | 리포트 | 공백 허용 |
| /api/cron/recapture-holds | `0 19 * * *` | 04:00 | 💰 결제 재승인 | 🔴 **공백>중복** — Vercel OFF 후에만 CF ON |
| /api/cron/capture-tour-day-payments | `0 1 * * *` | 10:00 | 💰 당일 캡처 | 🔴 동일 |
| /api/cron/analytics-refresh-views | `0 17 * * *` | 02:00 | 뷰 갱신 | 무해(멱등) |
| /api/cron/analytics-anonymize | `0 18 * * *` | 03:00 | 익명화 | 무해 |
| /api/cron/rag-reindex | `30 16 * * *` | 01:30 | 인덱스(300s) | 무해 |
| /api/cron/rag-harvest | `30 15 * * 1` | 월 00:30 | 하베스트(300s) | 무해 |
| /api/cron/tour-room-flywheel | `0 16 * * 1` | 월 01:00 | 플라이휠 | 무해(멱등 설계) |

디스패처 크론 표현식 8개(`0 9`,`0 19`,`0 1`,`0 17`,`0 18`,`30 16` 매일 + `30 15`,`0 16` 월요일), `controller.cron`+요일로 경로 매핑. **전환 순서: vercel.json 크론 제거 머지 → 다음 크론 시각 전에 디스패처 배포.**

### H-1 카드 홀드·당일 결제는 이사와 무관하다 (✅ 코드 실측, 2026-08-08 — 사장님 질문에 대한 답)

**홀드는 Vercel 이 아니라 Stripe 계정에 있다.** 예약 시 저장된 카드(SetupIntent)·승인된 홀드
(PaymentIntent `requires_capture`)·고객 객체는 전부 Stripe 서버의 상태고, 우리 쪽에는 그 ID 만
Supabase `bookings` 에 있다(`payment_intent_id` 등). 둘 다 이사 대상이 아니다. 당일 결제(캡처)는
"같은 `STRIPE_SECRET_KEY` 로 `paymentIntents.capture(id)` 를 호출"하는 것뿐이라 **호출하는 서버가
Vercel 이든 Cloudflare 든 결과가 동일하다.** 기존 홀드 → CF 크론이 캡처: 아무 문제 없음.

**유일한 위험은 전환 당일 크론의 공백/중복인데, 두 라우트를 실측하니 방어가 이미 코드에 있다:**

| | 캡처(`capture-tour-day-payments`, 10:00 KST) | 재승인(`recapture-holds`, 04:00 KST) |
|---|---|---|
| **중복 실행 시** | **안전** — 멱등키 `tour-day-auto-capture-{booking}-{date}` + PI 상태 검사(`succeeded`→alreadyCaptured, `requires_capture` 만 캡처). 이중 청구 불가 | **같은 날은 안전** — 멱등키 `reauth-{booking}-{today}` + `payment_intent_id IS NULL` 필터 |
| **하루 공백 시** | 🔴 **자동 회복 없음** — 당일(`tour_date = 오늘`) 조회 전용이라 놓친 날짜는 다음날 크론이 안 집는다. **단 수동 보충 경로가 이미 있다**: `?date=YYYY-MM-DD&force=1` | **자동 회복** — 조회 창이 [오늘, +6일] 이라 다음날 실행이 같은 예약을 다시 집는다 |
| **홀드 유효기간 여유** | 홀드는 투어 5~6일 전 재승인이라 7일 유효 내 — 하루 늦은 보충 캡처도 유효기간 안 | — |

**보충 커맨드(컷오버 런북 CF6에 포함):**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.atockorea.com/api/cron/capture-tour-day-payments?date=$(date +%F)&force=1"
```
→ 결론: **공백>중복 원칙은 운영 원칙으로 유지하되, 실제로는 어느 쪽이 나도 사고가 아니다**
(중복=멱등, 공백=재승인 자동/캡처 수동 1커맨드). 컷오버 당일 확인 항목은 CF6 T+당일 10:15 참조.

## §I QA 매트릭스

**I-1 스테이징에서 도는 기존 하니스(BASE_URL 만 스테이징으로):** `npm run gate`(로컬) · `qa:tap-reachability` · `qa:rail-scrollbars` · `scripts/qa-cjk-render.mjs` · `qa-chrome-overlap.mjs` · 카탈로그/홈 실렌더 스크린샷 대조(라이브 vs 스테이징 동일 페이지)
**I-2 스테이징 금지 목록(B10 — 라이브 DB 공유 때문):** `/api/cron/*` 호출 금지 · 어드민 일괄 이메일 발송 금지 · Stripe 캡처/환불 경로 금지 · 투어룸 실브로드캐스트 발송 금지(테스트 룸만)
**I-3 컷오버 스모크 15:** §D CF6 T+5m 목록 (홈 · 상품상세 · /tours/list · 체크아웃 세션 생성 · 로그인/세션 유지 · 마이페이지 · 투어룸 SSE 수신 · 챗봇 스트리밍 · `_next/image` 변환 응답 200 · robots.txt · sitemap.xml · `sw-tour-mode.js` 로드 · /ko·/ja 각 1페이지 · /admin 게이트 · 이미지 업로드 1건)
**I-4 컷오버 후 24h 관찰:** Workers 에러율 · 크론 9종 첫 실행 로그 · Resend 수발신 · webhook 배달 성공률 · ISR 재검증(상품 편집→반영)

## §J 리스크 레지스터

| # | 리스크 | 확률/영향 | 완화 | 뒷문 |
|---|---|---|---|---|
| R1 | 워커 10MB(gzip) 초과 — 273라우트 대형 앱 | 중/치명 | **CF2 게이트 A 를 최우선 실행**(다른 작업 전에 판정) | 번들 다이어트, 최악 시 이 플랜 중단 판정 지점 |
| R2 | web-push 미동작 | 중/중 | CF2 게이트 C | `@block65/webcrypto-web-push` 스왑(3파일) |
| R3 | @react-pdf 폰트/실행 실패 | 중/소(어드민 한정) | CT-2 base64 + CF2 검증 | 최악: PDF 만 별도 경로(후속 티켓) |
| R4 | SSE 가 CF 프록시에서 버퍼/절단 | 저/중 | 스트리밍 응답은 Workers 네이티브, 60s 사이클+재연결(K1a 방어) 기존재 | 폴링 폴백 이미 구현돼 있음(`sseFallback.ts`) |
| R5 | 메일 수신 단절(MX 누락) | 저/치명 | CF4 게이트가 메일 실측 3종 | NS 원복 |
| R6 | 💰 크론 이중 실행 | 저/치명 | §H 순서 고정(공백>중복) + 멱등 확인 | 캡처 크론 수동 1회 실행으로 공백 보충 |
| R7 | ISR/revalidatePath 미동작 → 어드민 편집 반영 안 됨 | 중/중 | B2 구성 + CF3/CF7 실사 | 임시로 revalidate 값 축소 |
| R8 | Rocket Loader 류가 하이드레이션 파괴 | 저(예방됨)/중 | B11 — 시작부터 전부 OFF | 존 설정 원복 |
| R9 | Google Maps 흰 지도(referrer 미등록) | 중(과거 실사고)/중 | CF3·CF5 에서 스테이징/신규 origin 등록 | 키 콘솔에서 즉시 추가 |
| R10 | Workers Builds 가 PR 머지 게이트를 못 대체 | 중/소 | CF5 에서 확인, 안 되면 GH Actions `next build` 체크 추가 | — |
| R11 | Windows 로컬에서 opennext 빌드 불가 | 고/소 | 빌드는 CI/WSL 고정(B5), 로컬은 next dev 유지 | — |
| R12 | Vercel env 에 `.env.local` 에 없는 키 존재 | 중/중 | §F 의 `process.env` 전수 grep 대조 스텝 | 기능별 조기 발견용 스모크(§I) |
| R13 | 미주 방문자 SSR 지연(DB 왕복 증가) | 중/중 | Smart Placement ON + CF7 p95 대조 | 필요 시 캐시 확대 |
| R14 | 스테이징이 라이브 DB 오염 | 중/중 | B10 금지 목록 + 테스트 룸/계정만 사용 | — |
| R15 | 인메모리 rate-limit 의미 변화(아이솔레이트 단위) | 저/소 | Vercel 인스턴스 단위와 동급 — 현상 유지, 후속에 KV/DO 승격 검토 | — |
| R16 | DNSSEC 미해제로 NS 전환 후 해석 실패 | 저/치명 | CF4 사전 확인 항목 | Namecheap 에서 해제 후 재전파 |

## §K 비용 비교 (월, ⚠추정 — CF7 에서 실측 확정)

| 항목 | Vercel(현) | Cloudflare(후) |
|---|---|---|
| 기본 플랜 | Pro $20 ⚠(크론 9개=Pro 조건, 사장님 대시보드에서 확인 필요) | Workers Paid **$5** |
| 요청/실행 | 포함+초과 종량 | 1천만 req/월 포함 후 $0.30/백만 |
| 대역폭 | 100GB 포함 후 종량 ⚠ | **무과금** |
| 이미지 최적화 | Pro 포함분 후 종량 | 5천 변환 무료 후 $0.5/1천 → **$3~8 ⚠** |
| ISR 저장 | 포함 | R2 10GB 무료 구간 내 ~$0 |
| 태그 캐시/큐 | — | D1 무료 구간 · DO 소액 |
| CI | 포함 | Workers Builds 포함분 내 |
| **합** | **$20+** ⚠ | **약 $8~15** ⚠ |

## §L 롤백 총칙
- CF0~CF3·CF5: 라이브 무접촉 — 롤백 개념 없음(리소스 삭제만).
- CF4: NS 원복(Namecheap 존은 남아 있음). 이관 후 취소해도 손해 없음.
- CF6: **www 레코드 원복 + apex Redirect Rule 해제 = 5분.** Vercel 배포는 계속 살아 있으므로 즉시 이전 상태. 롤백 후 크론: vercel.json 제거 커밋을 revert.
- CF7 이후: Vercel 정리(D4) 전까지는 언제든 CF6 롤백 절차 유효. **정리 후에는 되돌아갈 곳이 없다 — 그래서 2~4주 유예.**

## §M 이관 후 최적화(별도 트랙 후보)
Cache Rules 로 정적 페이지 엣지 캐시 확대 · R2 로 대용량 미디어 이전(276MB public 슬림화) · Turnstile(폼 보호) · Logpush 상설 관측 · `nodejs_compat` 의존 축소.

## §N 근거
- ✅실측(이 세션): 라우트/페이지/public 카운트, Vercel 결합 grep 전수, `.env.local` 키 목록, nslookup(NS·A·CNAME·MX·TXT·DKIM·DMARC), apex 307→www·`Server: Vercel` 헤더, `cf-ipcountry` 폴백 존재, DOMPurify 'use client', sharp/fs/web-push 사용처.
- 📄공식문서(2026-08-08 조회): opennext.js.org/cloudflare(Next 16 지원·Node 런타임 전용·Windows 미보장), 동 /caching(R2+DO+D1 바인딩), developers.cloudflare.com/workers/platform/limits(10MB gzip·CPU 30s→5min·바디 100MB·크론 250/계정·자산 10만 파일·25MiB/파일), /images/pricing(5천 무료·$0.5/1천).
- ⚠추정: Supabase 리전(서울) · Vercel 실플랜 · Images 월 변환량 · Vercel 프로덕션 env 완전 일치 여부 — 각각 확인 스텝을 페이즈에 심어 둠.
