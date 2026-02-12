# translations 컬럼 추가 가이드

## 문제
에러 메시지: `column tours.translations does not exist`

데이터베이스에 `translations` 컬럼이 없어서 발생하는 오류입니다.

## 해결 방법

### 방법 1: Supabase 대시보드에서 실행 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **다음 SQL 실행**
   ```sql
   -- translations 컬럼 추가
   ALTER TABLE tours 
   ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

   -- GIN 인덱스 생성 (JSONB 검색 성능 향상)
   CREATE INDEX IF NOT EXISTS idx_tours_translations 
   ON tours USING GIN (translations);
   ```

4. **실행**
   - "Run" 버튼 클릭
   - 성공 메시지 확인

### 방법 2: 터미널에서 실행

```bash
# Supabase CLI 사용 (설치되어 있는 경우)
supabase db execute -f supabase/add-translations-to-tours.sql
```

## 확인 방법

SQL 실행 후 다음 쿼리로 확인:

```sql
-- translations 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tours' AND column_name = 'translations';

-- 결과: translations | jsonb
```

## 다음 단계

1. ✅ `translations` 컬럼 추가 완료
2. ⏳ 브라우저 새로고침
3. ⏳ `/admin`에서 다시 로그인
4. ⏳ 일괄 번역 스크립트 다시 실행

## 주의사항

- 기존 투어 데이터는 영향받지 않습니다
- `translations` 컬럼은 기본값 `{}` (빈 JSON 객체)로 설정됩니다
- 기존 투어의 `translations` 필드는 자동으로 `{}`로 초기화됩니다




