# ⚡ 빠른 해결: translations 컬럼 추가

## 🔴 문제
에러: `column tours.translations does not exist`

## ✅ 해결 방법 (2분 안에 완료)

### 1단계: Supabase 대시보드 접속
1. 브라우저에서 https://supabase.com/dashboard 접속
2. 로그인
3. 프로젝트 선택

### 2단계: SQL Editor 열기
1. 왼쪽 메뉴에서 **"SQL Editor"** 클릭
2. **"New query"** 버튼 클릭

### 3단계: SQL 복사 & 붙여넣기
아래 SQL을 **전체 복사**해서 SQL Editor에 붙여넣기:

```sql
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tours_translations 
ON tours USING GIN (translations);
```

### 4단계: 실행
1. **"Run"** 버튼 클릭 (또는 Ctrl+Enter)
2. 성공 메시지 확인: "Success. No rows returned"

### 5단계: 확인
다음 쿼리로 확인:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tours' AND column_name = 'translations';
```

결과에 `translations | jsonb`가 보이면 성공!

## 🎯 다음 단계
1. ✅ SQL 실행 완료
2. 🔄 브라우저 새로고침 (F5)
3. 🔄 `/admin`에서 다시 로그인
4. 🚀 일괄 번역 스크립트 다시 실행

## 📸 스크린샷 가이드

### Supabase SQL Editor 위치
```
왼쪽 메뉴:
├── Table Editor
├── SQL Editor  ← 여기 클릭!
├── Database
└── ...
```

### SQL 실행 화면
```
┌─────────────────────────────────────┐
│ SQL Editor                         │
├─────────────────────────────────────┤
│ [SQL 쿼리 붙여넣기]                │
│                                     │
│ ALTER TABLE tours ...               │
│                                     │
├─────────────────────────────────────┤
│ [Run] 버튼 클릭                     │
└─────────────────────────────────────┘
```

## ⚠️ 주의사항
- SQL을 실행하기 전에 다른 작업은 하지 마세요
- `IF NOT EXISTS`를 사용했으므로 여러 번 실행해도 안전합니다
- 기존 투어 데이터는 영향받지 않습니다




