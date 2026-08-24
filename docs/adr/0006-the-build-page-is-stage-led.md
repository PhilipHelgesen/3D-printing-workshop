# 6. The build page is stage-led

Date: 2026-08-24
Status: Accepted

## Context

The build page was designed to answer "how far along is this build". A grilling
session established that the maker asks it something else.

The real loop, in his words: he sits down at his desk having already decided
which operation he wants to do — sanding, say — and then hunts for the parts
that are ready for it. The page had no answer for that. Its filters were
All / Needs me / Done, and `StageFlow`, the card showing the count of parts at
each step, was inert. It displayed `SAND 6` and could not be clicked.

Two other findings came out of the same session:

- **`Build.deadline` had no writer.** Only `seed.ts` ever set it, so the header's
  "con in N days" line only ever described mock data. This is the same shape as
  the `curingUntil` field deleted earlier for the same reason.
- **The maker keeps nothing else outside the app.** Asked what a build needs
  that it doesn't have, he ruled out filament colour and model source URLs, and
  named one gap: a picture. Not a link to the model — an image he can see.

A prototype (`?proto=a|b|c`) put three layouts of the page in front of him with
these changes applied. He chose the tiles-first one.

## Decision

**Stages are how the page is filtered.** Clicking a stage in `StageFlow` shows
the parts at that step; clicking it again clears. `All` is the only other
filter — "Needs me" and "Done" were two more ways of saying what the stage
columns already say, and they are deleted.

**Tiles are the default view, the list is the toggle.** A build of 27 parts fits
on one screen as a field of colour, which is what "grasp the whole build"
actually needed. The list stays one click away, and it remains the only place
assemblies read as a group: a bracket cannot survive a grid reflow, so a tile
carries the link badge only.

**`Build.deadline` is deleted**, along with `daysUntil`, its only reader. A
stored blob written before this still carries the field; `normalizeState` strips
it, since there is no `ALTER TABLE` for a JSON blob (ADR-0001).

**`Build` gains `image` and `note`.** One photo — realistically the render from
the model listing or a slicer screenshot, since on day one there is no finished
object to photograph — shown in the left rail where the stats used to be. One
free-text note under the build name, edited in place the way the name already
is. Both replaceable, neither required.

**Seven stages now have seven colours.** `STATUS_TOKENS` previously mapped seven
statuses onto four tints: `queued` and `sanding` shared `--neutral`, `priming`
and `painting` shared `--lemon`, `assembling` and `done` shared `--basil`. In a
list the pill spells the stage out and the collision is invisible. In tiles the
colour *is* the message, so the wall of tiles was saying four things. Three new
tokens: `--stone` (queued, greyer and flatter than sanding), `--olive` (priming,
the cooler half of the yellow pair), `--indigo` (assembling, distinct from the
printing teal). `--basil` lightened for `done`.

**The rail's stat block is deleted.** Parts / Started / In queue — the maker
never read them, and two of the three are on the page already.

## Consequences

- The page answers the question the maker actually arrives with, in one click,
  using a card he already liked and a filter state that already existed.
- `Part` gains nothing. Per-part photos were considered and cut: with
  colour-and-name tiles there is nowhere to render one, and 27 manual uploads
  per build is the kind of data entry that dies in week two. If the tile view
  leaves him wanting pictures, that is a finding, and the field costs nothing to
  add then.
- The palette change is not confined to this page. `STATUS_TOKENS` feeds the
  dashboard pills and build cards too, so they get it as well. That is
  deliberate: the collision was never a tile-only problem, tiles just made it
  visible.
- `--neutral` and `--lemon` themselves are untouched, so the toolbox favourites
  chip, the `next` highlight in the Advance menu and the out-of-step link badge
  are unaffected.
- Image upload reuses `icons.ts`, which now takes a max edge instead of hard-coding
  104 px, and the existing `icons` bucket. A `photos` bucket would be tidier but
  is a manual console step plus new policies for what is only a name.
- Parts still advance one at a time. A tile opens the same Advance menu a row
  does; it is not a one-click advance, which would quietly reintroduce a bulk
  flow the domain rules forbid.

## What was rejected

**A 3D viewer showing the model with done parts green.** This was the maker's
stated wish and the blocker is data, not rendering. An STL is one mesh, not 27
named parts. Per-part STLs exist in most cosplay packs, but they ship laid out
flat on print plates — loading them gives a spinnable pile of parts on a virtual
bed, not a helmet with a green pauldron. Assembling 27 meshes into position is
manual 3D work per build, done in Blender, not here. It becomes cheap only given
an assembled multi-body 3MF per build with bodies named to match the parts.

**A build photo with pins per part**, green as parts finish. The literal version
of the same wish, and buildable — but it charges the maker 27 pin placements per
build, redone whenever parts change.

**Weighted progress.** Counting a part at `assembling` as most of a part was
proposed and rejected by the maker: the figure should report parts done, not
work done. `progressPct` is unchanged.

## When to reopen this

- If the tile view leaves him reaching for pictures of individual parts, add
  `Part.image` and a thumbnail. The crop-from-hero idea is the cheap source.
- If a build ever needs a real date, that is a new decision with its own ADR —
  not a field that survives by accident. Note that scheduling is otherwise
  banned in this app, so it starts from behind.
