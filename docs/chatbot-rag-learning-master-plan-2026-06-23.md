# 챗봇 업그레이드 마스터 플랜 — RAG + 자동 학습 루프

작성: 2026-06-23 · 브랜치: `feat/chatbot-rag-learning` (worktree 격리)

## 목표
1. 사이트의 모든 콘텐츠(POI KB·투어상품·사이트지식·정책·승인 Q&A)를 챗봇이 의미 기반으로 끌어다 쓰는 **RAG**.
2. 문답 내용을 **자동 수집·분석·학습**하는 루프 — 시간이 지날수록 똑똑해짐.

## 확정 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 임베딩 | OpenAI `text-embedding-3-small` (1536) | 기존 `embedding vector(1536)` 컬럼과 정확히 일치, 스키마 변경 0. 키 검증 완료(2026-06-23). |
| 답변 모델 | Gemini 2.5 Flash 유지 | 잘 도는 파이프라인 블라스트 반경 최소화. |
| 검색 | 하이브리드(벡터 + 키워드 RRF 융합) | 기존 키워드 스코어러를 폴백으로 보존, 키/임베딩 없을 때 graceful degrade. |
| 학습 범위 | 자동 Q&A 수집 + 피드백 신호 + 분석 대시보드 | 파인튜닝은 제외(RAG로 충분). |

## 현황 토대 (이미 존재)
- 챗봇 UI: `components/product-tour-static/_shared/TourProductAiAssistantWidget.tsx` (+ `GlobalAiAssistant`)
- 백엔드: `app/api/tour-product/assistant/route.ts` (Gemini), `.../live` (라이브챗)
- 컨텍스트: `lib/chatbot/{queryIntent,tourCatalogKnowledge,siteKnowledge,qaKnowledge}.ts` — **100% 키워드**
- 로깅/에스컬레이션/핸드오프: `lib/support/*`, `chat_sessions`(682)/`chat_messages`(1378, user 689)/`support_tickets`(57)
- 학습 스키마(미사용): `qa_pairs`(0건), `embedding vector(1536)` 전부 NULL
- 인프라: pgvector 0.8, pg_cron, pg_net, pgmq

## Phase 0 — 토대 ✅ 진행 중
- `OPENAI_API_KEY` 로컬+Vercel 주입·검증 완료
- 마이그레이션 `knowledge_chunks` 테이블 + `match_knowledge_chunks` RPC + HNSW/GIN/trgm 인덱스

## Phase 1 — RAG (핵심)
- `lib/rag/embed.ts` — OpenAI 임베딩 배치 클라이언트(재시도/백오프)
- `scripts/build-knowledge-index.mjs` — 소스 어댑터(POI·투어·사이트·정책) → 청크 → 임베딩 → upsert, `content_hash` 증분
- `lib/rag/retrieve.ts` — 쿼리 임베딩 → 벡터+키워드 병렬 → RRF 융합 + source_type 다양성 캡 + locale 우선 → 인용 URL 포함 컨텍스트
- `app/api/tour-product/assistant/route.ts` 에 `buildRagContext()` 주입 (키워드 폴백 보존, 플래그 가드)

## Phase 2 — 자동 Q&A 수집 루프 ✅
- `lib/rag/qa-index.ts`: 승인 → `knowledge_chunks(source_type=qa)` 임베딩, 반려/비활성 → 제거. PATCH `/api/admin/qa-pairs/[id]`에 연결(비치명적).
- `scripts/harvest-qa-candidates.ts`(`npm run rag:harvest`): confident·non-escalated AI턴 → Gemini 재사용성 판정 → PII 새니타이즈 + 중복제거 → draft. 티켓 경로는 기존 `createQaDraftFromSupportReply`.
- 리뷰 UI는 기존 `/admin/qa-review` 사용. 검증: 409 후보, 승인→임베딩→검색(sim 0.84)→제거 확인.

## Phase 3 — 피드백 신호 ✅
- `chat_feedback` 테이블 + `POST /api/tour-product/assistant/feedback`(쿠키 스코프, locale 추론)
- 위젯 답변별 👍/👎(메시지당 1표, 6개 언어 라벨)
- 하베스트가 👎 답변 제외 + 👍 답변 우선

## Phase 4 — 분석 대시보드 ✅
- `/admin/chatbot-analytics` + `GET /api/admin/chatbot-analytics`: 볼륨·에스컬레이션율·도움률·카테고리분포·Q&A파이프라인·RAG인덱스(타입별 count, 1000행 캡 회피)
- 커버리지 갭(👎/에스컬레이션 질문) → 원클릭 "Q&A 초안 만들기"
- 어드민 사이드바 "챗봇 분석" 링크 추가

## 운영 (스케줄링)
- **실시간**: Q&A 승인 시 자동 임베딩(루프 핵심) — cron 불필요.
- **콘텐츠 변경 시**: `npm run rag:index` (content_hash 증분, 변경분만 재임베딩).
- **주기적 학습**: `npm run rag:harvest` (예: 주 1회) — 신규 대화에서 Q&A 초안 수확.
- pg_cron은 OpenAI/Node 호출 불가 → 위 스크립트를 CI/Vercel Cron/수동으로 운영(자동화는 선택, 미구현).
- **활성화**: Vercel `OPENAI_API_KEY`(완료) + RAG 기본 ON, `CHAT_RAG=0`이 킬스위치.

## 원칙
- 각 Phase 독립 출시(빌드 그린 + 테스트). main 경합 회피 위해 worktree에서 작업.
- 콘텐츠 추가-온리(메모리: 투어 카피 보존). PII 새니타이즈 필수.
- 다국어(en/ko/ja/zh/zh-TW/es) locale별 임베딩·우선.
