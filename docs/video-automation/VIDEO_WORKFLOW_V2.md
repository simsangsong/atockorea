# VIDEO_WORKFLOW_V2 — 영상 트랙 정본 인덱스 (2026-08-08)

**이 파일은 규칙을 담지 않는다.** 규칙·수치를 여기(또는 어떤 스킬에도) 복사하지 마라 —
복사본은 반드시 어긋난다(teaser 45-90s 오기가 실제 사례). 이 파일의 역할은 단 하나:
외부 도구(Codex 스킬 `atockorea-ai-video-workflow` 등)가 "정본이 어디인가"를 물을 때
아래 두 트랙의 진짜 정본과 실제 명령으로 보내는 것.

## 트랙 1 — 원테이크 루트 가이드 (사장님 촬영 → 길안내 영상)

| | |
|---|---|
| 규칙 정본 | `docs/video-guide-standard-grammar-2026-08-04.md` (페이싱·재단·폴라로이드·구조) |
| 게이트 정본 | `scripts/video-guide/validate.mjs` — 수치는 여기 코드가 유일한 소스 |
| 스펙 | `docs/video-specs/<slug>.json` (+ `<slug>.turns.json` 실측 캐시) |
| 실행 | `npm run video:guide -- <slug> [--check\|--full]` (§5 원커맨드 — `run.mjs`) |
| 산출물 | `out/video-guide/` — `<slug>.mp4`(클린 와이드) · `<slug>-vertical.mp4`(주 산출물) · `<slug>-wide.mp4` · `<slug>-teaser.mp4` · `<slug>-poster{,-wide}.jpg` · `<slug>.chapters.txt` · `<slug>.cues.json` |
| 무결성 | `scripts/video-guide/stamp.mjs` → `<slug>.evidence.json` (SHA-256 + 불가시 마크) |
| 릴리즈 QC | `node scripts/video-guide/release.mjs <slug> [--version=N]` → `<slug>.release-manifest.json`, 종착 상태는 항상 `awaiting_publish_approval` |
| 설계 이력 | `docs/onetake-tour-video-v6-design-master-plan-2026-07-30.md` (V6-D 결정 번호들) |

구조 규칙 중 도구가 자주 틀리는 것 하나만 짚는다(수치 아님): **풀 가이드는 콜드오픈 뒤
실제 동선 순서를 보존한다(문법 §4). 페이오프-먼저 재배열은 티저에만 허용된다.**

## 트랙 2 — POI 익스플레이너 자동화 (스틸+TTS 4언어)

| | |
|---|---|
| 정본 | `docs/video-automation/VIDEO_PRODUCTION_MASTER_PLAN_2026-07-21.md` — **같은 폴더의 다른 문서 10종과 충돌하면 이 문서가 우선**(예: 길이 밴드는 VP-D5 가 55-65s 를 45~75s 로 개정) |
| 실행 | `npm run video:produce -- --poi=<poi_key> …` · 일괄 `npm run video:batch` |
| 코드 | `lib/video-automation/*` · `scripts/generate-poi-video.ts` · `scripts/produce-poi-video.ts` |
| 업로드 게이트 | `__tests__/lib/video-automation/uploadGate.test.ts` · 산출 리포트 `qc-production.json`/`run-summary.json` |

## 두 트랙 공통 (요약이 아니라 소재지)

- **발행은 항상 사람 게이트** — 어떤 QC 통과도 발행 권한이 아니다. Facebook·앱 노출 정책:
  `docs/video-automation/META_PUBLISHING_SETUP.md` · `VIDEO_SECURITY_AND_PRIVACY.md` (VP-D10).
- **변하는 사실(가격·시간·휴무)은 영상에 굽지 않는다** — 앱 데이터가 담당. POI 사실의 정본:
  `data/poi_kb/` · `match_pois`.
- **생성 미디어는 실존 관광지의 다큐멘터리 증거가 될 수 없다** (VP-D1/D6, 파일명 `-ai` 마커 자동 제외).
