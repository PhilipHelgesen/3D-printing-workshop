# List drag and drop

Status: done — shipped in 3538e29

The build page's list view lets the maker reorder parts and change assembly
membership by dragging.

## Settled behaviour

- **Reordering only under `Sort: Manual`.** Under any other sort the drop still
  applies membership (join/leave an assembly) but never position.
- **Rows and whole assemblies are both draggable.** An assembly is dragged by
  its head and moves as one block; a part can be dropped above or below an
  assembly panel without joining it, or onto the panel to join it.
- **Dropping a member onto a loose row unlinks it** from its assembly.
- **The held thing is what animates.** A part flies as a copy of its row minus
  the timestamp and the Advance button; an assembly flies as the whole panel.
  The flying part's *width* animates (150ms) between list width and member
  width as it moves in and out of an assembly. Nothing else about it changes.
- Mouse only. No keyboard sensor. The whole row is the drag handle, with 5px of
  slop so a click still opens the Advance menu. An assembly head keeps both its
  collapse job and its drag job.
- Built on `@dnd-kit/core` (approved dependency). The write side is pure:
  `reorderPart` and `reorderGroup` in `workshop.ts`, covered by
  `derive.check.ts`.

- **The list makes real room.** The slot in hand collapses to nothing and a hole
  its size opens at the seam the drop would take. Both are the same size and only
  ever open together, so the list never changes height mid-drag — the drop
  targets are measured once, at lift-off, and a page scroll would land the part a
  row off.

## Closed

- `issues/01-rows-part-for-the-drop.md` — done.
