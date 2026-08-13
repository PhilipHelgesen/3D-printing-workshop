# Nozzle — build decisions

Agreed before implementation started. Source design: `design_handoff_nozzle/`.

| Decision | Choice |
| --- | --- |
| Stack | Vite + React + TypeScript |
| Styling | CSS variables + CSS Modules |
| Persistence | localStorage, seeded from mock data on first load |
| Scope | The three approved screens only |

## Scope detail

**In:** Dashboard (`4a`), Build detail (`5a`), Toolbox (`6a` rest / `6b` edit modal / `6c` create modal).

**Out:** The batch session screen behind "Enter workbench ▸" — it is only designed in the superseded dark-industrial direction (turn 2). Materials is a nav placeholder; it was never designed.

## Reading the handoff

`design_handoff_nozzle/README.md` is self-sufficient and carries the full token set. `Print Tracker Dashboard.dc.html` holds the prototype markup — **turns 4, 5 and 6 only**. Turns 1–3 are superseded explorations in a dark palette; ignore them.

## Two rules that are deliberate, not oversights

- **There is no `failed` part status.** If a part breaks, the maker moves it back to `queued`. Do not add a failure state.
- **`batchGroups()` is cross-build**, and a group is actionable only at **≥3 parts**. Below the threshold it renders greyed with "N of 3 — not worth setting up yet" and is not interactive.

## Where the build departs from the mock, and why

The prototype's own numbers don't reconcile: the four builds' status pills account for
every non-done part, yet the "Ready to batch" tiles need 18 parts standing at manual
stations. Everything on screen is derived from one seeded dataset (`src/seed.ts`), so
something had to give. Kept exactly: 62 parts / 31 done, each build's total and done
count, the 5a stage flow (1·2·3·2·0·0·18), the station tiles 5 / 7 / 4 / 2 with AIRBRUSH
below threshold, and SPRAY PRIMER as the recommended batch. Adjusted: Hunter Helmet and
Pip-Boy Cuff hold fewer queued parts than their mock pills show, so those manual-station
parts exist somewhere.

- **Donut color** follows the README's stated rule (≥85% basil · manual next step lemon ·
  otherwise sea), not the prototype's swatches, which contradict it on two cards.
- **DONE pill** appears once a build is ≥85% done — the mock shows it on Energy Sword only.
- **Advance ▾** lists every step still ahead of the part; the mock skipped Assembling,
  which would leave no route into it.
- **"Print next: …"** doesn't appear at seed — every build has manual work queued ahead of
  its prints. It renders as soon as one is cleared.
- **Enter workbench ▸** runs the recommended batch directly; the session screen it belongs
  to is out of scope (see above).
- Rename / notes / delete / add part / new build use native prompts — no dialogs designed.

## Fidelity

The handoff states colors, type, spacing and states are final and asks for pixel-accurate reproduction. Build the token layer verbatim from the README rather than approximating. Only `ILLUSTRATION` and `ICON` slots are placeholders.
