# 브라우저 콘솔에서 투어 추가하기 (보안 경고 우회 방법)

## 문제 상황
브라우저 콘솔에 코드를 붙여넣을 때 보안 경고가 계속 나타나고 숫자만 누적되는 경우

## 해결 방법

### 방법 1: 단계별 실행 (권장)

`scripts/add-jeju-cruise-tour-step-by-step.js` 파일을 사용하세요.

#### STEP 1: 데이터 정의
1. 파일에서 "STEP 1" 부분만 복사 (const tourData = { ... }; 까지)
2. 콘솔에 붙여넣기 (보안 경고 무시)
3. Enter 키 누르기
4. `undefined` 또는 `{...}` 객체가 표시되면 성공

#### STEP 2: 함수 정의
1. 파일에서 "STEP 2" 부분만 복사 (async function createTour() { ... } 까지)
2. 콘솔에 붙여넣기
3. Enter 키 누르기
4. `undefined`가 표시되면 성공

#### STEP 3: 실행
1. 콘솔에 다음 입력:
   ```javascript
   createTour()
   ```
2. Enter 키 누르기
3. 결과 확인

---

### 방법 2: 직접 타이핑 (가장 확실)

보안 경고를 완전히 우회하려면 직접 타이핑하세요:

1. 콘솔에 다음을 입력:
   ```javascript
   fetch('/api/admin/tours', {method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title:"Jeju Island: Full Day Tour for Cruise Ship Passengers",slug:"jeju-island-full-day-tour-cruise-passengers",city:"Jeju",price:88000,price_type:"person",image_url:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",tag:"Cruise",subtitle:"Top rated",description:"Exclusive Jeju tour for cruise guests...",original_price:88000,duration:"8 hours",lunch_included:false,ticket_included:true,rating:4.8,review_count:138,is_active:true,is_featured:true})}).then(r=>r.json()).then(r=>console.log(r.data?`✅ 성공: ${r.data.title}`:`❌ 실패: ${r.error}`))
   ```

2. Enter 키 누르기

---

### 방법 3: 브라우저 설정 변경 (고급)

Chrome/Edge에서 보안 경고를 비활성화하려면:

1. 주소창에 입력: `chrome://flags/#disable-dev-shm-usage` (Chrome) 또는 `edge://flags/#disable-dev-shm-usage` (Edge)
2. "Disable DevTools console paste protection" 검색
3. 비활성화 설정
4. 브라우저 재시작

**주의**: 보안이 약해질 수 있으므로 개발 환경에서만 사용하세요.

---

### 방법 4: 북마클릿 사용

1. 새 북마크 생성
2. 이름: "Add Jeju Cruise Tour"
3. URL에 다음 코드 입력:
   ```javascript
   javascript:(async()=>{const d={title:"Jeju Island: Full Day Tour for Cruise Ship Passengers",slug:"jeju-island-full-day-tour-cruise-passengers",city:"Jeju",price:88000,price_type:"person",image_url:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",tag:"Cruise",subtitle:"Top rated",description:"Exclusive Jeju tour for cruise guests. Pickup & drop-off strictly on time at the cruise terminal.",original_price:88000,duration:"8 hours",lunch_included:false,ticket_included:true,rating:4.8,review_count:138,is_active:true,is_featured:true};const r=await fetch('/api/admin/tours',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(d)});const j=await r.json();alert(j.data?`✅ 성공: ${j.data.title}`:`❌ 실패: ${j.error}`)})()
   ```
4. `/admin` 페이지에서 북마크 클릭

---

## 추천 방법

**가장 간단한 방법**: `scripts/add-jeju-cruise-tour-step-by-step.js` 파일의 STEP 1, STEP 2, STEP 3을 순서대로 실행하세요.

각 단계는 작은 코드 조각이므로 보안 경고가 나타나더라도 붙여넣기가 가능합니다.

