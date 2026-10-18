-- Adds AI-generated fields to databases created from an older 001_initial_schema.sql.
-- Safe to re-run.

alter table public.articles
  add column if not exists why_it_matters text,
  add column if not exists key_terms jsonb;

-- Refresh PostgREST's schema cache so the API sees the new columns immediately
notify pgrst, 'reload schema';
