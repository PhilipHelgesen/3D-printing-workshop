-- Nozzle — Supabase schema
-- Run once in Supabase dashboard → SQL Editor → New query → paste all → Run.

-- Single-row JSON blob: mirrors the localStorage shape exactly (State from
-- src/types.ts), so the sync layer is a straight upsert/select, no relational
-- mapping. One maker, one workshop — this is the whole schema.
-- ponytail: single row, no per-user rows. Upgrade path if this becomes
-- multi-user: add a `user_id` column + Supabase Auth + RLS keyed on auth.uid().
create table if not exists workshop (
  id text primary key default 'default',
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table workshop enable row level security;

-- No auth yet — anyone with the anon key (i.e. anyone with the deployed URL)
-- can read/write. Fine for a single-maker tool behind an unlisted URL.
-- ponytail: tighten to Supabase Auth + per-user policy if this is ever shared.
create policy "anon read workshop" on workshop for select using (true);
create policy "anon write workshop" on workshop for insert with check (true);
create policy "anon update workshop" on workshop for update using (true);

-- Toolbox icon uploads. Public bucket — icons aren't sensitive, and public
-- read means <img src> just works with no signed URLs.
insert into storage.buckets (id, name, public)
values ('icons', 'icons', true)
on conflict (id) do nothing;

create policy "anon read icons" on storage.objects for select
  using (bucket_id = 'icons');
create policy "anon upload icons" on storage.objects for insert
  with check (bucket_id = 'icons');
create policy "anon delete icons" on storage.objects for update
  using (bucket_id = 'icons');
