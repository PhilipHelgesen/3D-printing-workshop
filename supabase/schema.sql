-- Nozzle — Supabase schema
-- Run once in Supabase dashboard → SQL Editor → New query → paste all → Run.

-- Single-row JSON blob: mirrors the localStorage shape exactly (State from
-- src/types.ts), so the sync layer is a straight upsert/select, no relational
-- mapping. One maker, one workshop — this is the whole schema.
-- ponytail: single row, no per-user rows. Upgrade path if this becomes
-- multi-user: add a `user_id` column and key the policy on auth.uid() instead
-- of the blanket `using (true)` below.
create table if not exists workshop (
  id text primary key default 'default',
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table workshop enable row level security;

-- Every policy below is scoped `to authenticated`. That clause is the whole
-- security boundary: omit it and a policy defaults to `to public`, which
-- includes `anon` — and the anon key ships inside the client bundle, so
-- `public` means anyone who opens devtools on the deployed site. The repo is
-- public; the unlisted URL was never a control.
--
-- `using (true)` is still right here: one account, one row, and it owns all of
-- it. Sign-in is src/ui/SignIn.tsx, and App.tsx won't mount the workshop
-- without a session, so no request is ever made as `anon`.
create policy "auth all workshop" on workshop for all
  to authenticated
  using (true) with check (true);

-- Toolbox icon uploads. Public bucket — icons aren't sensitive, and public
-- read means <img src> just works with no signed URLs.
insert into storage.buckets (id, name, public)
values ('icons', 'icons', true)
on conflict (id) do nothing;

-- Read stays anonymous on purpose: Toolbox.tsx renders icons as plain <img>,
-- which can't carry an auth header.
create policy "public read icons" on storage.objects for select
  using (bucket_id = 'icons');

-- Insert only. uploadIcon() writes to a fresh crypto.randomUUID() path every
-- time and nothing ever deletes, so update or delete rights would serve no
-- purpose except letting someone overwrite an existing icon.
create policy "auth upload icons" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'icons');

-- Not expressible as policies — set these on the bucket itself, in
-- Storage → icons → Settings:
--   file size limit    50 KB (the client downscales to ~2 KB; this is the ceiling)
--   allowed MIME types image/webp, image/png, image/jpeg
-- Excluding image/svg+xml is deliberate: an SVG is served from this project's
-- own origin and can carry script, and the client-side checks in src/icons.ts
-- are bypassed by anyone calling the Storage API directly.
