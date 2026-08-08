# Cloudflare 이사 — 사장님 수동 준비 체크리스트 (인쇄용)

작성 2026-08-08. **이 9단계만 끝나면 이후 전 과정(코드·배포·DNS 대조·env 주입)은 Claude 가 대행합니다.**
기술 배경 문서는 `docs/vercel-to-cloudflare-migration-master-plan-2026-08-08.md` (§C-1 이 이 문서의 원본).

---

## STEP 0 — 준비물 (5분)
- [ ] `simsangsong@gmail.com` 메일함 로그인 가능
- [ ] 결제 카드 (월 $5 + 이미지 변환 약 $3~8 예상 — 지금 Vercel 추정 $20+ 보다 저렴)
- [ ] GitHub(simsangsong) 로그인 가능
- [ ] Namecheap 로그인 가능
- [ ] 비밀번호 관리자 (복구코드·새 키 백업 보관용)

## STEP 1 — Cloudflare 계정 생성 (5분)
- [ ] https://dash.cloudflare.com/sign-up 접속
- [ ] 이메일: 🔴 **반드시 사장님 본인 메일** (`simsangsong@gmail.com` 권장)
      — Vercel 때처럼 계정이 흩어지는 사고 방지. 이 계정이 인프라 소유주가 됩니다.
- [ ] 새 강한 비밀번호 → 가입 → 인증 메일 클릭

## STEP 2 — 2단계 인증 (3분)
- [ ] 우상단 사람 아이콘 → **My Profile** → **Authentication**
- [ ] Two-Factor Authentication 켜기 (인증앱으로 QR 스캔)
- [ ] **복구 코드를 비밀번호 관리자에 저장**

## STEP 3 — Workers 유료 플랜 + 카드 (3분)
- [ ] 좌측 메뉴 **Workers & Pages** → **Plans**
- [ ] **Workers Paid ($5/월)** 구독 + 카드 등록
- 이유: 무료판은 앱 크기 3MB·CPU 10ms 제한이라 우리 앱이 못 올라감

## STEP 4 — 사이트 추가 (3분) — 🔴 네임서버 변경은 절대 아직 아님
- [ ] 대시보드 홈 → **+ Add a site** → `atockorea.com` 입력
- [ ] 플랜은 **Free** 선택 → Continue
- [ ] 마지막 화면에서 "네임서버를 바꾸라"며 주소 2개(`xxx.ns.cloudflare.com` 꼴)를 보여줌
      → [ ] **그 화면 스크린샷** → 창 닫기
- 🔴 이 단계는 "등록만" 하는 것. **Namecheap 은 오늘 건드리지 않는다**

## STEP 5 — API 토큰 생성 (10분, 제일 중요)
- [ ] My Profile → **API Tokens** → **Create Token** → 맨 아래 **Custom token** → Get started
- [ ] Token name: `claude-migration`
- [ ] Permissions — 아래 표대로 행 추가 (목록에 없는 이름은 건너뛰고 Claude 에게 보고):

| 분류 | 항목 | 권한 |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | Workers R2 Storage | Edit |
| Account | D1 | Edit |
| Account | Cloudflare Images | Edit |
| Account | Workers Builds Configuration | Edit |
| Account | Workers Tail | Read |
| Account | Account Settings | Read |
| Zone | Zone | Edit |
| Zone | DNS | Edit |
| Zone | Zone Settings | Edit |
| Zone | Dynamic Redirect | Edit |
| Zone | Cache Rules | Edit |
| Zone | Firewall Services | Edit |

- [ ] Account Resources: Include → 사장님 계정
- [ ] Zone Resources: Include → **All zones from an account** → 사장님 계정
- [ ] TTL(만료): 비워두거나 6개월
- [ ] Continue to summary → **Create Token** → 화면에 **딱 한 번** 보이는 토큰 복사
- [ ] 전달 방법: 🔴 **채팅에 붙여넣지 말 것.** 메모장으로
      `C:\Users\sangsong\atockorea\.env.local` 열어 맨 아래에
      `CLOUDFLARE_API_TOKEN=붙여넣은값` 한 줄 추가 후 저장 (git 에 안 올라가는 파일)

## STEP 6 — GitHub 앱 설치 (5분)
- [ ] Workers & Pages → Create → **Import a repository** → Connect GitHub
- [ ] GitHub 로그인 → **Only select repositories** → `atockorea` 만 선택 → Install
- 워커 생성 화면까지는 안 가도 됨 — 연결은 Claude 가 함

## STEP 7 — Vercel: 보기만, 변경·삭제 절대 금지 (5분)
- [ ] Settings → **Billing**(플랜 표시) 화면 스크린샷 1장
- [ ] (지난번 env 목록 스크린샷의 첫 장 위쪽이 잘렸으면) 맨 위부터 1장 추가
- 🔴 하지 말 것: env 삭제/수정 × · 도메인 제거 × · 프로젝트 삭제 ×
      (전환 후 2~4주간 롤백 보험) · `vercel env pull` 명령 금지

## STEP 8 — Namecheap: 확인만 (10분)
- [ ] Domain List → `atockorea.com` → MANAGE
- [ ] ① **만료일** 확인 — 1년 미만이면 지금 갱신 권장 (이사 도중 만료가 최악)
- [ ] ② **Advanced DNS 탭**: 레코드 전체가 보이게 스크롤하며 **스크린샷 여러 장**
      (이관 때 1:1 대조할 정본 — 특히 MX·TXT 가 메일 생명줄)
- [ ] ③ **DNSSEC** 항목이 있으면 ON/OFF 상태 확인
- [ ] ④ Domain 탭 **Redirect Email** 섹션에 설정된 게 있는지 확인
- 🔴 **NAMESERVERS(Custom DNS) 변경은 오늘 하지 않는다** — Claude 가 Cloudflare 존
      레코드 대조를 끝내고 "지금 바꾸세요" 신호를 주면, 그때:
      NAMESERVERS → Custom DNS 선택 → STEP 4 스크린샷의 주소 2개 입력 → ✓ 저장 (3클릭).
      롤백도 같은 자리에서 원래 값으로 되돌리면 끝.

## STEP 9 — Claude 에게 전달
- [ ] (파일) `.env.local` 에 `CLOUDFLARE_API_TOKEN` 한 줄 ← 채팅 금지
- [ ] (채팅 OK) CF 네임서버 2개 스크린샷
- [ ] (채팅 OK) Namecheap 레코드 스크린샷들 + DNSSEC 상태 + 만료일
- [ ] (채팅 OK) Vercel Billing 스크린샷 (+ env 첫 장 보완)
- [ ] (채팅 OK) 운영 메일 3개 값:
      `OPS_ALERT_EMAIL` / `ADMIN_BOOKING_NOTIFICATION_EMAILS` / `OPS_INBOUND_ADDRESSES`

---

**이후 남는 사장님 액션은 딱 2개**: ① NS 변경 3클릭(Claude 신호에) ② 컷오버 날짜/시각 승인.
나머지(코드 패스·시험 빌드·스테이징·env 자동 주입·존 설정·크론 이식·검증)는 전부 Claude 가 진행.
