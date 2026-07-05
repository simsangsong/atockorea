# 챗봇 주간 운영 런북 (W5.4, 2026-07-04)

> 갭 발견 → Q&A 초안 → 승인 → 색인이 도는 학습 루프의 **사람 쪽 절차** 1페이지.
> 자동화는 이미 배포돼 있음 — 여기 있는 건 주 15분짜리 확인 리듬이다.

## 자동으로 도는 것 (건드릴 필요 없음)
| 시각 (UTC) | 무엇 | 어디 |
|---|---|---|
| 매일 16:30 | RAG 재색인 (활성 투어·정책·승인 Q&A만) | `/api/cron/rag-reindex` |
| 매주 월 15:30 | 커버리지 갭 하베스트 → qa_pairs 초안 생성 + Telegram 알림 | `/api/cron/rag-harvest` |
| 상시 | 👍👎 피드백 수집 (`chat_feedback`, 👎는 사유 칩 포함) | 위젯 |
| 상시 | 실패 로깅 `[error:<code>]` + 토큰·비용 텔레메트리 | `chat_messages` |

## 주간 리듬 (월요일 Telegram 알림 후, ~15분)
1. **초안 승인** — Telegram 링크 → `/admin/qa-review`에서 신규 qa_pairs 초안 검토.
   - 사실이 맞고 말투만 다듬으면 되는 것 → 수정 후 **승인**.
   - 가격·정책이 애매한 것 → **반려** (잘못된 지식이 색인되는 것이 무답변보다 나쁨).
   - 승인분은 다음 날 16:30 재색인에서 자동 반영 — 별도 조치 불요.
2. **품질 신호 확인** — `/admin/chatbot-analytics`:
   - 24h 실패율 타일 (평시 ~0%; 튀면 `[error:` 코드 확인 — `quota`면 AI Studio 지출캡부터).
   - 👎 사유 분포 (`chat_feedback.reason`: inaccurate/unanswered/confusing) — `unanswered` 반복 주제는 다음 하베스트를 기다리지 말고 바로 Q&A 초안 작성.
   - 기간 비용 카드 (평시 월 ₩수백 수준; 캡 ₩30,000).
3. **분기별 1회** — 골든 배터리로 회귀 확인:
   ```
   npm run chatbot:golden -- --writes
   ```
   (예약·티켓 부산물은 자동 정리. GATE: GREEN이면 끝.)

## 투어 가격/활성상태를 바꿨을 때
- 정적 JSON 반영 후 **다음 날 재색인이 자동으로 집음**. 급하면 수동:
  `npm run rag:index` (로컬, `.env.local` 필요).
- 검증은 골든 `catalog-freshness` 스위트가 함 (비활성 슬러그 미등장 + 가격 일치).

## 장애 시 1분 진단
1. 위젯이 죽었다 → `/admin/chatbot-analytics` 실패율 타일 → `[error:quota]`면 [AI Studio usage](https://aistudio.google.com/usage) 지출캡 확인 (2026-07-04 전면 다운의 원인이 이것).
2. 답변이 이상하다(옛 투어/옛 가격) → 마지막 재색인 성공 여부 (`knowledge_chunks` updated_at) → 수동 `rag:index`.
3. Telegram 알림이 안 온다 → `telegram_webhook_log` 최근 행의 response_status (4096자 초과는 자동 축약되므로 400이면 다른 원인).
