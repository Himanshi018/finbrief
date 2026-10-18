-- Plain-English headline generated alongside summary / why_it_matters / key_terms.
-- Null until generated; the UI falls back to the original `title`.
-- Safe to re-run.

alter table public.articles
  add column if not exists simple_title text;

-- Refresh PostgREST's schema cache so the API sees the new column immediately
notify pgrst, 'reload schema';
