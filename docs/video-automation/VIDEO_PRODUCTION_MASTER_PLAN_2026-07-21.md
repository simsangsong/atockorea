# POI 동영상 프로덕션 마스터 플랜 (단일 기준, 2026-07-21)

앞선 Codex 뼈대(2026-07-20, PR #428로 main 머지)를 "실제 시청 가능한 영상"까지 끌어올리는 실행 플랜.
이 문서가 SoT. 기존 `VIDEO_AUTOMATION_ARCHITECTURE.md` 등 10개 문서는 참조 이력으로 유지하되, 충돌 시 이 문서가 우선.

---

## §A 자산·현황 감사 (2026-07-21 실측)

| 자산 | 상태 | 근거 |
| --- | --- | --- |
| dry-run 파이프라인 | ✅ main 머지 | `lib/video-automation/*`, `scripts/generate-poi-video.ts`, 테스트 7 green |
| ffmpeg / ffprobe | ✅ 8.1.2 동작 확인 | 실렌더 + probe 실측 |
| OpenAI API 키 | ✅ `.env.local` 보유 | TTS 사용 가능 |
| POI 이미지 | ✅ POI당 8장+ 로컬 존재 | `stop.images` + `stop.imageCredits`(출처 포함), `public/images/**` 실파일 확인 |
| 이미지 출처 데이터 | ✅ `imageCredits[].source` | `atoc-korea` = 자사 촬영 → 라이선스 자동 clear 근거 |
| 4언어 현지화 텍스트 | ✅ 정적 투어 JSON | ja/zh-Hant 실자막 생성 검증됨 |
| HyperFrames CLI | ✅ 0.7.64 + 헤드리스 Chrome | 모션그래픽 레이어 후보 (W1.5) |
| 소스 실영상 | ❌ 미제공 | 사용자 촬영 대기 (W2 게이트) |
| Meta 자격증명 | ❌ 미설정 | 사람 게이트 (W4) |
| BGM 라이선스 | ❌ 미결정 | 사람 게이트 |

## §B 바인딩 결정 (VP-D1~D12)

- **VP-D1 렌더 축 = ffmpeg 직접 제어.** 스킬 래퍼(HyperFrames 제외) 미채택. video-use는 프레임 추출+직접 검수로 대체, Generative Media는 실물 관광지 대체 금지 정책 유지.
- **VP-D2 HyperFrames는 선택적 오버레이 레이어.** W1.5에서 ffmpeg 단독 vs HyperFrames 오버레이 비교 렌더 후 사용자 픽. 그 전까지 코어 경로 의존 금지.
- **VP-D3 언어 4종 고정** (en, zh-Hant, ja, es). 룸 로케일 매핑은 기존 `languages.ts` 계약 유지.
- **VP-D4 TTS = OpenAI** (`OPENAI_TTS_MODEL` 기본 `gpt-4o-mini-tts`, `OPENAI_TTS_VOICE` 기본 `alloy`). 텍스트+모델+보이스 해시로 캐시하여 재실행 비용 0. `--tts=silent`가 기본값(무비용 안전), 실납품 렌더만 `--tts=openai`.
- **VP-D5 씬 타이밍 = 내레이션 적응형.** 고정 60초 그리드 폐기. 씬 길이 = max(씬별 최소, 내레이션 길이+0.7s), 크로스페이드 0.5s 중첩 반영. 총 길이 45~75s 밴드 허용.
- **VP-D6 라이선스 자동판정:** `imageCredits.source === 'atoc-korea'` → `cleared`. 그 외(unsplash/pexels 등) → `unknown`(검수 게이트). 파일명에 `-ai` 마커가 있는 생성 이미지는 영상 렌더에서 자동 제외.
- **VP-D7 자막 = 번인 기본 + soft(VTT/SRT) 병행 산출.** CJK 폰트는 언어별 시스템 폰트(ja=Yu Gothic UI, zh-Hant=Microsoft JhengHei, en/es=Segoe UI). 안전영역 MarginV 유지.
- **VP-D8 세로 1080×1920 고정** (앱 카드 + Reels 공용). 가로 파생본은 W4 이후.
- **VP-D9 BGM 보류.** 라이선스 결정(사람 게이트) 전까지 내레이션 온리 + loudnorm 정규화.
- **VP-D10 발행은 항상 승인 게이트.** 산출물은 `awaiting_publish_approval`까지만. Facebook 실업로드/앱 노출은 어드민 승인 후.
- **VP-D11 실영상(W2)은 같은 워크플로우의 씬 소스 교체로 흡수.** 씬 비주얼 타입을 `still | clip`으로 설계해 두고, 지금은 `still`만 구현. 사용자 실영상이 오면 clip 트리밍이 같은 자리에 꽂힌다.
- **VP-D12 진행 보고 한국어, 코드·커밋 영어** (프로젝트 공통 규칙).

## §C W1 프로덕션 워크플로우 스펙 (이번 세션 구현)

명령: `npm run video:produce -- --poi=<poi_key> [--tour=<slug>] [--languages=...] [--tts=openai|silent]`

7 스테이지, 산출물은 `.tmp/video-automation/<poiId>/prod-v<version>-<hash>/`:

1. **Ingest** — 정적 투어 JSON에서 POI 해석(기존 리졸버 재사용·공유 라이브러리로 추출), `stop.images`+`imageCredits` 수집, 실파일 존재 검증, `-ai` 이미지 제외, 라이선스 자동판정(VP-D6).
2. **Script** — 기존 `buildVideoScript` 재사용(4언어, 사실 출처 ID 포함). 현지화 콘텐츠 부재 시 영어 폴백을 **경고로 기록**(조용한 폴백 금지).
3. **TTS** — 씬별×언어별 내레이션 합성(캐시). silent 모드는 글자수 기반 추정 길이의 무음. 산출: mp3/wav + ffprobe 실측 길이.
4. **Timeline** — 내레이션 길이로 씬 경계 계산(VP-D5). 크로스페이드 중첩 반영한 씬 시작 오프셋 산출.
5. **Subtitles** — 적응형 타이밍으로 VTT/SRT 재생성(기존 빌더 재사용).
6. **Render** — 씬별 이미지 Ken Burns(줌인/줌아웃/팬 교차) → xfade 체인 → 씬 오프셋에 내레이션 배치(amix) → loudnorm → SRT 번인 → 언어별 MP4 + 실프레임 포스터.
7. **QC** — ffprobe 실측(길이 오차 ±1s, 1080×1920, 오디오 스트림), 자막 파일, 언어 커버리지(영어 폴백 경고), 라이선스 요약 → `qc-production.json`.

## §D WBS

- **W1 (이번 세션):** §C 워크플로우 구현 + 테스트 + 파일럿 렌더 검증(자갈치 또는 경복궁, 4언어).
- **W1.5:** HyperFrames 오버레이 비교 렌더 1건 → 사용자 스타일 픽 (VP-D2).
- **W2 (사용자 실영상 수신 후):** ingest에 clip 소스 추가 — probe→씬 감지→프레임 추출→AI 직접 검수→EDL(컷 선정 JSON)→트리밍·색보정→W1 스테이지 4~7 그대로 재사용. 폴더 규약: `assets/video-sources/<poi_key>/*.mp4`.
- **W3 (앱 통합):** ✅ 완료(2026-07-22, = 조인투어 트랙 J4 서빙 게이트 해소) — 상세는 §G 로그.
- **W4 (푸시+홍보):** 웹푸시(기존 `guestPush.ts`/`push_subscriptions` 재사용) + `MetaPublisher` 어댑터(dry-run→실업로드, 토큰=사람 게이트).
- **W5 (스케일):** 전 POI 배치 크론 + `video_projects` 등 DB 테이블 + 어드민 승인 UI.

## §E 사람 게이트 (코드로 해결 불가)

1. 소스 실영상 촬영·제공 (W2 선행조건)
2. Meta 앱/페이지 토큰 발급 + 앱 심사 (W4)
3. BGM 라이선스 결정 (VP-D9 해제)
4. 자사 외 출처(unsplash 등) 이미지의 상업 영상 사용 검수
5. W1.5 스타일 픽 + 실기기 재생 QA

## §F 실행/QA

```bash
# 무비용 파일럿 (무음 내레이션, 전체 렌더 경로 검증)
npm run video:produce -- --poi=jagalchi_market

# 실제 TTS 렌더 (POI당 약 $0.05 내외)
npm run video:produce -- --poi=jagalchi_market --tts=openai
```

검증 체크리스트: jest 스위트 green / tsc 0 / `qc-production.json` passed·warning 사유 확인 / 렌더 MP4에서 프레임 추출해 시각 검수(자막 안전영역·폰트·Ken Burns 방향).

## §G 착수 로그

- **2026-07-21 W1 완료** (PR #435): 7-스테이지 `video:produce` — 실 Ken Burns 렌더 + TTS 캐시 + 청킹 자막 + QC 실측, 자갈치 4언어 검증.
- **2026-07-22 W1 후속** (별도 세션, 브랜치 `claude/video-narration-overlap-fix`): 씬 14s 캡이 내레이션을 다음 씬으로 흘리던 문제 — 캡 제거(타임라인은 오디오를 절대 자르지 않는 불변식) + `trimForSpeech()` 대본 단계 스피치 버짓(라틴 ~160자/CJK ~70자, 문장·절 경계 컷) + `narration_fit` QC 체크.
- **2026-07-22 W3 완료** (조인투어 J4와 동일 슬라이스): ① `poi_videos` 테이블 라이브(poi_key×언어×버전 UNIQUE, status pending_review→approved/rejected, RLS 서비스롤 전용) ② `npm run video:upload` — QC failed 업로드 거부·warning은 `--allow-warnings` 명시 필요(무음 내레이션·미검수 라이선스는 사람이 결정, VP-D6/D10), 퍼블릭 `tour-videos` 버킷에 MP4+포스터, 행은 **pending_review로만** 등록 ③ 서빙: `fetchArrivalVideoCard()`(승인분만·언어별 최신 버전·fail-open) → arrival-bundle·manual-arrival 메타데이터 `video_card`(룸 로케일 키, zh-Hant→zh) ④ `ArrivalVideoCard` 포스터-퍼스트 탭 재생(iOS playsInline, ko 뷰어는 en 폴백 — 자막 번인이라 시청 가능) — ArrivalBundleCard+ChatFeed spot_arrival 배선 ⑤ `/admin/poi-videos` 검수큐(인라인 재생·QC 배지·승인/거절·승인 시 구버전 자동 폐기 = 언어당 승인 1건 불변식). 테스트: 신규 33 + 투어룸/api/컴포넌트 901 green(실패 2건은 main 사전존재 tours.test.ts), tsc 0. **오프라인 볼트(J3) 동영상 편입은 §D 결정 1(캐시 범위) 대기로 의도적 보류.**
