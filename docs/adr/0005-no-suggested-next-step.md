# 5. No suggested next step — the app tracks, it doesn't advise

Date: 2026-08-21
Status: Accepted

## Context

The build page carried a NEXT STEP card. `buildPlan` composed it from a private
`suggestedNextStep`, which scanned a build's parts and named one operation: the
first non-empty of priming, assembling, sanding, falling back to the first
queued part as "Print next: …". The card also offered those parts as buttons to
tick off, and the dashboard donut borrowed the same function to pick its colour
— sea when the next move was a print, lemon when something waited on the maker.

The suggestion was wrong often enough to be ignored, and the reason is not a bug
in the ordering. Real builds carry constraints the state cannot express:

- A part can't be glued until another subassembly is finished. The card would
  happily list it as ready for glue-up.
- A part sometimes goes through assembly twice, so being at a step says nothing
  about whether the work there is done.
- Every build has its own small exceptions, and they live in the maker's head.

A fixed priority list can't encode any of that. It produced advice with the
confidence of a rule and the accuracy of a guess, which is worse than saying
nothing, because it invites you to check it before you can trust it.

## Decision

Delete the card, `buildPlan` and `suggestedNextStep`. The app's job is to show
where every part is, so the maker doesn't have to hold the whole workshop in
their head. Choosing what to do next is theirs.

`progressColor` keeps only the rule it can defend on its own: basil once a build
is at or above `NEARLY_DONE`, sea until then. No nag light.

Batching advice stays. `batchGroups` and the dashboard's recommended group are
a different claim, and a true one: these parts are all at the same station right
now, so one setup clears them. It counts what is, it doesn't predict what's next.

Part dependencies are deliberately not modelled — no prerequisites, no blocked
flag, not even a free-text "after the frame is glued" note. That is the same
scheduling idea this codebase has refused twice already (there is no curing
concept and no print ETA for the same reason).

## Consequences

The build page drops to two columns; its right rail held only this card.
`STATIONS.verb` is gone, having existed only to title it.

If a next-step suggestion is ever revisited, a priority list is not the answer —
that was tried here and this is why it failed. It would need to know what blocks
what, which means modelling dependencies between parts first, and that decision
should be made on its own merits rather than smuggled in as a card.
