# 정확히 만나기 (Meet Exactly) — 마스터 플랜 (2026-07-27)

**SoT = 이 문서.** 사용자 지시: ① 프라이빗 투어는 고객이 만남 시간·장소를 정할 수 있게(하루 전 + 관광지에서도) ② 현 위치를 모르면 원버튼으로 정확한 위치 핀을 기사에게 전송 ③ 좌표는 WGS84(구글/브라우저 GPS)로 추출하되 **기사·가이드에게는 카카오맵/카카오내비 링크**로 전달(내비 안내 가능) ④ 길을 잃어도 **사진 한 장 + 좌표 하나**로 두 사람이 정확한 지점에서 만나게.

## §A 코드 리얼리티 (레콘 결과)

이미 있다 (재사용):
- `signals` 라우트: `lost`/`pickup_request`가 lat/lng 1회 핀(tour_room_pins, TTL 30분) + 기사·가이드 푸시 + 5로케일 캡슐. 좌표는 WGS84 브라우저 GPS.
- `nav-links.ts`: `kakaoNaviUrl(kakaomap://route CAR)`·`kakaoWebRouteUrl`·`tmapUrl`·`naverCarUrl`·`googleDirectionsUrl` 전부 WGS84 — **카카오 링크는 좌표 변환 불필요**.
- `locationMessage.ts` + `LocationPreview`: 본문의 `maps.google.com/?q=lat,lng`를 파싱해 정적지도 썸네일 렌더(ChatFeed·Cockpit 공용). 탭하면 **모두에게 구글맵**(갭).
- `meeting_notice`(broadcast): metadata(meeting_time/lat/lng/point_i18n) + 본문 구글 핀 URL → `NoticeBanner` 카운트다운(T-10 사다리·10/5분 경고·TTS). **가이드 발신 전용**(갭).
- Cockpit: pickup/dropoff 시그널에 ETA 원탭 답장 칩.
- 첨부 파이프라인(messages 라우트 multipart attachment+caption) — 사진 전송 재사용 가능.

갭 = 이번 작업:
1. 스태프(가이드·기사)가 받는 위치는 **카카오 내비 칩**이어야 한다 (현재 구글 단일).
2. **사진+좌표 원플로우** 부재 — 핀 보내고 사진은 별도로 알아서 보내야 한다.
3. **고객발 만남 설정** 부재 — meeting_notice는 가이드 콘솔에서만 발신 가능.

## §B 바인딩 결정 (M-D1 ~ M-D8)

- **M-D1 좌표계**: 전 구간 WGS84 단일 (브라우저 GPS = 구글 좌표계 = 카카오 링크 API 입력). 변환 레이어 만들지 않는다.
- **M-D2 역할별 내비**: `LocationPreview`에 `audience` prop 신설 — `staff`면 썸네일 아래 **[카카오내비](app scheme) · [카카오맵](web) · [티맵]** 칩 행, `guest`(기본)는 현행 구글 탭 + [Google Maps] 칩. 배선: ChatFeed(viewerRole 전달)·Cockpit(항상 staff). `NoticeBanner`의 지도 링크도 동일 분기(viewerRole prop 추가).
- **M-D3 신규 시그널 2종** (`guestSignals.ts` + `signals` 라우트, 기존 계약 확장):
  - `share_location` {lat,lng}: "📍 정확한 위치를 공유했어요 — {url}" 5로케일, 핀 kind `guest_spot`(TTL 30분), 기사+가이드 푸시. 길 잃음뿐 아니라 "여기서 만나요" 범용.
  - `meeting_propose` {time?, point?, lat?, lng?}: **프라이빗 투어 전용**(서버 게이트 `isPrivateTour(tours.price_type)`), metadata를 broadcast의 meeting_notice 계약과 동일하게 작성(`kind:'meeting_notice'`, meeting_time/lat/lng, `meeting_point_i18n` 번역, `proposed_by:'customer'`) + 본문에 구글 핀 URL → **기존 NoticeBanner 카운트다운·10/5분 경고·rally 사다리가 무변경으로 작동**. point 번역은 broadcast와 같은 translate 패턴. 푸시: 기사+가이드 "손님이 만남 시간·장소를 정했어요".
