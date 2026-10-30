-- ============================================================
-- StudyPilot Supabase Database & Storage Setup
-- Run this entire script in your Supabase Project -> SQL Editor
-- ============================================================

-- Enable pgcrypto / uuid generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES TABLE
-- Stores student profile and preferences linked to auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text default '',
  degree text default '',
  semester text default '',
  study_time text default '',
  study_duration text default '',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: Automatically create public.profiles row on auth user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(excluded.name, profiles.name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. COURSES TABLE
-- Stores user courses
-- ============================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text default '',
  exam_date text default '',
  priority text default 'medium',
  difficulty text default 'medium',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS for courses
alter table public.courses enable row level security;

create policy "Users can view their own courses"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Users can create their own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own courses"
  on public.courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own courses"
  on public.courses for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. SYLLABI TABLE
-- Stores course syllabus (pasted text or uploaded document reference)
-- ============================================================
create table if not exists public.syllabi (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('text', 'file')),
  text text default '',
  file_name text default '',
  file_path text default '',
  file_size bigint default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS for syllabi
alter table public.syllabi enable row level security;

create policy "Users can view their own syllabi"
  on public.syllabi for select
  using (auth.uid() = user_id);

create policy "Users can insert their own syllabi"
  on public.syllabi for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own syllabi"
  on public.syllabi for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own syllabi"
  on public.syllabi for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 4. TOPICS TABLE
-- Stores topics for each course (split/merge/ordering)
-- ============================================================
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  difficulty text default 'medium',
  weightage text default 'medium',
  order_index integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS for topics
alter table public.topics enable row level security;

create policy "Users can view their own topics"
  on public.topics for select
  using (auth.uid() = user_id);

create policy "Users can insert their own topics"
  on public.topics for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own topics"
  on public.topics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own topics"
  on public.topics for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 5. MATERIALS TABLE
-- Stores study materials metadata (files stored in Supabase Storage)
-- ============================================================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime_type text default 'application/octet-stream',
  size bigint default 0,
  storage_path text not null,
  uploaded_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS for materials
alter table public.materials enable row level security;

create policy "Users can view their own materials"
  on public.materials for select
  using (auth.uid() = user_id);

create policy "Users can insert their own materials"
  on public.materials for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own materials"
  on public.materials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own materials"
  on public.materials for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 6. AI NOTES TABLE (Optional Cloud Sync)
-- Stores AI generated study notes
-- ============================================================
create table if not exists public.ai_notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_name text not null,
  title text not null,
  style text default 'comprehensive',
  markdown text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.ai_notes enable row level security;
create policy "Users can manage their own notes" on public.ai_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 7. QUIZ RESULTS TABLE (Optional Cloud Sync)
-- Stores scorecards and progress
-- ============================================================
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_name text not null,
  score integer not null,
  total integer not null,
  percentage integer not null,
  difficulty text default 'medium',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.quiz_results enable row level security;
create policy "Users can manage their own quiz results" on public.quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================
-- 6. STORAGE BUCKET & POLICIES
-- Bucket name: studypilot-materials
-- ============================================================
insert into storage.buckets (id, name, public)
values ('studypilot-materials', 'studypilot-materials', false)
on conflict (id) do nothing;

-- Storage RLS: Users can only upload, read, and delete within their own user folder (userId/...)
drop policy if exists "Authenticated users can upload materials" on storage.objects;
create policy "Authenticated users can upload materials"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'studypilot-materials' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Authenticated users can view own materials" on storage.objects;
create policy "Authenticated users can view own materials"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'studypilot-materials' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Authenticated users can delete own materials" on storage.objects;
create policy "Authenticated users can delete own materials"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'studypilot-materials' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Authenticated users can update own materials" on storage.objects;
create policy "Authenticated users can update own materials"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'studypilot-materials' and auth.uid()::text = (storage.foldername(name))[1]);
