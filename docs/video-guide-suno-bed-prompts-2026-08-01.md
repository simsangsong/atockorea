# Suno 배경음악(베드) 프롬프트 모음 — 관광지 안내영상용

2026-08-01. 관광지별 × 분위기별 × 특징별 3축, 총 47개. 생성해서 돌려가며 쓰는 로테이션 풀.

## 왜 이런 프롬프트인가 (파이프라인 제약 → 음악 조건)

영상 문법(스킬 `onetake-tour-video`)이 음악에 거는 조건 5가지 — **모든 프롬프트에 이미 구워져 있다**:

1. **보컬 금지** — 화면에 영어 자막이 굽고, 앱 TTS 해설이 위에 얹힌다(V6-D8). 가사는 물론
   허밍·워드리스 보컬도 중음역을 잡아먹으므로 전부 배제.
2. **드롭·급정지 금지, 일정한 에너지** — 배속 램프(1x↔4~8x)가 음악 박자와 무관한 지점에서
   걸린다. 클라이맥스가 있는 곡은 컷과 어긋나는 순간 티가 난다. `steady`, `no drops`.
3. **길이 3:30 이상 또는 루프 가능** — 러닝타임 대역이 3:00~4:30(V6-D7). Suno에서 짧게 나오면
   Extend로 늘리거나 루프 포인트가 깨끗한 테이크를 고른다.
4. **1.5x 초과 구간은 현장음이 죽고 베드만 남는다** — 베드가 빈약하면 고속 구간이 무음처럼
   들린다. 얇은 솔로 악기 하나짜리보다 **패드/리듬이 깔린 편성**이 안전.
5. **믹스는 파이프라인이 한다** — `bedGain 0.55`, −16 LUFS 정규화. 생성 단계에서 마스터링
   과하게 눌린 테이크보다 다이내믹 여유 있는 쪽이 낫다.

## Suno 사용 규약

- **Instrumental 토글 ON** + 프롬프트에도 `instrumental, no vocals` 중복 명시(토글 무시 사례 방지).
- Exclude styles(있는 버전이면): `vocals, rap, EDM drop, trap, dubstep`.
- 프롬프트당 2테이크 생성됨 → **관광지당 최소 4테이크(프롬프트 2개) 확보 후 선별**.
- 선별 기준: ①시작 5초가 밋밋한가(콜드오픈 위에 깔림) ②중간에 완전 무음 구간 없는가
  ③끝이 페이드로 정리되는가 ④3:30 미만이면 Extend.
- 🔴 **상업 라이선스**: 유료 플랜 계정으로 생성한 곡만 상업 사용 가능. 생성 계정·곡 링크를
  보관할 것 — 증거 매니페스트(`stamp.mjs`)와 같은 이유로, 곡 URL을 이 파일 하단 로그에 적는다.
- 저장 규약: 마스터는 `D:\VIDEO2\_음악베드\bed-<slug>-v<n>.mp3`, 렌더 시
  `assets/audio/video-guide/bed-<slug>.m4a` 로 복사(레포 git 미추적 — 스펙은 경로만 참조).

---

## A. 관광지별 (17곳 — 폴더당 기본 1개, 주력 소재는 2개)

### 부산

**A1 해동용궁사** (기존 베드 있음 — 교체 후보용)
```
Serene Korean temple by the sea, gentle gayageum and daegeum flute over soft ambient pads, slow ocean-swell rhythm, reverent and peaceful, 80 BPM, instrumental, no vocals, steady dynamics, no drops, loopable
```

**A2 감천문화마을**
```
Playful acoustic indie folk, ukulele, glockenspiel, soft hand percussion, sunny hillside village of pastel houses, whimsical and warm, 100 BPM, instrumental, no vocals, steady energy, no drops, loopable
```

**A3 감천문화마을 (대안 — 골목 감성)**
```
Cozy Korean lo-fi with acoustic guitar and music box, narrow alley murals and rooftop views, nostalgic afternoon light, 88 BPM, instrumental, no vocals, even dynamics, loopable
```

**A4 자갈치시장**
```
Upbeat market-day folk swing, jaunty acoustic guitar, upright bass, brushed drums, accordion accents, cheerful fish-market bustle and friendly haggling, 110 BPM, instrumental, no vocals, constant groove, no drops
```

**A5 국제시장**
```
Nostalgic Korean retro swing, muted trumpet, vibraphone, walking bass, 1960s market street atmosphere, warm and lively, 105 BPM, instrumental, no vocals, steady rhythm, loopable
```

**A6 남포동광복로**
```
Mellow city-pop instrumental, clean electric guitar, warm electric piano, smooth groove, stylish evening shopping street, relaxed confidence, 95 BPM, instrumental, no vocals, even energy, no drops
```

**A7 용두산공원**
```
Gentle orchestral pop, warm strings, piano, soft brass swells, panoramic city and harbor view from a hilltop tower, hopeful and open, 90 BPM, instrumental, no vocals, smooth dynamics, loopable
```

