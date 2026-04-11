-- Migration: 20260410000000
-- Fix: user_profiles schema drift between production and CI
--
-- Context: The production user_profiles table was created via the Supabase
-- dashboard with a full column set. The baseline migration at
-- 20250101000000_baseline_schema.sql defined user_profiles with only two
-- columns (id, role). CI replays migrations from scratch, so the ephemeral
-- table has only those two columns. All call sites that reference email,
-- full_name, avatar_url, created_at, or updated_at hit Postgres error 42703
-- (column does not exist) in CI while production works correctly.
--
-- Fix: add the five missing columns using IF NOT EXISTS so this migration is
-- safe to apply against production (where the columns already exist) without
-- any conflict. No NOT NULL constraints are added here — production rows may
-- have been created before these columns existed and could have nulls.

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email       text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name   text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url  text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();
