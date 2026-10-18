-- Stories rejected by the AI relevance gate or removed by `npm run cleanup-articles`.
-- Only the identity and the reason are kept (not the article), so ingestion can
-- skip them without spending another AI call, and deleted articles don't come back.
-- Safe to re-run.

create table if not exists public.article_rejections (
  external_id text primary key,
  title text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Written and read with the service role only; no public policies
alter table public.article_rejections enable row level security;

notify pgrst, 'reload schema';
