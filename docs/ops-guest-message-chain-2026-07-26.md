# 손님 체인 전수 감사 — 파싱부터 세무서식까지 (2026-07-26)

> **이 표의 목적은 하나다: 다음 사람이 "이미 있는 것"을 다시 만들지 않게 하는 것.**
> 각 칸이 어느 파일·라우트·테이블에 있는지 1:1로 적는다. 없는 것은 없다고 적는다.
>
> 관련: 실행 플랜 `docs/ops-center-settlement-upgrade-plan-2026-07-25.md`
> · 복구 인수인계 `docs/NEXT-SESSION-SMARTGUIDE-RECOVERY-2026-07-25.md`

## 0. 한눈에

```
OTA 메일 ─▶ 파싱 ─▶ 예약 ─▶ 투어룸 ─▶ 명단 ─▶ 손님 안내 ─┐
  ✅        ✅      ✅      ✅       ✅       ✅        │
                                                       ▼
                    세무서식 ◀─ 월말정산 ◀─ 일괄 worked ◀─ 가이드 배정
                      ✅          ✅          ✅            ✅
                                              (단가 반영 ✅)
```
**전 구간 구현 완료.** 사람이 해야 하는 것은 셋뿐이다(§4).

---

## 1. 손님 쪽 체인

| # | 단계 | 어디에 있나 | 상태 |
|---|---|---|---|
| 1 | OTA 메일 수신 | `app/api/inbound/**` · `received_emails` | ✅ |
| 2 | 파싱 (L0 캐시→L4) | `lib/ops/parse/**` · `ops_parse_cache` `ops_parse_rules` `ops_parse_failures` | ✅ |
| 3 | 파싱 검토 큐 | `OpsReviewQueueView` · `/api/admin/tour-ops/inbox-review` · `ops_email_parse_logs` | ✅ |
| 4 | 예약 생성 | `bookings` (+`external_booking_id` 멱등) | ✅ |
| 5 | 투어룸 생성 | `ensureRoom()` · `OpsRoomManager` · `/api/admin/tour-ops/rooms` | ✅ |
| 6 | **투어룸 월간 내역** | `OpsRoomHistoryView` · `/rooms/monthly` (+엑셀) | ✅ **W3 신규** |
| 7 | 고객 명단 | `OpsManifestView` · `/manifest` · `lib/ops/manifest/group.ts` (픽업지 그룹) | ✅ |
| 8 | 개인 토큰 링크 | `/api/admin/tour-ops/links` · `signCustomerRoomToken` · `tour_room_invites` | ✅ |
| 9 | **왓츠앱 순차 발송** | `OpsManifestView` — 프리셋 → wa.me 새 탭 + opened 로그 → [발송 완료] → **[다음 열기 (N번째)]** | ✅ 기존 |
| 10 | **이메일 원버튼 일괄** | `/manifest/bulk-message` (GET 미리보기 / POST 발송) · `OpsGuestMessagingView` | ✅ **M3 신규** |
| 11 | **날씨·착장 자동 삽입** | `lib/ops/weather/forecast.ts` (Open-Meteo) · `ops_weather_cache` · 토큰 `{weather}` `{clothing}` | ✅ **M1 신규** |
| 12 | **투어별 문구** | `ops_tour_message_templates` · `loadTemplate()` (투어→전역→코드) | ✅ **M2 신규** |
| 13 | 발송 기록 | `ops_whatsapp_send_logs` (+`channel` `subject` `status` `error`) | ✅ M3 확장 |
| 14 | 룸 초대 메일(고정 문구) | `/manifest/bulk-invite` | ✅ 기존 |

### 손님 안내에서 지킨 규칙

- **예보 없으면 그 줄을 뺀다.** `날씨: ` 로 끝나는 문장이 나가면 손님은 우리가
  빠뜨렸다고 읽고, 지어낸 날씨는 손님의 옷차림을 틀리게 만든다.
- **미리보기에서 본 그대로 나간다.** POST는 화면이 확정한 본문을 받는다 —
  서버가 템플릿을 다시 읽으면 운영자가 고친 문구가 사라진다.
- **못 보낸 사람을 조용히 빼지 않는다.** 주소 없음 / 링크 미발급을 사유와 함께
  목록으로 돌려준다. 20명 중 17명에게 갔다는 사실을 화면이 말해야 나머지를 처리한다.
- **왓츠앱은 사람이 탭한다.** Business API 자동 발송은 금지(v1.2 §4.4).
  이메일만 서버가 실제로 보낸다. 화면이 그 차이를 숨기지 않는다.

---

## 2. 가이드 · 정산 체인

