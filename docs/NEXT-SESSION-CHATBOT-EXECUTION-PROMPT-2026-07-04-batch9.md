# 다음 세션 부트스트랩 — 챗봇 Excellence 배치9+ (2026-07-04 작성)

> **이 문서 하나만 읽으면 그대로 이어서 실행할 수 있도록 쓴 인수인계다.**
> SoT는 여전히 `docs/chatbot-excellence-master-plan-2026-07-04.md` — §D 진행 로그(배치1~8)와 §D 티켓별 ✅ 마커가 최신 상태다. 메모리 `project_chatbot_excellence_plan.md`도 동기화돼 있다.

## §1 현재 상태 (2026-07-04 세션 종료 시점)

**배치 1~8 전부 머지·배포·프로덕션 검증 완료.** PR #237(배치1) #238(배치2) #239(배치3) #240(배치4) #241(배치5) #242(배치6) #244(배치7) #246(배치8).

- **완료된 웨이브**: Wave 0(생존) · Wave 0.5-SEC(보안) · Wave 1(정직함) · Wave 1.5(에스컬레이션/인텐트) · Wave 2 코어(W2.0~2.2, 2.5~2.10) · Wave 3(속도) · Wave 4 자율분(W4.0/4.2/4.7/4.8) · W5.1.
- **프로덕션 최종 게이트**: 골든 배터리 **24✅/0❌/xfail 0**, 스트리밍 **TTFT 1.3~1.8s**(기준선 3.4~7.0s), 문의 완료 3~9s.
- 진단 C-1~C-39 중 코드로 해소 가능한 항목은 전부 처리됨. C-28(조회 열거 오라클)은 레이트리밋+x-real-ip로 완화 상태 유지(수용 리스크), C-33(텔레그램 4096자/세션메모리 스크럽 잔여)은 🟡 미착수.

## §2 환경 (이 세션이 쓰던 그대로)

- **워크트리**: `C:\Users\sangsong\atockorea-chatbot` (node_modules는 메인 dir 정션, `.env.local` 복사돼 있음). 메인 dir(`C:\Users\sangsong\atockorea`)은 타 세션 경합 — 건드리지 말 것.
- 배치마다 `git fetch origin main && git checkout -b feat/chatbot-excellence-batch9 origin/main`로 새 브랜치.
- **골든 배터리(모든 배치의 종료 게이트)**: `npm run chatbot:golden -- --writes` (프로덕션 대상) / `-- --base http://localhost:3013 --writes` (로컬). 쓰기 스위트는 부산물 자동 정리(예약→cancelled, 티켓→resolved). suites: inquiry·recommend·price·quote·edge-quote·catalog-freshness·lookup·guard·perf·handoff.
- 로컬 검증 루프: `npm run build` → `CHAT_STREAMING=1 npx next start -p 3013` → 골든 → 서버 kill.
- PR/머지: gh 없음 → `git credential fill`로 토큰 떠서 GitHub REST API(이전 커밋들 참고). 머지 후 Vercel 자동배포 ~3-5분, `/api/cron/rag-reindex`가 401 주면 배포 완료 신호.

### 운영 함정 (이번 세션에서 실제로 겪음)
1. **`.next` 오염**: 빌드 중 서버 kill 등으로 오염되면 **콘솔 에러 없이 페이지 전체 하이드레이션이 죽는다**(위젯 클릭 무반응). 프리뷰가 이상하면 무조건 `rm -rf .next && npm run build`.
2. **골든 cleanup 실패 시 수동 정리 SQL**: `update bookings set status='cancelled' where contact_email like 'golden-%@example.com' and status='pending';` + golden 문구 포함 open 티켓 resolved.
3. **thinking 토큰 잠식**: gemini-2.5 계열은 thinking이 maxOutputTokens를 소모해 JSON/답변이 무음 절단된다. 신규 Gemini 호출을 추가하면 반드시 `thinkingConfig: { thinkingBudget: 0 }`(또는 충분한 예산) 명시. 메인 답변은 env `GEMINI_ASSISTANT_THINKING_BUDGET`(기본 0), 추출은 `GEMINI_QUOTE_EXTRACT_MODEL`(기본 flash-lite).
4. 골든 quote 스위트의 대화 언어는 en+ko 혼합 — 서버 응답 로케일은 마지막 유저 메시지 기준이므로 어서션은 양언어 키워드로.

## §3 다음 작업 (추천 순서)

**착수 전 사용자에게 게이트 3개 상태부터 물어볼 것** (§F):
- **G-3**: qa_pairs 초안 승인(/admin/chatbot-analytics 또는 /admin/qa-review). W5.1 주간 cron(월 15:30 UTC)이 초안을 쌓고 Telegram 알림을 보냄. 첫 실행 시 ~40건 예상.
- **G-4**: W4.1 리치 투어 카드 **디자인 시안 승인**. 승인되면 아래 배치9가 열린다.
- **G-2**: `vercel login` 1회(함수 로그 관측 — `[chat-timing]` 라인 확인용).

