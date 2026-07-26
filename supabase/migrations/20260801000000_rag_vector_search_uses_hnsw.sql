-- RAG 벡터 검색이 19MB HNSW 인덱스를 한 번도 안 쓰고 있었다.
--
-- 라이브에는 이미 적용됐다(2026-07-26, MCP). 이 파일은 그 상태를 레포에 고정한다.
--
-- 근거 (프로덕션 실측):
--   pg_stat_user_indexes  knowledge_chunks_embedding_hnsw  idx_scan = 0   (19 MB)
--   pg_stat_user_tables   knowledge_chunks  seq_scan 1561 · seq_tup_read 2,887,026
--   pg_stat_statements    이 RPC  mean 75ms × 1518콜 = DB 시간 118초
--
-- 1120행짜리 테이블이 56MB인 이유는 행마다 1536차원 벡터가 붙어서다. 매 질의가
-- 그걸 전부 읽고 1120번 거리 계산을 했다.
--
-- 원인이 세 겹이었고, 하나씩 벗겨야 보였다. 실패한 시도를 남긴다 — 다음 사람이
-- 같은 순서로 세 번 더 시도하지 않도록:
--
--   시도 1  set enable_seqscan=off              buffers 16,969 → 12,084 (비트맵으로 바뀌었을 뿐)
--   시도 2  + ANN 먼저 / 임계값 나중            buffers 15,403 (함수 안에서는 변화 없음)
--   시도 3  + plan_cache_mode=force_custom_plan buffers 15,403 (변화 없음)
--   최종    plpgsql + execute ... using         buffers    892  ← 19배
--
-- 진짜 원인 세 가지:
--   ① `min_similarity` 가 **거리식 자체에 걸린 잔여 필터**라 ORDER BY 인덱스
--      경로를 쓸 수 없었다. → ANN 을 먼저 끝내고 임계값을 밖에서 건다.
--   ② 후보 풀 24 에서는 전수 스캔이 더 싸다고 계산됐다(limit 8 은 인덱스를 탔다).
--   ③ `LANGUAGE sql` 함수 본문이 **제네릭 플랜**으로 캐시된다. `limit $4` 는 계획
--      시점에 값이 없어 플래너가 전수 스캔을 골랐다. 함수 단위 SET 으로는 안 뒤집힌다.
--      → plpgsql + `execute ... using` 으로 매 호출 실제 값으로 계획한다.
--      값은 전부 USING 으로 넘어가므로 문자열 조립이 없고 주입 표면도 없다.
--
-- 결과가 안 바뀌는 근거:
--   ① 임계값을 넘는 행은 못 넘는 행보다 항상 더 유사하다. 따라서 "통과분의 상위 k"
--      와 "상위 k 중 통과분" 은 같은 집합이다(통과분이 k개 미만일 때도).
--   ② 실측 대조 — 브루트포스 상위 24와 이 함수의 상위 24가 **id 목록·순서까지 동일**.
--   적용 후 idx_scan 0 → 10.
--
-- ⚠ 남은 한계: p_locale/p_source_types 가 non-null 이면 ANN 뒤 잔여 필터로
--    match_count 보다 적게 올 수 있다(ANN+필터의 고전 문제). 지금 앱은
--    p_locale=null 로만 부른다(lib/rag/retrieve.ts — 로케일은 fusion 단계).

create or replace function public.match_knowledge_chunks(
  query_embedding vector,
  p_locale text default null::text,
  p_source_types text[] default null::text[],
  match_count integer default 8,
  min_similarity double precision default 0.0
)
returns table(
  id bigint, source_type text, source_id text, locale text, title text,
  content text, url text, tags text[], metadata jsonb, similarity double precision
)
language plpgsql
stable
set search_path to 'public'
set enable_seqscan to 'off'
as $function$
begin
  return query execute $q$
    select t.id, t.source_type, t.source_id, t.locale, t.title, t.content,
           t.url, t.tags, t.metadata, t.similarity
    from (
      select
        c.id, c.source_type, c.source_id, c.locale, c.title, c.content,
        c.url, c.tags, c.metadata,
        1 - (c.embedding <=> $1) as similarity
      from public.knowledge_chunks c
      where c.is_active
        and c.embedding is not null
        and ($3 is null or c.source_type = any ($3))
        and ($2 is null or c.locale = $2)
      order by c.embedding <=> $1
      limit $4
    ) t
    where t.similarity >= $5
  $q$
  using query_embedding, p_locale, p_source_types, match_count, min_similarity;
end;
$function$;

comment on function public.match_knowledge_chunks is
  'RAG 벡터 검색. plpgsql + execute...using 인 이유는 오직 하나 — SQL 함수의 제네릭 플랜이 limit $4 때문에 HNSW 인덱스를 버리고 1120행 전수 스캔을 골랐기 때문이다(2026-07-26 이전 idx_scan=0). 버퍼 16,969→892. 브루트포스와 상위 24 동일 확인.';