**A8 태종대**
```
Cinematic coastal ambient, sweeping strings, low piano, airy textures, majestic sea cliffs and a white lighthouse, unhurried grandeur, 75 BPM, instrumental, no vocals, gradual swells only, no drops
```

**A9 송도용궁구름다리**
```
Airy uplifting acoustic, plucked strings, marimba, light shaker, breezy skywalk bridge over turquoise water, bright and weightless, 100 BPM, instrumental, no vocals, steady lift, loopable
```

**A10 닥밭골벽화마을**
```
Warmhearted fingerstyle guitar with melodica and soft strings, painted stairways and a tiny hillside monorail, tender and homely, 85 BPM, instrumental, no vocals, gentle throughout, loopable
```

**A11 부산항크루즈터미널**
```
Travel documentary opener, soft steady four-on-the-floor pulse, piano arpeggios, warm strings, suitcases and boarding excitement, anticipation of a voyage, 105 BPM, instrumental, no vocals, no drops
```

### 경주

**A12 대릉원**
```
Ancient Korean royal theme, geomungo, haegeum, slow ceremonial drum, dignified and quietly mysterious, grassy royal burial mounds at golden hour, 70 BPM, instrumental, no vocals, restrained dynamics, loopable
```

### 제주

**A13 크루즈입항일출**
```
Dawn at sea ambient, slow-building warm pads, soft piano, first light over calm water from a ship's deck, hopeful arrival, 65 BPM, instrumental, no vocals, one gentle rise, no drops
```

**A14 함덕해수욕장**
```
Tropical chill acoustic, ukulele, warm mallet keys, laid-back surf groove, emerald shallow water and white sand, easy holiday mood, 95 BPM, instrumental, no vocals, steady sway, loopable
```

**A15 만장굴**
```
Subterranean ambient, deep soft drone, water-drop percussion, sparse felt piano, vast dark lava tube cave, mysterious but calm and safe, 60 BPM, instrumental, no vocals, very even dynamics, loopable
```

**A16 성산일출봉**
```
Majestic volcanic sunrise theme, building orchestral strings, Korean daegeum flute lead, deep ocean drums, triumphant crater summit view over the sea, 85 BPM, instrumental, no vocals, gradual build only, no sudden drops
```

**A17 성산일출봉 (대안 — 해녀 물질공연)**
```
Resilient and warm Korean folk theme, haegeum melody over tide-like rhythm, hand drums, women divers of the sea, proud and tender, 90 BPM, instrumental, no vocals, steady pulse, loopable
```

**A18 외돌개**
```
Contemplative coastal walk, nylon-string guitar, cello, wave-like arpeggios, a lone rock pillar standing in the sea, reflective and quietly strong, 80 BPM, instrumental, no vocals, smooth dynamics, loopable
```

**A19 애월한담해변**
```
Sunset lo-fi jazz, Rhodes piano, soft muted saxophone, vinyl warmth, mellow seaside cafe street at golden hour, romantic and unhurried, 75 BPM, instrumental, no vocals, even glow, no drops
```

**A20 애월한담해변 (대안 — 산책로)**
```
Golden hour acoustic stroll, warm fingerpicked guitar, soft strings, gentle brushed rhythm, coastal walking path past cafes into the sunset, sweet and calm, 92 BPM, instrumental, no vocals, loopable
```

---

## B. 분위기별 (10 — 어느 관광지든 성격이 맞으면 돌려쓰는 풀)

**B1 고요·사찰·정원**
```
Korean zen ambient, gayageum harmonics, low flute, temple bell resonance far away, still morning air, meditative, 62 BPM, instrumental, no vocals, flat calm dynamics, loopable
```

**B2 활기·시장·골목잔치**
```
Bright festive folk, acoustic guitar, fiddle, tambourine, clapping-free cheerful street energy, everyone smiling, 115 BPM, instrumental, no vocals, constant energy, no drops
```

**B3 웅장·전망·파노라마**
```
Epic but gentle panorama theme, wide strings, French horn swells, slow piano, standing at a viewpoint above the coastline, awe without tension, 78 BPM, instrumental, no vocals, gradual swells, no drops
```

**B4 아기자기·동화·포토존**
```
Whimsical toybox acoustic, music box, pizzicato strings, glockenspiel, storybook cuteness, light-footed, 98 BPM, instrumental, no vocals, steady playful energy, loopable
```

**B5 노을·로맨틱**
```
Warm sunset ballad instrumental, piano, soft strings, subtle jazz brushes, sky turning orange over the water, tender and full, 72 BPM, instrumental, no vocals, smooth dynamics, no climax drops
```

**B6 새벽·출발·설렘**
```
Early morning departure theme, soft pulsing synth pad, piano ostinato, strings entering slowly, journey about to begin, quiet excitement, 100 BPM, instrumental, no vocals, one long gentle build, loopable
```