### 배치9 (G-4 승인 시) — 위젯 리치 UX 세트
서로 같은 응답 스키마/디자인 계열이라 한 배치로:
- **W4.1** 리치 투어 카드: 서버가 `{reply, cards?: [{slug,title,imageUrl,priceFrom,href}], chips?: string[]}` 반환(카드 데이터는 카탈로그 레지스트리에서 결정론 구성 — `listStaticTourProducts`/`lib/agent/catalog.ts` 재활용, 모델은 slug만 지정), 위젯이 카드+버튼 렌더. URL 텍스트 나열 제거.
- **W4.3** 후속 질문 칩 2~3개(chips 필드), 투어 페이지 스타터 개인화, 재방문 시 chat_memory 이어가기 제안.
- **W2.3** 견적 슬롯 칩/컨트롤(지역 3버튼·날짜 피커·인원 스텝퍼·시간 슬라이더 — 서버 슬롯 스키마 재사용) + **W2.10 잔여**(추출 이메일 "○○ 맞으신가요?" 확인턴을 칩으로).
- 골든 보강: cards 스키마 검증 케이스 추가.

### 배치10 (자율 가능, G-4 무관)
- **W4.4** 모바일 폴리시(키보드 오픈 시 입력창, 패널 높이/스크롤) + **W4.5** 접근성(포커스 트랩, aria-live 스트리밍(단계표시엔 이미 있음), 명도 대비) — preview_resize 375px로 검증.
- **W4.6** 신뢰 배지: RAG 답변에 source_type 라벨+링크, 견적 카드에 "지금 결제 아님·24h 전 100% 환불" 고정 표기.
- **W5.3** 피드백 수집률: 노출 타이밍/카피 조정, 부정 피드백 사유 칩(선택).
- **W5.4** 주간 운영 리듬 문서화(갭→초안→승인→색인) — docs에 1페이지.
- **C-33 잔여**: 텔레그램 4096자 절단 가드, 세션메모리 스크럽 보강.

### 배치11+ — Wave 6 (기능 확장, §D 순서)
- **W6.1** 가용성 즉답(무한 정책이므로 즉답+예약 CTA) → **W6.2** 멀티투어 비교표 → **W6.3** 세션메모리 재방문 인사 → **W6.5** 해결률 대시보드 → **W6.6** 날씨 즉답(`lib/weather/tour-weather-anchor` 재활용) → **W6.7** 해녀쇼 상태. **W6.4(예약변경 접수)는 G-5 사용자 범위 승인 필요.** W6.8~6.11은 별도 트랙 규모.

## §4 규칙 (변경 없음)
1. 골든 배터리 그린 = 배치 종료 조건. 라이브 테스트 부산물은 반드시 정리(자동 cleanup이 기본, 실패 시 §2 SQL).
2. 가격·가용성·예약은 결정론 엔진, 모델은 말투만 (§A). 쓰기(취소/변경/환불)는 관리자 승인 게이트.
3. 빌드+골든 그린이면 커밋/PR/머지 자율. 커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만(모델 식별자 금지).
4. 진행 보고 한국어, 코드/커밋 영어. 각 배치 완료 시 플랜 §D 진행 로그 + 티켓 ✅ 마커 + 메모리 갱신.
5. 배포 후 프로덕션 골든 `--writes` 재실행으로 최종 확인.

## §5 주요 파일 지도
- 라우트: `app/api/tour-product/assistant/route.ts` (게이트 순서: 핸드오프→예약조회→법률→견적(sticky)→일반 LLM; systemInstruction은 정적부-선두 유지 — 동적 라인은 "Dynamic per-turn block" 주석 아래에만 추가할 것)
- 위젯: `components/product-tour-static/_shared/TourProductAiAssistantWidget.tsx` + 마크다운 렌더 `chatMarkdown.tsx`
- 견적: `lib/chatbot/quoteFlow.ts` (stickiness 마커·날짜/이메일 검증·크루즈포트·멱등성)
- 인텐트: `lib/chatbot/queryIntent.ts` (11종 — price_question 포함) · 에스컬레이션: `lib/support/escalation.ts` (인텐트 인지형+컴플레인)
- 텔레메트리/폴백: `lib/chatbot/chatTelemetry.ts` · 로거(PII마스킹): `lib/support/chat-logger.ts`
- RAG: `lib/rag/reindex.ts`(일일 cron)+`lib/rag/harvest.ts`(주간 cron)+`lib/rag/embedCache.ts`
- 골든: `scripts/chatbot-golden-test.mjs` (expectFail 태깅 지원 — 신규 웨이브 착수 시 red 케이스를 미리 넣고 태그로 관리)
