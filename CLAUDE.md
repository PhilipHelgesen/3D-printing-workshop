# Nozzle — orientation for an AI working on this repo

A workshop tracker for one maker running several 3D-print builds at once. Its job
is to hold the state of every part so the maker doesn't have to, and to make
**batching** easy — doing the same operation (prime, sand, glue) on parts from
several builds in one setup.

Live: <https://3-d-printing-workshop.vercel.app> · Repo: `PhilipHelgesen/3D-printing-workshop`

This file is loaded into context automatically. Read it before editing; it records
the things the code alone doesn't tell you.

---

## Stack

| Piece | Choice | Notes |
| --- | --- | --- |
| Build | Vite 8 | `.claude/launch.json` runs it on port 5173 |
| UI | React 19 + TypeScript 7 | function components only, no class components |
| Styling | CSS variables + CSS Modules | no Tailwind, no CSS-in-JS, no UI library |
| Data | Supabase (Postgres + Storage) | one row of JSON, see below |
| Hosting | Vercel | auto-deploys `main` |
| Tests | one assert script | `npm run check`, no framework |

**No router, no state library, no component library.** Three screens don't justify
them. Don't add any without asking.

### Commands

```bash
npm run dev      # Vite dev server on :5173
npm run check    # runs the check files — after touching derive.ts, workshop.ts or persist.ts
npm run build    # tsc -b && vite build — must pass before pushing
```

`npm run check` executes TypeScript directly via Node's native type-stripping
(Node 25 here; needs 22.6+; CI pins 24). That's why the check files use `.ts`
import specifiers — so do all other imports in `src/`.

---

## Architecture

Layered so the rules can be read and tested without React:

```
types.ts        the data model, and nothing else
   ↑
derive.ts       pure read-side: progress, batch groups, next step, formatting
workshop.ts     pure write-side: (state, args) => state for every mutation
   ↑
store.ts        React glue — useState + localStorage + Supabase sync
   ↑
App.tsx         session gate, then screen switching, modal state, store wiring
   ↑
screens/        one file per screen + its modals; owns view state only
ui/             shared chrome: LeftRail, Modal, StatusPill, SignIn, ui.module.css
```

**The rule that matters: business logic never lives in a component.** If you're
about to write a state-shape change inside a screen, it belongs in `workshop.ts`.
If you're about to compute something from state for display, it belongs in
`derive.ts`. Both are plain functions, both are covered by `npm run check`.

Adding a feature usually means: one function in `workshop.ts`, one line in the
store's action object, one assert in `derive.check.ts`, then the UI.

### Files

- `types.ts` — `Part`, `Build`, `ToolboxEntry`, `State`, `Screen`.
- `derive.ts` — everything computed, never stored: `progressPct`, `statusPills`,
  `buildPlan`, `batchGroups`, `partRows`, `assemblyBadge`, `timeAgo`, …
- `workshop.ts` — `moveTo`, `advance`, `addPart`, `linkParts`, `saveEntry`, …
  Pure apart from `crypto.randomUUID()` / `new Date()`.
- `persist.ts` — the workshop copy's decisions, pure: `normalizeState`,
  `parseStored`, `shouldSkipPush`. Imports no React and no Supabase, so the check
  script can reach it (ADR-0004).
- `store.ts` — `useStore()`: state, persistence, and the bound action object.
- `seed.ts` — the mock workshop used on first load, plus the built-in icon swatches.
- `icons.ts` — downscales and uploads toolbox icons to Supabase Storage.
- `derive.check.ts` / `persist.check.ts` — the whole test suite. Plain
  `node:assert`; `npm run check` runs both.

---

## Data and persistence

State is **one JSON blob**, shaped exactly like `State` in `types.ts`:

```
Build[] → each has Part[]          ToolboxEntry[]
```

Two layers, in `store.ts`:

1. **localStorage** (`nozzle.v1`) — instant cache. Renders with no network wait,
   works offline, survives dev-server restarts (it's per browser origin).
2. **Supabase** — the shared copy, so any browser sees the same workshop.

Flow: pull once on mount (cloud wins if it has anything) → every later change is
written to localStorage immediately and pushed to Supabase after a 500 ms debounce.
A `cloudJson` ref tracks what the cloud already holds so we never echo back the
copy we just pulled. Last write wins; there's no conflict resolution, which is
fine for one maker on one device at a time.

### Supabase

Project `ninngfrzlbdyrsjksmog`. Schema lives in `supabase/schema.sql` — run it in
the SQL Editor if you ever rebuild the project.

- **Table `workshop`** — `id text pk` (always `'default'`), `state jsonb`,
  `updated_at timestamptz`. Single row. Deliberately not relational: the blob
  matches the client state shape, so syncing is one upsert and one select.
- **Bucket `icons`** — public read. Imported tool photos are downscaled to 104 px
  WebP client-side (~2 KB each) and stored as public URLs in `ToolboxEntry.iconId`.
  Anything starting with `http` or `data:` is an imported image; `a`/`b`/`c` are
  the built-in swatches.
- **Auth is required.** The repo is public and the anon key ships in the client
  bundle, so every policy is scoped `to authenticated` — a policy without that
  clause defaults to `to public`, which includes `anon`. One Supabase Auth user,
  email + password. `App.tsx` gates the whole app on a session, so nothing is
  ever requested as `anon`. Icon *reads* stay public because `<img src>` can't
  send a header.

### Environment

```
VITE_SUPABASE_URL        https://ninngfrzlbdyrsjksmog.supabase.co
VITE_SUPABASE_ANON_KEY   the publishable (anon) key
```

Locally in `.env.local` (gitignored). On Vercel, the same two names are set as
project environment variables — **a new env var must be added in both places or
the deployed build breaks while local keeps working.** The anon key is safe in the
client bundle by design; the `service_role` key must never appear in this repo.

### Vercel

Connected to the GitHub repo; pushing `main` triggers a build (`npm run build`)
and deploy. No `vercel.json` — the framework preset handles it. Nothing is
server-side: this is a static SPA that talks to Supabase from the browser.

---

## Domain rules

These are product decisions, not accidents. Don't "fix" them.

- **The pipeline is** `queued → printing → sanding → priming → painting → assembling → done`.
- **There is no `failed` status.** A broken part goes back to `queued`. Never add
  a failure state.
- **Any part can move to any step.** The Advance menu lists every other step —
  rework jumps backwards, and a part in assembling can go straight to painting.
- **There is no curing or "hands off" concept.** No cure timer, no print ETA, no
  part is ever unavailable — every part at a station is workable right now. The
  old `curingUntil` field was deleted along with everything that read it: it had
  no writer, so it only ever described mock data. Never re-add scheduling here.
- **Batch groups are cross-build** and only actionable at **3+ parts**
  (`BATCH_THRESHOLD`). The recommended group is the one clearing the most builds,
  count breaking ties.
- **A build plan** is the answer to "what do I do next on this build" — the
  operation, whether it batches with the other builds, and the parts it clears.
  `buildPlan(build, builds)` composes the whole card; the screens never assemble
  that wording or count themselves.
- **The workshop copy** is the rule governing how the local copy and the cloud
  copy of the workshop agree: pull once, cloud wins if it has anything, later
  changes go to localStorage at once and to the cloud on a debounce, never
  echoing back what was just pulled. It also covers **migrating a stored blob
  into state we trust** — a copy written by an older version is normalised on
  read, since there is no `ALTER TABLE` for a JSON blob (see ADR-0001). Last
  write wins (ADR-0002). Implemented in `store.ts`; described under *Data and
  persistence* above.
- **The cloud copy exists for device handoff, not collaboration.** One person
  uses this, one device at a time — at the bench, or on their phone planning for
  when they get home. Two devices, never at once. That's why last-write-wins is
  safe and why no conflict resolution is needed; it is not an unexamined
  shortcut. Never design for concurrent editors.
- **Assemblies**: parts sharing a `linkGroupId` should stay on the same step
  (e.g. gauntlet LED + finger + hand). Any size, not just pairs. Linking a part
  that already belongs to a group merges the two groups. A group of one is
  meaningless and gets pruned automatically — see `pruneLoneGroups`. The screens
  never read `linkGroupId`: `partRows` hands the parts list its rows already
  bracketed (a row is one part or one assembly, so sorting can't scatter a group)
  and `assemblyBadge` hands a row its badge. Rows are built from the *visible*
  parts; a part's siblings are looked up across the *whole build*, so a badge
  survives its siblings being filtered out of view.
- Everything derived (progress, counts, next step) is **computed, never stored**.

---

## Design

`design_handoff_nozzle/` holds the original spec. `README.md` in there is
self-sufficient and carries the full token set; `Print Tracker Dashboard.dc.html`
is the prototype — **turns 4, 5 and 6 only**, turns 1–3 are a superseded dark
palette. `DECISIONS.md` records what was agreed before implementation.

Design tokens (colors, radii, shadows, fonts) are CSS variables in `src/index.css`.
Use them; don't hardcode hex values. Each screen has its own `*.module.css`;
shared chrome lives in `ui/ui.module.css`.

The UI has since deliberately diverged from the handoff in places: the dashboard
lost its batch panel, per-card next-step block and materials card; the build page
lost its "For the next step" materials card; toolbox cards went horizontal; nav
lost Materials. **Materials are not modelled at all** — the old cards were
hardcoded placeholder lists and were deleted rather than left lying. The
handoff's "Curing — hands off" rail and the build page's "Waiting" card are gone
too, with the whole curing concept behind them. Current code wins over the
handoff where they disagree.

---

## Conventions

- Comments explain **why**, not what. A `ponytail:` prefix marks a deliberate
  shortcut with a known ceiling and its upgrade path — keep them, they're a debt
  ledger.
- Prefer deleting to adding. This codebase was reviewed down from ~3300 to ~2400
  lines; don't reintroduce speculative abstraction, factories, or interfaces with
  one implementation.
- No `React.memo`/`useCallback` unless a measured problem needs it. At this data
  size (tens of parts) it's noise. `useMemo` is used where it guards a real
  O(n) pass, not reflexively.
- Native platform features before dependencies: `window.prompt` for one-field
  edits, `<input type="file">` for uploads, CSS Grid over layout libraries.
- Accessibility isn't optional: modals carry `role="dialog"`/`aria-modal`,
  toggles carry `aria-pressed`, never nest interactive elements.

## Before you finish

1. `npm run check` — passes.
2. `npm run build` — passes (this is what Vercel runs).

   CI runs both on every push to `main` and every PR — `.github/workflows/ci.yml`.
   Don't rely on it to catch what you could have caught here; Vercel deploys off
   the same push.

3. Verify in the browser via the dev server; don't ask the user to check manually.
4. Only commit and push when asked.

## Agent skills

### Issue tracker

Local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Glossary is this file's **Domain rules** section — there is no `CONTEXT.md`.
Decisions are ADRs in `docs/adr/`. See `docs/agents/domain.md`.
