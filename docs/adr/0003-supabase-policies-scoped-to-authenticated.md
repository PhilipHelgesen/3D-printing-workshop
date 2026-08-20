# 3. Every Supabase policy is scoped `to authenticated`

Date: 2026-08-20
Status: Accepted

Recorded retroactively. This one is a security boundary, so it is written down
to stop it being undone by someone who reads `using (true)` and concludes the
table is open by design.

## Context

The repo is public, and the Supabase anon key ships inside the client bundle —
that is what the anon key is for, and it is safe *only* because row level
security stands behind it. The deployed URL was never a control: anyone can read
the key out of the bundle on the live site.

A Postgres policy written without a `to` clause defaults to `to public`, and
`public` includes the `anon` role. So a policy that looks locked down can be
wide open to anyone with the key — which is everyone.

## Decision

Every policy on `workshop` and on icon uploads carries `to authenticated`.
There is one Supabase Auth user, email and password. `App.tsx` gates the entire
app on a session, so no request is ever made as `anon`.

`using (true)` inside those policies is correct: one account, one row, and it
owns all of it. The `to authenticated` clause is the boundary, not the `using`
expression.

Icon **reads** stay public on purpose — the toolbox renders icons as plain
`<img src>`, which cannot carry an auth header. Icons are not sensitive. Icon
writes are insert-only: `uploadIcon()` writes to a fresh UUID path every time
and nothing ever deletes, so update or delete rights would only let someone
overwrite an existing icon.

## Consequences

- **A new policy without `to authenticated` opens the workshop to the internet.**
  This is the failure mode to watch for in any schema change.
- The app cannot be used signed-out, including read-only. Accepted.
- Some of the boundary is not expressible as policy and lives in the Supabase
  dashboard instead: the `icons` bucket's file size limit and its allowed MIME
  types. `image/svg+xml` is excluded deliberately — an SVG is served from this
  project's own origin and can carry script, and the client-side checks in
  `src/icons.ts` are bypassed by anyone calling the Storage API directly. These
  settings are not in version control; `supabase/schema.sql` records what they
  must be.
- The `service_role` key must never appear in this repo. It bypasses RLS
  entirely, which would make every policy above irrelevant.
