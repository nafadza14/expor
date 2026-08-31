-- EksporIn | Supabase setup
--
-- Jalankan seluruh skrip ini di Supabase SQL Editor (Dashboard > SQL Editor > New query > Paste > Run).
-- Skrip ini membuat tabel `profiles` untuk menyimpan data onboarding, mengaktifkan RLS,
-- dan memasang trigger otomatis agar setiap user baru mendapat baris profile kosong.
--
-- Setelah ini selesai, buka Authentication > Providers > Email dan pastikan:
--   - "Enable Email provider" ON
--   - "Confirm email" bisa dimatikan untuk development (agar signup langsung bisa login).

-- 1) Tabel profile
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  name           text,
  org_name       text,
  hs_focus       jsonb default '[]'::jsonb,      -- kode HS yang menjadi fokus user (maks 5)
  target_countries jsonb default '[]'::jsonb,    -- daftar kode negara target
  export_status  text,                            -- never | occasional | regular
  goal           text,                            -- find_buyers | market_analysis | competitor_intel
  plan           text default 'free',             -- free | starter | growth | business
  onboarded      boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 2) Row Level Security: user hanya boleh baca/tulis profilnya sendiri
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own"   on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_read_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3) Trigger: buat baris profile otomatis saat user baru signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, org_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'org_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) updated_at helper (opsional, biar tanggal update otomatis)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
