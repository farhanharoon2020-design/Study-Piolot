-- Run once in the Supabase SQL Editor before deploying study_ai.
create table if not exists public.ai_generations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  kind text not null check (kind in ('notes', 'quiz', 'topics')),
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_generations enable row level security;
create policy "Read own AI generations" on public.ai_generations
  for select to authenticated using (user_id = auth.uid());
create policy "Create own AI generations" on public.ai_generations
  for insert to authenticated with check (
    user_id = auth.uid()
    and (course_id is null or exists (
      select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()
    ))
    and (material_id is null or exists (
      select 1 from public.materials m where m.id = material_id
      and m.user_id = auth.uid() and m.course_id = ai_generations.course_id
    ))
  );
grant select, insert on public.ai_generations to authenticated;
create index if not exists ai_generations_user_created
  on public.ai_generations(user_id, created_at desc);
