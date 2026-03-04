# 영어 페이지에서 한국어로 나오는 투어 고치기

영어로 접속했는데 특정 상품(예: 제주도 프라이빗 자동차 투어) 제목이 한국어로 나오는 경우, 해당 투어에 **영어 번역(`translations.en`)** 이 없기 때문입니다.

## 해결 방법: 영어 번역 자동 생성 스크립트

`scripts/translate-tours-to-english.js` 를 사용하면, 한국어 제목/설명을 Google Translate로 영어로 번역해 `tours.translations.en` 에 저장할 수 있습니다.

### 사용 절차

1. **Google Cloud Translation API 키**  
   - `scripts/auto-translate-tours.js` 에서 쓰는 것과 동일한 키 사용  
   - 스크립트 상단 `GOOGLE_TRANSLATE_API_KEY` 에 넣거나, 이미 설정돼 있으면 그대로 사용

2. **관리자 로그인**  
   - 사이트에서 `/admin` 접속 후 로그인

3. **브라우저 콘솔에서 스크립트 실행**  
   - F12 → Console 탭  
   - `scripts/translate-tours-to-english.js` 파일 내용 **전체**를 복사해 콘솔에 붙여넣기 후 Enter

4. **실행 결과**  
   - “영어 번역이 필요한” 투어만 골라서 번역 후 DB에 반영  
   - 콘솔에 진행 로그와 완료 메시지 출력

5. **확인**  
   - 영어로 사이트 접속 후 해당 상품이 영어 제목으로 나오는지 확인

### 옵션 (스크립트 상단 변수)

| 변수 | 설명 |
|------|------|
| `TOUR_SLUG` | 비우면 **영어 번역 필요한 모든 투어** 처리. 특정 투어만 하려면 slug 입력 (예: `'jeju-private-car-tour'`) |
| `TRANSLATE_FULL` | `true`: 제목 + 설명·일정·하이라이트 등 전체 번역 (시간 소요). `false`: **제목만** 번역 |

- 한 개 상품만 빠르게 고치려면: `TOUR_SLUG = '해당투어-slug'`, `TRANSLATE_FULL = false` 로 두고 실행하면 됩니다.

### 투어 slug 확인

- 관리자 페이지에서 해당 투어 편집 화면 URL을 보면 `.../products?tour=...` 또는 상세 URL에 slug가 나옵니다.
- 또는 Supabase Dashboard → `tours` 테이블에서 `slug` 컬럼으로 확인할 수 있습니다.

이후 영어 페이지에서는 API가 `locale=en` 일 때 `translations.en.title` 을 사용하므로, 해당 상품이 영어로 표시됩니다.