| # | 단계 | 어디에 있나 | 상태 |
|---|---|---|---|
| 1 | 가이드 원장 | `ops_guides` (PII는 AES-256-GCM 봉투) | ✅ |
| 2 | 단가 설정 | `ops_guide_rates` (이력형) · `GuideRatesPanel` · `resolveRate` | ✅ |
| 3 | 휴무 달력 | `ops_guide_unavailable_dates` · `GuideRestCalendar` | ✅ |
| 4 | **차량 마스터** | `ops_vehicles` · `/api/admin/ops-vehicles` · 차량 탭 | ✅ **W1 신규** |
| 5 | 배정 | `ops_guide_assignments` · `/api/admin/guides/assignments` | ✅ |
| 6 | **배정 충돌 차단** | `lib/ops/guides/conflicts.ts` + DB 트리거 `ops_guide_assignment_conflict_guard` | ✅ **W2 신규** |
| 7 | **단가 미설정 경고** | 충돌 규칙 7 — **배정 시점에** 경고 | ✅ **W2 신규** |
| 8 | **근무·배차 달력** | `OpsScheduleCalendar` (한 컴포넌트 두 축) · `/tour-ops/schedule` (+엑셀) | ✅ **W4 신규** |
| 9 | **일괄 worked** | `/api/admin/guides/assignments/bulk` · 체크박스 + [예정 N건 선택] | ✅ **W7 신규** |
| 10 | 월말 정산 배치 | `runGuideSettlement()` — worked 집계 → 3.3% → `ops_guide_settlements` upsert(멱등) | ✅ |
| 11 | 원장 기입 | `ops_entity_ledger` (external_ref 멱등) | ✅ |
| 12 | 원천징수 3.3% | `lib/ops/tax/withholding.ts` (kursoflow 산식 1:1, 절사 지점 동일) | ✅ |
| 13 | 세무 서식 4종 | `lib/ops/tax/forms.ts` — 이행상황신고서·간이지급명세서·원천징수영수증·연간지급명세서 | ✅ |
| 14 | **엑셀 출력** | `lib/ops/export/xlsx.ts` (의존성 0) — 서식 4종 + 지급명세 + 달력 + 룸내역 | ✅ **W6 신규** |
| 15 | **가이드별 영수증** | `?guideId=` — 교부용 1인분 | ✅ **W7 신규** |
| 16 | **오토파일럿 점검** | `ops_autopilot_suggestions` — 미배정·미배차·정원부족·단가누락·미정산·**안내 미발송** | ✅ **W5 신규** |

### 정산에서 지킨 규칙

- **[일했음]을 눌러야 돈이 된다.** planned는 정산 대상이 아니다. 그 버튼이 한
  건씩만 눌리던 것이 정산이 비는 최대 원인이었고, W7이 그것을 고쳤다.
- **단가 미설정 ≠ 무보수.** 못 찾으면 0원으로 때우지 않고 unresolved로 보고한다.
- **실비변상은 원천징수 대상이 아니다.** gross에 섞지 않고 payout에만 더한다.
- **paid 정산은 금액이 다시 쓰이지 않는다.** 지급 증빙과 장부가 어긋나면 끝이다.
- 🔴 **제출·이체·자동발송은 어디에도 없다(D10).** 서식은 생성·검증·보관까지고,
  'paid'는 사후 기록이다.

---

## 3. 관제센터 진입 동선 (버튼이 어디 있나)

`/admin/tour-ops` 홈 타일 — 매일 하는 일이 한 화면에 있다.

| 타일 | 여는 것 |
|---|---|
| 룸 · 링크 만들기 | 룸 생성 · 개인/가이드 링크 · QR · 초대 메일 |
| 실시간 모니터링 | 룸 피드 · 응대 큐 |
| 메시지 모아보기 | 전 룸 타임라인 |
| 인박스 리뷰 큐 | OTA 파싱 검토 · 승인 커밋 |
| **손님 안내 보내기** | 날짜 → 투어 → **이메일 일괄 / 왓츠앱 순차** (날씨 자동) |
| **오토파일럿** | 미배정·미배차·정원·단가·정산·**안내 미발송** 제안 |
| **투어룸 생성 내역** | 월 범위 · 미입장 방 찾기 · 엑셀 |
| **가이드 · 차량 달력** | 월 매트릭스 · 충돌 · 휴무 · 엑셀 |
| 위치 보기 / 문답 학습 / 챗봇 분석 / 지금 보고서 발송 | 기존 |

어드민 사이드바는 23개 평면 → **6그룹**(기본 노출 11). 기능 삭제 0.

---

## 4. 사람이 해야 하는 것 (코드로 못 닫는 것)

1. **`OPS_GUIDE_PII_ENC_KEY` 설정** — 없으면 주민번호·계좌 저장이 거부된다
   (fail-closed, 의도된 동작). 라이브 암호화 데이터 0건이라 지금 넣는 것은 안전하고,
   **한 번 넣은 뒤에는 절대 교체 금지**(기존 봉투가 전부 복호화 불능이 된다).
2. **실기기 리허설** — 마이크(자막방송)·TTS 실제 재생·푸시 실제 도착·GPS 권한 거부.
   시뮬레이터가 재현하지 못한다. prod에 `OPENAI_API_KEY` + `tour-audio` 버킷
   (마이그레이션이 만들지 않는다 — 수동 생성) 필요.
3. **세무 서식 CPA 검수** — `ops_finance_config.expert_reviewed=false` 인 동안
   모든 산출물에 DRAFT가 찍힌다. 검수 후 사람이 그 값을 바꾼다.

## 5. 다시 만들지 말 것 (이미 있다)

- 왓츠앱 순차 발송 · 개인 토큰 링크 · 명단 픽업 그룹핑
- 3.3% 원천징수 산식 · 세무 서식 4종 · 월 정산 멱등 배치 · 원장 기입
- `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인**이다.
  관제 오토파일럿(`lib/ops/autopilot/**`)과 무관하다.
