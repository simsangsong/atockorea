-- Chatbot RAG: trigram (pg_trgm) lexical retrieval to pair with vector search.
-- Fused with match_knowledge_chunks via RRF in lib/rag/retrieve.ts.

create or replace function public.keyword_knowledge_chunks(
  q              text,
  p_source_types text[] default null,
  match_count    int default 24
)
returns table (
  id           bigint,
  source_type  text,
  source_id    text,
  locale       text,
  title        text,
  content      text,
  url          text,
  tags         text[],
  metadata     jsonb,
  score        float
)
language sql
stable
set search_path = public
as $$
  select
    c.id, c.source_type, c.source_id, c.locale, c.title, c.content,
    c.url, c.tags, c.metadata,
    word_similarity(q, c.content) as score
  from public.knowledge_chunks c
  where c.is_active
    and (p_source_types is null or c.source_type = any (p_source_types))
    and q <% c.content
  order by word_similarity(q, c.content) desc
  limit match_count;
$$;

comment on function public.keyword_knowledge_chunks is
  'Trigram (pg_trgm) lexical retrieval over knowledge_chunks for chatbot RAG hybrid search. Service-role only.';
