# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CLAUDE.md`** at the repo root. **This repo has no `CONTEXT.md`, deliberately.**
  `CLAUDE.md` is the glossary — its **Domain rules** section defines the pipeline,
  what an assembly is, what a build plan is, and which product decisions are not
  to be "fixed". A second glossary file would drift from it, and `CLAUDE.md` has
  the advantage of being loaded into context automatically every session.
  Where a skill says `CONTEXT.md`, read `CLAUDE.md` and write back to it.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

Split the glossary out into `CONTEXT.md` only if `CLAUDE.md` grows big enough
that carrying it on every session stops paying for itself. It hasn't.

If a file named here doesn't exist, **proceed silently**. Don't flag its absence;
don't suggest creating it upfront. The `/domain-modeling` skill (reached via
`/grill-with-docs` and `/improve-codebase-architecture`) creates ADRs lazily when
decisions actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── CLAUDE.md          the glossary (no CONTEXT.md — see above)
├── docs/adr/
│   ├── 0001-state-as-one-json-blob.md
│   ├── 0002-local-first-sync-last-write-wins.md
│   └── 0003-supabase-policies-scoped-to-authenticated.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CLAUDE.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (state as one JSON blob), but worth reopening because…_
