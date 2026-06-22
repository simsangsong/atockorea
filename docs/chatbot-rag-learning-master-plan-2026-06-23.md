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

## Phase 2 — 자동 Q&A 수집 루프
- 기존 `createQaDraftFromSupportReply`(티켓) + AI대화 자동 추출 배치(Gemini 판정, `sanitizeQaText` PII, 임베딩 유사도 중복제거)
- `/admin/qa-review` 리뷰 UI 강화(편집/승인/반려/일괄)
- 승인 → `knowledge_chunks(source_type=qa)` 자동 임베딩 = 루프 닫힘

## Phase 3 — 피드백 신호
- 위젯 답변별 👍/👎 + 종료 설문
- `chat_feedback` 테이블 + `POST .../assistant/feedback`
- 긍정 Q&A 랭킹 부스트 / 부정·저신뢰 = 커버리지 갭 플래그

## Phase 4 — 분석 대시보드
- `/admin/chatbot-analytics`: 볼륨·에스컬레이션율·핸드오프율·의도분포
- 커버리지 갭 클러스터(저신뢰+부정+에스컬레이션) → 원클릭 Q&A 초안
- Q&A 건강도, 피드백 도움률, RAG 적중률(min_sim 이상 검색 여부)
- pg_cron 정기 집계 + 인덱스 재빌드

## 원칙
- 각 Phase 독립 출시(빌드 그린 + 테스트). main 경합 회피 위해 worktree에서 작업.
- 콘텐츠 추가-온리(메모리: 투어 카피 보존). PII 새니타이즈 필수.
- 다국어(en/ko/ja/zh/zh-TW/es) locale별 임베딩·우선.
