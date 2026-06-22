-- Chatbot RAG: unified knowledge index over all site content.
-- Phase 0 of the chatbot RAG + learning upgrade (docs/chatbot-rag-learning-master-plan-2026-06-23.md).
-- Embeddings are OpenAI text-embedding-3-small (1536 dims) to match existing embedding columns.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists public.knowledge_chunks (
  id            bigint generated always as identity primary key,
  source_type   text not null check (source_type in ('poi','tour_product','site','policy','qa')),
  source_id     text not null,
  chunk_index   int  not null default 0,
  locale        text not null,
  title         text,
  content       text not null,
  url           text,
  tags          text[] not null default '{}',
  metadata      jsonb  not null default '{}'::jsonb,
  content_hash  text   not null,
  embedding     vector(1536),
  token_count   int,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (source_type, source_id, locale, chunk_index)
);

comment on table public.knowledge_chunks is
  'Unified RAG index over POI KB, tour products, site knowledge, policies, and approved Q&A. Embedded with OpenAI text-embedding-3-small.';

-- Vector similarity (cosine) for semantic retrieval.
create index if not exists knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Keyword fallback / hybrid trigram search on content.
create index if not exists knowledge_chunks_content_trgm
  on public.knowledge_chunks using gin (content gin_trgm_ops);

-- Tag filtering.
create index if not exists knowledge_chunks_tags_gin
  on public.knowledge_chunks using gin (tags);

-- Source/locale narrowing for the match RPC.
create index if not exists knowledge_chunks_source_locale
  on public.knowledge_chunks (source_type, locale, is_active);

-- updated_at touch trigger.
create or replace function public.touch_knowledge_chunks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_knowledge_chunks_touch on public.knowledge_chunks;
create trigger trg_knowledge_chunks_touch
  before update on public.knowledge_chunks
  for each row execute function public.touch_knowledge_chunks_updated_at();

-- Service-role only (matches support/chat tables). RLS on, no public policies.
alter table public.knowledge_chunks enable row level security;

-- Vector retrieval RPC. Returns cosine similarity (1 = identical).
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  p_locale        text default null,
  p_source_types  text[] default null,
  match_count     int default 8,
  min_similarity  float default 0.0
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
  similarity   float
)
language sql
stable
as $$
  select
    c.id, c.source_type, c.source_id, c.locale, c.title, c.content,
    c.url, c.tags, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  where c.is_active
    and c.embedding is not null
    and (p_source_types is null or c.source_type = any (p_source_types))
    and (p_locale is null or c.locale = p_locale)
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_knowledge_chunks is
  'Cosine-similarity retrieval over knowledge_chunks for chatbot RAG. Service-role only.';

-- Pin search_path (silences function_search_path_mutable advisor).
alter function public.touch_knowledge_chunks_updated_at() set search_path = public;
alter function public.match_knowledge_chunks(vector, text, text[], int, float) set search_path = public;
