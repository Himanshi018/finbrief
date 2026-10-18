-- FinBrief initial schema (Supabase / PostgreSQL)

create extension if not exists "pgcrypto";

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- News sources (publisher)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  created_at timestamptz not null default now()
);

-- Articles
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  url text not null unique,
  description text,
  summary text,
  why_it_matters text,
  key_terms jsonb,
  image_url text,
  category_id uuid references public.categories (id) on delete set null,
  source_id uuid references public.sources (id) on delete set null,
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

create index if not exists articles_category_published_idx
  on public.articles (category_id, published_at desc);

-- Future: authenticated users (links to Supabase Auth when enabled)
create table if not exists public.users (
  id uuid primary key,
  email text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: saved articles / bookmarks
create table if not exists public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create index if not exists saved_articles_user_idx
  on public.saved_articles (user_id, created_at desc);

-- Seed categories
insert into public.categories (slug, name, sort_order) values
  ('markets', 'Markets', 1),
  ('startups', 'Startups', 2),
  ('economy', 'Economy', 3),
  ('fintech', 'Fintech', 4),
  ('ai-business', 'AI Business', 5),
  ('global-finance', 'Global Finance', 6)
on conflict (slug) do nothing;

-- RLS: public read for articles; writes via service role only
alter table public.categories enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.users enable row level security;
alter table public.saved_articles enable row level security;

create policy "Categories are publicly readable"
  on public.categories for select using (true);

create policy "Sources are publicly readable"
  on public.sources for select using (true);

create policy "Articles are publicly readable"
  on public.articles for select using (true);
