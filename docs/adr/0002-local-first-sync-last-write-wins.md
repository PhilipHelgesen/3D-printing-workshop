# 2. localStorage first, debounced push to Supabase, last write wins

Date: 2026-08-20
Status: Accepted

Recorded retroactively — the decision was made during the original build and had
only been visible in code comments until now.

## Context

The workshop is used standing at a bench, on a phone or a laptop, sometimes on
bad wifi. Waiting on a network round-trip before the parts list renders would be
the wrong trade for a tool you glance at between operations.

There is one maker, who in practice uses one device at a time.

## Decision

Two layers, both in `src/store.ts`:

1. **localStorage (`nozzle.v1`)** is the instant cache. The app renders from it
   with no network wait and keeps working offline.
2. **Supabase** holds the shared copy. It is pulled once on mount and wins if it
   returns anything; every later change is written to localStorage immediately
   and pushed to the cloud after a 500 ms debounce.

A `cloudJson` ref tracks what the cloud is known to hold, so the copy just
pulled is never echoed back.

**There is no conflict resolution.** The last write wins.

## Consequences

- Two devices editing the same workshop at the same time will silently clobber
  each other. Accepted: one maker, one device at a time.
- A failed push is a `console.warn`, not a retry and not a visible error. Work
  continues against localStorage, and the next change re-attempts the push.
- Clearing site data on a device that is offline loses whatever it held that the
  cloud had not yet received.
- The upgrade path, if concurrent multi-device editing is ever needed, is a
  `version` column plus a check on write — not a rewrite of the sync layer.
- This path has no automated test surface. Whether that is worth a seam and a
  test fake is an open question, raised as a candidate in the architecture
  review and deliberately left out of scope by
  `.scratch/assembly-module/spec.md`.
