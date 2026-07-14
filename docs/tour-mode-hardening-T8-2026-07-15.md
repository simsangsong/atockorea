# 투어모드 T8.1 하드닝 스윕 — 2026-07-15

코드 트랙(T0~T7) 완료 시점의 하드닝 점검. **잔여 사람 게이트:** ① §I-4 실기기 리허설(음성·지오펜스·다크모드 메일 렌더) ② 파일럿 스팟 좌표 검수(`docs/tour-mode-pilot-spot-checklist-2026-07-14.md`) ③ 파일럿 런칭 결정(플래그 ON).

## 1. §O 애드엔덤 전 항목 재점검

| 항목 | 상태 | 근거 |
|---|---|---|
| O-1 다이렉트 진입 8원칙 | ✅ ①~⑧ 전부 | ⑧ 취소 revoke는 T5.1 훅(양 취소 경로), QR은 dispatch 메일 |
| O-2 TTS 3단 래더 | ✅ | `lib/tour-room/tts.ts` + 유닛(빈 voices/타로케일→server) + 선생성 |
| O-3 가이드 tour-date 스코프 | ✅ | token/broadcast/overview/captions 전부 이 스코프 판정(교차일 403 테스트) |
| O-4 device_key UNIQUE | ✅ | M-1 라이브 적용 |
| O-5 핑 15s/리밋 6/스냅샷 30s | ✅ | useGeoWatcher 15s·location API 6/min·30s 스로틀(테스트) |
| O-6 dedupe+visibility 재동기화 | ✅ | useTourRoomChannel(id dedupe, after 커서) |
| O-7 HTTP Broadcast 송출 | ✅ | `lib/tour-room/realtime.ts` |
| O-8 지오펜스 최근접+수동 이중경로 | ✅/부분 | 최근접+120s 쿨다운 유닛 완료; 수동 트리거(손님 버튼·가이드 콘솔)는 §H 백로그로 이월(위치권한 0% 그룹 대비) |
| O-9 MediaRecorder 미지원 | ✅ | 🎤 자동 미노출, 에러 다이얼로그 없음 |
| O-10 Realtime 쿼터 | ✅ 산정표 §2 | |
| O-11 SSE 서버리스 한계 | ✅ | events 라우트 기존 구현(55s 주기+after 커서) |
| O-12 일일 AI 예산 가드 | 🟡 부분 | 경로별 레이트리밋(§3)으로 상한 확보; µ$ 가중 적산 카운터는 §H 이월(파일럿 메트릭 후 튜닝) |
| O-13 시크릿 로테이션 | ✅ | 듀얼 검증 + ⚠런칭 전 `TOUR_ROOM_TOKEN_SECRET` env 설정 필수(현재 미설정 = dev fallback) |
| O-14 LLM 세이프티 거부 | ✅ | 라우터 데모션 + 원문 게시(R-6) 캡션/메시지 모두 테스트 |

## 2. Realtime 동시접속 산정표 (§O-10)

가정: 룸 = booking당 1, 참가자 손님 1~2기기+가이드+관제.

| 시나리오 | 웹소켓 연결 | 채널 구독 | 비고 |
|---|---|---|---|
| 파일럿(투어 1, 예약 8) | ~10 | 룸 8 + presence + 관제 postgres-changes 1 | 여유 큼 |
| 일상(동시 투어 3, 예약 24) | ~30 | ~27 | |
| 피크(동시 투어 10, 예약 80, 손님 120명) | ~125 | ~90 | Supabase Pro 동시연결 기본 500 대비 25% |
| 부하 리뷰(룸 30×10명) | ~300 | ~35(기기당 1채널) | 연결 300/500 = 60% — 파일럿 범위 밖, 스케일 시 플랜 확인 |

메시지량: 가이드 자막 최악 20청크/분×번역 1콜 = 라우터 3s 타임아웃 내; broadcast HTTP 송출은 룸당 1 REST 콜(팬아웃 N룸 = N콜, 30룸도 초 단위).

## 3. 레이트리밋 튜닝 표 (현행)

| 네임스페이스 | 키 | 분당/시간당 | 근거 |
|---|---|---|---|
| tour_room_guest | IP | 15/60 | 기존 PA-4 |
| tour_room_stt | IP | 10/120 | 60s 녹음×연타 방지 |
| tour_room_tts | room | 6/60 (생성만) | 캐시 히트 무제한 |
| tour_room_captions | room | 30/900 | 3~8s 청크≈8~20/분+오버랩 |
| tour_room_location | participant | 6/360 | §O-5 |
| tour_room_vision | participant | 3/10(시간당)≈10/일 | T4.7 AC |
| tour_room_vision_room | booking | 6/30 | 룸 폭주 방지 |
| tour_room_broadcast | tour+date | 12/240 | 가이드 공지 |
| tour_room_sos | participant | 2/10 | 실수 연타만 차단 |

## 4. get_advisors 최종 (2026-07-15)

security: **투어모드 신규 경고 0** — 목록 전부 기존 베이스라인(agent_*, chat_*, 확장 위치, 버킷 리스팅 등). `tour_rooms`/`tour_room_spot_events`의 RLS-no-policy INFO는 의도(서비스롤 전용, M-6 주석). performance: T0.3 당시 created_by 인덱스 즉시 해소, 신규 항목 없음.

## 5. 런칭 전 env 체크리스트 (T8.2 착수 조건)

- [ ] `TOUR_ROOM_TOKEN_SECRET` 프로덕션 설정(현재 dev fallback — 설정 시 기존 시크릿을 `_PREV`로)
- [ ] `NEXT_PUBLIC_TOUR_MODE_V1=1` (파일럿 시점에)
- [ ] `NEXT_PUBLIC_TOUR_OPS_PHONE` 운영센터 번호
- [ ] `ADMIN_BOOKING_NOTIFICATION_EMAILS` SOS 수신자 확인
- [ ] Vercel cron이 reminders 엔드포인트를 실제로 치는지(D-1 자동 발송 경로) + CRON_SECRET
- [ ] 파일럿 메트릭 쿼리(§6)를 /admin/analytics에 등록할지 결정

## 6. 파일럿 메트릭 쿼리 (T8.2 대시보드용)

```sql
-- 입장률: 발송 invite 대비 참가자 등록
SELECT count(DISTINCT i.booking_id) AS invited,
       count(DISTINCT p.booking_id) AS joined
FROM tour_room_invites i
LEFT JOIN tour_room_participants p ON p.booking_id = i.booking_id
WHERE i.role='customer' AND i.created_at > now() - interval '7 days';

-- 메시지량/일·역할별
SELECT date_trunc('day', created_at) AS d, sender_role, count(*)
FROM tour_room_messages GROUP BY 1,2 ORDER BY 1 DESC;

-- STT 실패율(확인 강제 비율)
SELECT count(*) FILTER (WHERE metadata->'stt'->>'fallback_used'='true')::float / NULLIF(count(*),0) AS stt_fallback_rate
FROM tour_room_messages WHERE input_kind='audio' AND created_at > now() - interval '7 days';

-- 번역 지연 p95는 [captions] 서버 로그(ms=)로 산출 (Vercel logs)
```
