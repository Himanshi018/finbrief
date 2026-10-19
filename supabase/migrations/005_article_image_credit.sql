-- Photographer credit for stock photos (Pexels) used when the feed has no thumbnail.
-- Pexels asks for visible attribution: the UI shows "Photo: <name> / Pexels".
-- Null for publisher photos (feed thumbnail or og:image). Safe to re-run.

alter table public.articles
  add column if not exists image_credit_name text,
  add column if not exists image_credit_url text;

-- Refresh PostgREST's schema cache so the API sees the new columns immediately
notify pgrst, 'reload schema';