**B7 신비·동굴·숲**
```
Mysterious nature ambient, deep pads, kalimba droplets, distant low strings, ancient forest and stone, curious not scary, 66 BPM, instrumental, no vocals, very even dynamics, loopable
```

**B8 바닷바람·해안산책**
```
Breezy coastal folk, open-tuned acoustic guitar, light mandolin, soft shaker, salt wind on a seaside path, free and easy, 96 BPM, instrumental, no vocals, steady stride rhythm, loopable
```

**B9 역사·유적·고도(古都)**
```
Ancient Korea heritage theme, geomungo and janggu in a slow stately rhythm, bamboo flute phrases, stone walls and old pines, respectful wonder, 74 BPM, instrumental, no vocals, restrained, loopable
```

**B10 밤·야경·도심**
```
Night city chill, warm electric piano, soft synth bass, mellow beat, neon reflections on the water, sophisticated calm, 84 BPM, instrumental, no vocals, even late-night energy, no drops
```

---

## C. 특징별 — 브랜드 아이덴티티 시리즈 (17)

한 시리즈로 통일하면 채널 전체에 "우리 소리"가 생긴다. 국악 퓨전을 1순위로 추천
(외국인 손님에게 한국 정체성이 즉시 전달되고, 타 채널과 즉시 구분됨).

### C-국악퓨전 (신곡 5)
```
Modern Korean fusion, gayageum melody over soft lo-fi beat, warm pads, bright morning energy, 95 BPM, instrumental, no vocals, steady, loopable
```
```
Modern Korean fusion, daegeum flute over ambient piano and light percussion, wide coastal scenery, calm and proud, 80 BPM, instrumental, no vocals, smooth dynamics, loopable
```
```
Modern Korean fusion, haegeum lead with acoustic guitar and brushed drums, lively old market street, friendly bounce, 108 BPM, instrumental, no vocals, constant groove, no drops
```
```
Modern Korean fusion, geomungo bassline with soft electronic textures, mysterious cave and lava rock, deep and calm, 68 BPM, instrumental, no vocals, very even, loopable
```
```
Modern Korean fusion, kayagum arpeggios with warm strings, sunset over the sea, tender finale feeling without a climax, 76 BPM, instrumental, no vocals, gentle throughout, loopable
```

### C-어쿠스틱 산책 (3)
```
Acoustic travel walking theme, fingerstyle guitar, upright bass, light brushes, comfortable stride, friendly and clean, 100 BPM, instrumental, no vocals, steady, loopable
```
```
Acoustic duo of guitar and cello, unhurried scenic walk, warm afternoon, humble and sincere, 84 BPM, instrumental, no vocals, smooth, loopable
```
```
Bright acoustic trio, guitar, mandolin, soft cajon, seaside village lanes, open-hearted, 104 BPM, instrumental, no vocals, constant energy, no drops
```

### C-시네마틱 앰비언트 (3)
```
Soft cinematic ambient, piano motifs over warm string beds, documentary scenery pacing, wonder without drama, 72 BPM, instrumental, no vocals, gradual swells only, loopable
```
```
Ambient orchestral textures, slow horn and string layers, morning fog lifting off the coast, patient and vast, 64 BPM, instrumental, no vocals, flat dynamics, loopable
```
```
Minimal cinematic pulse, felt piano, sub-bass warmth, airy strings, quiet forward motion for travel footage, 88 BPM, instrumental, no vocals, even energy, no drops
```

### C-로파이 (3)
```
Travel lo-fi hip hop, dusty drums, warm Rhodes chords, vinyl crackle, mellow sightseeing pace, 86 BPM, instrumental, no vocals, steady head-nod groove, loopable
```
```
Sunny lo-fi with acoustic guitar samples and soft beat, beach town morning, light and clean, 92 BPM, instrumental, no vocals, constant, loopable
```
```
Evening lo-fi jazz, muted trumpet fragments, brushed beat, cafe windows glowing at dusk, cozy, 78 BPM, instrumental, no vocals, even glow, loopable
```

### C-재즈 (3)
```
Light swing jazz trio, piano, upright bass, brushes, cheerful window-shopping stroll, classy and warm, 112 BPM, instrumental, no vocals, steady swing, no drops
```
```
Bossa nova instrumental, nylon guitar, soft percussion, gentle piano comping, seaside cafe afternoon, breezy, 94 BPM, instrumental, no vocals, constant sway, loopable
```
```
Smooth jazz ballad, warm saxophone melody kept soft and low in the mix, piano and strings, harbor lights at dusk, 70 BPM, instrumental, no vocals, smooth dynamics, no climax
```

---

## D. 생성 곡 로그 (여기에 채워 넣기 — 라이선스 증빙 겸용)

| 날짜 | 프롬프트 # | 곡 URL | 파일명 | 사용 영상 |
|---|---|---|---|---|
| 2026-07-29 | (스킬 이전) | — | bed-haedong-yonggungsa.m4a | 용궁사·감천(임시 공유) |
