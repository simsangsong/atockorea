# 수신 메일 유실 감사 (2026-07-25)

## 요약

Resend 인바운드 웹훅이 **apex 도메인**(`https://atockorea.com/api/webhooks/resend`)을
가리키고 있었다. apex는 `www`로 **307 리다이렉트**되고 Resend/svix는 리다이렉트를
따라가지 않고 실패로 기록한다. 결과: 수신 메일이 라우트에 한 번도 닿지 못했다.

- Resend 수신 로그: **34건** (2025-12-08 ~ 2026-07-24)
- `received_emails` 테이블: **3건** — 전부 테스트 스크립트가 넣은 합성 행
  (`codex-inbound-…`, `resend-inbound-codex-…`). **실제 수신 메일이 저장된 적은 없다.**

웹훅 URL은 `https://www.atockorea.com/...`으로 교정 완료(2026-07-25).

## 백필하지 않기로 한 근거

유실분 34건의 실제 구성:

| 분류 | 건수 | 내용 |
|---|---|---|
| 자체 알림 루프백 | 15 | `🆕 새 예약 접수` ×11, `🆘 SOS` ×2, `[ADMIN]/[AtoC Korea] New booking confirmed` ×2 |
| 스팸/피싱 | 6 | MetaMask 사칭 피싱 ×2, ChooseMylo 보험 스팸 ×3, 웹 리디자인 영업 ×1 |
| 본인/개발 테스트 | 9 | `123`, `111`, `fsdf`, `sadf`, `aaa`, `ㅣㅣ`, `shdbx`, `test simsangsong` 등 |
| 외부 발신(아래 참조) | 2 | 대량 B2B 영업 메일 |
| support 대상 아님 | 2 | `simsangsong@atockorea.com`(구글 워크스페이스 안내), `test@atockorea.com` |

**복구할 실제 고객 문의: 0건.** 그래서 백필은 실행하지 않았다.
스크립트(`scripts/backfill-received-emails.ts`)는 남겨둔다 — 멱등이므로
필요해지면 `npm run inbox:backfill:dry`로 먼저 확인 후 실행하면 된다.

## 외부 발신 2건 (기록용, 대응 불필요)

동일 본문의 대량 아웃바운드이며 발신 계정만 다르다. 고객 문의가 아니다.

| 수신시각 (UTC) | 발신 | 제목 |
|---|---|---|
| 2026-05-20 13:09:40 | `muteterialice48@gmail.com` | Request for Partnership in visiting Rwanda via Gama Travel and Tour Agency |
| 2026-05-20 12:39:19 | `tumukundefelix9@gmail.com` | (동일) |

내용: Gama Travel & Tour Agency(르완다·우간다) B2B 제휴 제안. Lake Kivu 2일,
Akagera 국립공원 사파리 2일, Nyandungu 에코파크 1일, 르완다 야생동물 5일 등
자사 상품 링크(gamatour.agency) 나열 후 제휴 요청. 수신 주소는 `to`와 `bcc`에
모두 `support@atockorea.com` — 대량 발송의 전형.

## 함께 고친 것

1. **bcc 누락** — support 라우트가 `to`/`to_email`/`recipients`/`headers.to`만 보고
   `bcc`를 안 봤다. Resend는 헤더에 없는 봉투 수신자를 `bcc`에 싣는다(위 2건도
   `bcc`에 들어 있었다). 수신자 판독을 `lib/email/inbound-recipients.ts` 단일
   구현으로 통합 — OTA 파서 게이트와 공유한다.

2. **자체 알림 루프백** — `ADMIN_BOOKING_NOTIFICATION_EMAILS`에
   `support@atockorea.com`이 있고 support@는 인바운드 catch-all이라, 우리가 보낸
   예약/SOS 알림이 그대로 되돌아온다(유실분 34건 중 15건). 웹훅이 죽어 있던
   동안은 무해했지만 URL을 고친 뒤로는 **예약마다 가짜 "새 고객 문의"가 쌓인다.**
   `support@`/`noreply@`/`alerts@` 발신은 `received_emails`에
   `category='self_notification'`으로 기록만 하고 `contact_inquiries`는 만들지
   않도록 차단. 재정의는 `SUPPORT_SELF_SEND_ADDRESSES`.

## 재발 방지 메모

- **웹훅 URL은 반드시 `www` 정규 호스트.** apex는 307이고 Resend는 안 따라간다.
- 웹훅을 추가하면 **서명 시크릿이 엔드포인트마다 다르다.** support는
  `RESEND_WEBHOOK_SECRET`, OTA 파서는 `OPS_INBOUND_WEBHOOK_SECRET`.
- `RESEND_API_KEY`는 **Full access**여야 한다. 웹훅 페이로드에 본문이 없어
  Received API로 fetch하는데, send-only 제한 키는 여기서 401이 난다.
