# 4. No seam under the workshop copy — pure functions instead

Date: 2026-08-21
Status: Accepted

## Context

The workshop copy — pull once, cloud wins if it has anything, later changes go
to localStorage at once and to the cloud on a debounce, never echoing back what
was just pulled — was the one rule in the repo with no test surface, because its
interface was a React hook. An architecture review raised deepening it: move the
rule behind a plain interface taking its two stores as arguments, with a fake in
the check script as the second adapter.

The review stated its own condition honestly: one real adapter plus a test fake
is a *hypothetical* seam, so this is worth it only if the sync rule keeps
changing, or if the lack of conflict resolution ever gets cashed in.

Neither condition holds.

**The rule has never been revised.** `store.ts` has been touched by five
commits. Three added actions to the bound actions object, one moved business
rules out to `workshop.ts`, and one added the `smoothing → sanding` migration.
The pull-once/sentinel/debounce/echo-suppression rule was written once and has
not been edited since.

**Conflict resolution is settled, not deferred.** The cloud copy exists for
device handoff, not collaboration: one person, at the bench or on their phone
planning for later, sequentially, never concurrently. ADR-0002 records this.

## Decision

No seam. No adapters, no fake, no injected clock.

Instead, the decisions the rule makes were extracted into `src/persist.ts` as
pure functions and covered directly by `src/persist.check.ts`:

- `normalizeState` — migrating a stored blob into state we trust
- `parseStored` — the stored copy, or a fresh workshop when nothing is readable
- `shouldSkipPush` — the three-state sentinel, as the guard at the top of the
  push effect

`persist.ts` imports neither React nor `supabase.ts`. That is not a style
choice: `supabase.ts` reads `import.meta.env` at module load, which is a Vite
construct with no Node equivalent, so anything importing `store.ts` from a check
script dies before the first assert. The test surface dictated the module
boundary.

`store.ts` keeps the two effects, the Supabase calls, and the actions object.

## Consequences

- Every decision the rule makes is now assertable by `npm run check`: the
  migration, the corrupt-blob fallback, and all three sentinel states.
- **The wiring is still untested.** These functions test the decisions, not that
  they are called. Deleting the `shouldSkipPush` guard from the effect, or
  reordering the two effects, would keep the check green and still ship a bug.
  Accepted: the wiring is nine lines that a reviewer sees, and the decisions were
  the subtle part.
- Three scenarios remain uncovered, all of which would need the seam: the cloud
  winning on mount, a failed push leaving work usable, and rapid changes
  collapsing into one push after 500 ms.
- One new file, which is the cost. It earns its place through the Node
  constraint above rather than through taste.

## When to reopen this

Build the seam if either condition the review named actually arrives:

- the workshop copy starts changing regularly, rather than being written once, or
- concurrent editing becomes real, which would mean revisiting ADR-0002 first.

Until then, an architecture review that re-proposes this seam is re-running an
argument that has already been had.
