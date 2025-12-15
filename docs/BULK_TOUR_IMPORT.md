# 대량 투어 가져오기 가이드

## 개요

여러 투어를 한 번에 추가하는 방법을 안내합니다.

## 방법 1: 통합 SQL 스크립트 (간단)

`supabase/insert-all-tours.sql` 파일에 모든 투어 스크립트를 포함했습니다.

**주의:** Supabase SQL Editor는 `\i` 명령어를 지원하지 않으므로, 각 투어 스크립트의 내용을 수동으로 합쳐야 합니다.

**대안:** 아래 Python 스크립트를 사용하여 모든 SQL 파일을 하나로 합칠 수 있습니다.

## 방법 2: Python 스크립트로 SQL 파일 합치기

```python
import os
import re

# SQL 파일이 있는 디렉토리
sql_dir = 'supabase'
output_file = 'supabase/insert-all-tours-combined.sql'

# 투어 파일 목록 (순서대로)
tour_files = [
    'insert-jeju-southern-unesco-tour.sql',
    'insert-jeju-eastern-unesco-tour.sql',
    'insert-jeju-winter-tour.sql',
    'insert-jeju-west-south-tour.sql',
    'insert-jeju-southern-unesco-geopark-tour.sql',
    'insert-busan-cruise-sightseeing-tour.sql',
    'insert-busan-top-attractions-tour.sql',
    'insert-jeju-cruise-full-day-tour.sql',
    'insert-jeju-winter-southwest-tour.sql',
]

combined_sql = """-- ============================================
-- Insert All Tours - Combined Script
-- ============================================
-- This script inserts all tours in one execution
-- Generated automatically from individual tour files
-- 
-- Note: If a tour already exists (slug conflict), 
-- you can manually comment out that section before running.

"""

for i, filename in enumerate(tour_files, 1):
    filepath = os.path.join(sql_dir, filename)
    
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found, skipping...")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 투어 이름 추출
    tour_match = re.search(r'Insert (.+?)(?:\n|$)', content, re.IGNORECASE)
    tour_name = tour_match.group(1).strip() if tour_match else f"Tour {i}"
    
    combined_sql += f"""
-- ============================================
-- Tour {i}: {tour_name}
-- File: {filename}
-- ============================================

{content}

"""
    
    combined_sql += "\n-- ============================================\n\n"

# 검증 쿼리 추가
combined_sql += """
-- ============================================
-- Verification: Count all tours
-- ============================================
SELECT 
  COUNT(*) as total_tours,
  COUNT(DISTINCT city) as cities_covered,
  SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_tours
FROM tours;

-- List all tours
SELECT 
  id,
  title,
  slug,
  city,
  price,
  rating,
  review_count,
  is_active
FROM tours
ORDER BY city, created_at;
"""

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(combined_sql)

print(f"Combined SQL file created: {output_file}")
```

이 스크립트를 실행하면 `insert-all-tours-combined.sql` 파일이 생성됩니다.

## 방법 3: API를 사용한 대량 추가

Node.js 스크립트 예시:

```typescript
import fs from 'fs';
import path from 'path';

// 투어 데이터를 JSON 파일로 저장
const toursData = [
  {
    title: 'Jeju: Southern Top UNESCO Spots Bus Tour',
    slug: 'jeju-southern-top-unesco-spots-bus-tour',
    // ... 기타 필드
  },
  // ... 더 많은 투어
];

async function importTours() {
  for (const tour of toursData) {
    const response = await fetch('http://localhost:3000/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 쿠키 포함
      body: JSON.stringify(tour),
    });
    
    if (response.ok) {
      console.log(`✅ Imported: ${tour.title}`);
    } else {
      const error = await response.json();
      console.error(`❌ Failed: ${tour.title}`, error);
    }
  }
}

importTours();
```

## 추천 방법

1. **처음 한 번만**: 통합 SQL 스크립트 사용
2. **개별 추가**: 개별 SQL 파일 또는 API 사용
3. **자동화 필요**: API + 스크립트 사용

