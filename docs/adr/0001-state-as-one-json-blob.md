# 1. Workshop state is one JSON blob, not a relational schema

Date: 2026-08-20
Status: Accepted

Recorded retroactively — the decision was made during the original build and had
only been visible in code comments until now.

## Context

The data is a workshop: builds, each holding parts, plus a toolbox. The obvious
Postgres shape is three tables with foreign keys. The client, though, holds the
whole workshop in one React state object — `State` in `src/types.ts` — because
every screen reads across the whole thing at once. The dashboard needs every
build's parts to compute batch groups; the build page needs the other builds to
say what batches with what.

So a relational schema would mean maintaining a mapping layer between the row
shape and the state shape, on both read and write, for a dataset of tens of
parts belonging to one person.

## Decision

One table, `workshop`, holding one row: `id text primary key`, `state jsonb`,
`updated_at`. The JSON in that column is exactly `State`. Syncing is one
`select` and one `upsert`, with no mapping in between.

## Consequences

- The sync layer in `src/store.ts` stays small enough to read in one sitting.
- Postgres enforces nothing about the shape. `types.ts` is the only schema, and
  the check script is the only thing that verifies it.
- **Migrations happen on read, in the client.** There is no `ALTER TABLE` for a
  field that changed meaning, so a rename is handled by normalising the blob as
  it loads — see `normalizePartStatus` in `src/store.ts`, which still maps the
  old `smoothing` status onto `sanding`. Anything that changes the shape of
  `State` needs the same treatment, and the old browsers' localStorage copies
  need it too.
- Querying the data from SQL is impractical. Nothing needs to today.
- This scales to one maker. Going multi-user means a `user_id` column and a
  policy keyed on `auth.uid()`; the upgrade path is noted in
  `supabase/schema.sql`. It does not mean going relational.