- **M-D4 사진+좌표 원버튼**: QuickSignalBar에 **[📍 여기서 만나요]** 칩 추가 → 컨펌 시트(위치 1회 공유 동의) → GPS 취득 → `share_location` 발사 → **즉시 카메라 캡처 입력 자동 오픈**(`capture=environment`, 선택 사항 — 취소해도 핀은 이미 전송됨) → 사진 선택 시 기존 첨부 파이프라인으로 캡션 프리필("📍 What I can see from here" 5로케일) 전송. 결과: 피드에 [지도카드]+[사진] 두 버블 = 사진 한 장+좌표 하나.
- **M-D5 만남 설정 UI**: HomeTab 집합·픽업 시트(PickupBoard) 하단에 **[만남 시간·장소 정하기]**(프라이빗 전용) → 시트 폼: 시간(HH:MM)·장소 텍스트·[현재 위치를 핀으로] 토글 → `meeting_propose`. 로비(D-1)와 라이브 모두 동일 진입(홈 탭 타일은 상시). 조인 투어는 버튼 자체 비노출(서버도 403).
- **M-D6 클라 게이트 소스**: TourRoomClient snapshot의 booking.tours에 price_type이 있으면 그걸로, 없으면 스냅샷 API에 1필드 추가(additive). 서버 게이트가 최종 방어선.
- **M-D7 불가침**: ActionGrid 트레이 무접촉 · 기존 시그널 타입 계약 무변경 · lost/pickup 흐름 무변경(사진 후속은 share_location에만) · §C-7 추적 금지(1회 핀+TTL 유지) · 레이트리밋 게이트 재사용.
- **M-D8 검증**: jest(템플릿 5로케일·라우트 게이트(조인 403/프라이빗 201)·audience 칩 렌더·meeting metadata 계약) + walk 확장(칩 시트·카카오 칩 가시화 스크린샷) + tsc/빌드/전체 스위트.

## §C WBS
- **P0** guestSignals 템플릿 2종 + navChips 순수 헬퍼
- **P1** signals 라우트: share_location·meeting_propose(프라이빗 게이트+point 번역+notice metadata+푸시)
- **P2** LocationPreview `audience` + NoticeBanner viewerRole + ChatFeed/Cockpit 배선
- **P3** QuickSignalBar [여기서 만나요]+사진 후속 · PickupBoard [만남 정하기] 시트
- **P4** 테스트 + walk + 게이트 + PR/머지 + 보고

## §D 리스크
| # | 리스크 | 완화 |
|---|---|---|
| R1 | activeNotice가 sender 필터로 고객 공지를 무시 | P1에서 notices.ts 확인 — 필터 있으면 metadata 기반으로 완화(1줄) |
| R2 | resolveRoomActor booking에 price_type 부재 | 라우트에서 tours 1-select 추가(기존 패턴) |
| R3 | 카카오 앱 미설치 기기서 scheme 무반응 | 웹 폴백 칩 병렬 노출(기존 nav-links 주석 계약) |
| R4 | 고객 스팸 만남 변경 | 기존 시그널 레이트리밋(6/분·40/시) 공유 + 최신 공지가 이전 것을 대체(activeNotice=최신 우선) |

## §E 실행 로그 (2026-07-27 완주)
- [x] P0 — guestSignals `share_location`/`meeting_propose` 5로케일 템플릿 + `navChipsFor()`(스태프=카카오내비·카카오맵·티맵 / 손님=구글·네이버, 전부 WGS84 무변환)
- [x] P1 — signals 라우트: share_location(guest_spot 핀 TTL30분+기사·가이드 푸시) · meeting_propose(**프라이빗 서버 게이트** tours.price_type='vehicle', time HH:MM 필수·place-or-pin 필수, place 5로케일 번역, **meeting_notice metadata 계약 그대로 작성** → 배너/경고/랠리 사다리 무변경 작동, 핀 행은 의도적 미작성 — 30분 TTL이 D-1 만남을 침묵 만료시키므로 좌표는 metadata에)
- [x] P2 — LocationPreview `audience` 칩(+정적지도 탭 타깃도 스태프=카카오) · NoticeBanner viewerRole 지도 링크 분기 · ChatFeed/Cockpit 배선 · 🔴walk가 잡은 실결함: **system 캡슐이 pill 분기로 빠져 지도카드 미렌더**(콕핏만 됐음) → system 분기에 지도카드+칩 추가, 회귀 테스트 2케이스
- [x] P3 — QuickSignalBar [📍 여기서 만나요](컨펌→GPS→핀→**카메라 캡처 자동 오픈**→캡션 프리필 사진 전송, 취소해도 핀은 전송됨) · MeetSetCard(시간·장소·현위치핀 토글, HomeTab 집합·픽업 시트, isPrivate 게이트) 5로케일
- [x] P4 — jest: 라우트 4케이스(조인 403·프라이빗 metadata 계약·검증 400) + meetExactly 9케이스 + A1 원장 2행 · tsc 0 · 전체 jest 4544+7 pass(잔여 4스위트=main 동일 사전존재) · `npm run build` 통과 · **walk E2E**: 02b(손님 원버튼→서울시청 실핀+사진, Google/NAVER 칩) + 13b(가이드 룸 같은 핀 → 카카오내비·카카오맵·티맵 칩) 콘솔 에러 0
- 기록: dev 서버 `| head` 파이프 금지(파이프 닫히며 서버 사망 — walk3 먹통의 진범) · 정션 워크트리에서 dev 워치가 편집을 놓칠 수 있음(스테일 번들 → 서버 재시작으로 확정 후 진단)
