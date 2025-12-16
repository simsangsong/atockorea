# 포토코리아 이미지 설정 가이드

## 이미지 URL 확인 방법

포토코리아에서 제공한 페이지에서 실제 이미지 URL을 확인하는 방법:

### 방법 1: 브라우저 개발자 도구 사용

1. 포토코리아 페이지 열기:
   - 서울: https://phoko.visitkorea.or.kr/media/mediaList.kto?searchGbn=cntntsId&cntntsId=f2RUZa
   - 부산: https://phoko.visitkorea.or.kr/media/mediaList.kto?searchGbn=cntntsId&cntntsId=C9kG8b
   - 제주: https://phoko.visitkorea.or.kr/media/mediaList.kto?searchGbn=cntntsId&cntntsId=IlUkoa

2. F12 키를 눌러 개발자 도구 열기
3. Network 탭 선택
4. 페이지 새로고침 (F5)
5. 이미지 필터 선택
6. 표시된 이미지 중 메인 이미지의 URL 복사

### 방법 2: 이미지 우클릭

1. 포토코리아 페이지에서 이미지 우클릭
2. "이미지 주소 복사" 또는 "Copy image address" 선택
3. URL 복사

### 방법 3: 공공데이터포털 사용

공공데이터포털에서 제공하는 엑셀 파일에 이미지 다운로드 URL이 포함되어 있습니다.

## 현재 설정된 이미지 URL

현재 코드에는 임시 URL이 설정되어 있습니다. 실제 이미지 URL로 교체해야 합니다:

- 서울 (광화문): `components/HeroSection.tsx`와 `components/DestinationsCards.tsx`의 첫 번째 이미지
- 부산 (감천문화마을야경): 세 번째 이미지
- 제주 (성산일출봉): 두 번째 이미지

## 이미지 URL 형식 예시

포토코리아 이미지 URL은 일반적으로 다음과 같은 형식입니다:
- `https://phoko.visitkorea.or.kr/upload/contents/[날짜]/[파일명].jpg`
- 또는 `https://phoko.visitkorea.or.kr/media/[경로]/[파일명].jpg`

## 주의사항

1. **저작권**: 포토코리아 이미지는 저작권 보호를 받습니다
2. **출처 표시**: `[ⓒ한국관광공사 포토코리아-촬영자]` 형식으로 출처를 표시해야 합니다
3. **사용 조건**: 공공누리 마크 유형에 따라 사용 조건이 다릅니다
4. **상업적 이용**: 공공누리 1유형과 3유형만 상업적 이용이 가능합니다

## 이미지 교체 방법

실제 이미지 URL을 확인한 후:

1. `components/HeroSection.tsx` 파일 열기
2. `heroImages` 배열의 `image` 속성 값 변경
3. `components/DestinationsCards.tsx` 파일 열기
4. `destinations` 배열의 `image` 속성 값 변경
