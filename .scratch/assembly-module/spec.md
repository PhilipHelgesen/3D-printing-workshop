# Gather the assembly rules into one module

Status: done — shipped in 075b9b6

## Problem Statement

The maker links parts into an assembly — gauntlet LED, finger and hand — so the workshop
keeps them together and flags when one falls behind the others. That feature works, but the
rules behind it are spread across the derive module, the workshop module, the build detail
screen, the part row and the app shell. Five places, one concept.

Two consequences reach the maker:

- An assembly can be drawn as a broken bracket. The parts list pulls assembly members
  together, then cuts the list at a fixed length. When an assembly straddles that cut, the
  bracket is drawn over the visible half and the rest appears below the "show more" line,
  as if the assembly ended there.
- The rules can drift apart. The app shell works out an assembly's members by hand instead
  of asking the derive module, so the same question has two answers in the codebase and
  nothing keeps them in step. This is the shape of defect that the next-step card already
  had before it was collapsed into the build plan.

For anyone changing this code — human or agent — understanding "what is an assembly and how
does it behave" means reading five files and reconstructing an unwritten contract between two
of them: the derive module orders members adjacently, and the screen re-discovers those runs
with an index loop in its render body. Neither the contract nor the loop can be reached by the
project's check script, so the only way to test bracketing today is to look at a browser.

## Solution

One module answers everything about assemblies, and the screens stop knowing that a link
group id exists.

The parts list asks for its rows and gets them already bracketed: a row is either a single
part or a run of parts that belong to one assembly. The part row asks for its badge and gets
the tooltip text and whether the assembly is in step. The link modal asks for an assembly's
members and the parts it could still link, instead of filtering by link group id itself.

Paging counts rows rather than parts, so an assembly is never cut in half.

From the maker's side almost nothing changes, which is the point — one visible fix (the
broken bracket) and no new behaviour. What changes is that every assembly rule sits behind a
single interface, covered by the project's existing check script, in the file an agent will
already be reading.

## User Stories

1. As a maker, I want the parts of one assembly to appear next to each other in the parts
   list, so that I can see at a glance which parts belong together.
2. As a maker, I want a single bracket drawn beside the whole assembly, so that its extent is
   obvious without reading each row.
3. As a maker, I want that bracket to span every member of the assembly, so that it never
   suggests an assembly is smaller than it is.
4. As a maker, I want an assembly to stay whole when the parts list is truncated, so that
   paging never appears to break up a group I created.
5. As a maker, I want the "show more" control to tell me how many parts are still hidden, so
   that the count means the same thing after the change as before it.
6. As a maker, I want assembly members to stay adjacent when I sort by progress, so that
   sorting never scatters a group across the list.
7. As a maker, I want assembly members to stay adjacent when I sort by recency, so that the
   grouping is a property of the list rather than of one sort mode.
8. As a maker, I want assembly members to stay adjacent when I filter to "needs me" or
   "done", so that filtering never scatters a group either.
9. As a maker, I want a linked part to carry a badge, so that I can tell it belongs to an
   assembly without opening a menu.
10. As a maker, I want the badge to name the other parts in the assembly, so that I know what
    it is linked to without navigating away.
11. As a maker, I want the badge to change appearance when a member has fallen behind the
    others, so that drift is visible in the list itself.
12. As a maker, I want the badge to name which members are behind and which step they are on,
    so that I know what to catch up without hunting for them.
13. As a maker, I want a part to carry its badge even when its siblings are filtered out of
    view, so that hiding done parts never makes a part look unlinked.
14. As a maker, I want the link modal to list the parts already in this assembly, so that I
    can see the group before changing it.
15. As a maker, I want the link modal to offer only parts not already in the assembly, so
    that I cannot add the same part twice.
16. As a maker, I want linking a part that already belongs to an assembly to merge the two
    assemblies, so that I never end up with two groups that should be one.
17. As a maker, I want removing a member from an assembly of two to clear the badge from the
    remaining part, so that I am never shown an assembly of one.
18. As a maker, I want deleting a part to have the same effect on a leftover member, so that
    the rule holds however the assembly shrinks.
19. As a maker, I want an assembly of any size, not just a pair, so that a gauntlet with three
    or four printed parts can be tracked as one thing.
20. As a developer, I want one module to read when I need to understand assemblies, so that I
    do not have to reconstruct the concept from five files.
21. As a developer, I want the bracketing rule to be exercised by the check script, so that I
    can change the parts list without opening a browser to find out what I broke.
22. As a developer, I want the paging boundary covered by an assertion, so that the
    interaction between grouping and truncation stops being invisible.
23. As a developer, I want the screens to contain no reads of the link group id, so that
    there is exactly one place where the assembly rule can be got wrong.
24. As an agent working on this codebase, I want the assembly interface to be small enough to
    learn in one read, so that a change to assemblies does not require loading five files
    into context.

## Implementation Decisions

**Placement.** The module lives inside the existing derive module rather than a new file. The
derive module lost roughly forty lines when the curing concept was deleted, and splitting
files is a separate decision to take later on its own merits. The write side — linking,
removing from a group, and pruning groups of one — stays where it is in the workshop module,
preserving the read/write split the architecture doc mandates.

**Seam.** No new seam. The derive module's exports are already the project's highest
non-React test surface and the check script already tests through them. This work moves
behaviour across a seam that exists rather than introducing one.

**The rows interface.** A single function takes a list of parts and returns the rows the list
should render, in order: each row is either one part or a run of parts belonging to one
assembly. Expressed as a return type, `(Part | Part[])[]`, so the screen distinguishes the two
with an array check and needs no new exported type. This function absorbs both the ordering
pass that pulls members together and the run detection that currently lives in the build
detail screen's render body; the two stop being separate steps in separate files, which
removes the unwritten adjacency contract between them.

**Scope of the rows interface.** Rows only. Filtering and sorting stay in the build detail
screen, which owns that view state. The screen filters and sorts, then asks for rows.

**Paging.** The build detail screen pages by row rather than by part, so a run is never split
across the cut. The page limit is therefore a row count, and a page may show more parts than
the nominal limit when an assembly straddles the boundary — an accepted behaviour change, and
the one maker-visible fix in this spec. The "show more" control continues to report how many
*parts* remain hidden, not rows, since that is what the maker is counting.

**The badge interface.** One function takes a part and its siblings and returns what the badge
needs: the tooltip text, and whether the assembly is in step. The part row stops computing
either. Text formatting belongs in the derive module by the precedent already set by the
build plan and the timestamp helpers.

**Siblings are drawn from the whole build, not the visible rows.** A part's badge must survive
its siblings being filtered out of view, so the sibling lookup continues to run over the
build's full part list. The existing group-index and sibling lookups stay exported for this
reason; the ordering helper they were paired with is absorbed by the rows interface and stops
being exported.

**The link modal's inputs.** The derive module gains the two questions the app shell currently
answers by hand: the other members of a part's assembly, and the parts in the same build that
are still available to link. The app shell passes those through to the modal instead of
filtering by link group id itself.

**No behaviour change on the write side.** Linking, merging, unlinking and pruning keep their
current semantics exactly. This spec moves read-side rules; it does not renegotiate what
linking does.

## Testing Decisions

**Surface.** Everything is asserted through the derive module's exports in the existing check
script, run by `npm run check`. Plain `node:assert`, no framework, consistent with the rest of
the file.

**What makes a good test here.** Assert the external behaviour of the interface — the rows a
list of parts produces, the text a badge carries, which parts the modal is offered — never the
internals, such as the shape of the group index or the order in which runs are detected. A
test that would survive rewriting the implementation is the right test. Tests build their
fixtures from the seeded workshop and the workshop module's own linking functions, as the
existing assembly assertions already do, rather than hand-constructing parts with link group
ids.

**Prior art.** The check script already covers assemblies: linking a third part into a pair
keeps the pair's group id, touching two assemblies merges everyone into one, dropping to one
member clears the leftover badge, deleting the other half does the same, and members stay
adjacent under a progress sort. New assertions extend that section in the same style.

**New coverage.**

- A list with no assemblies produces one row per part, in the same order.
- An assembly produces a single run containing all of its members.
- Two separate assemblies in one list produce two runs, neither absorbing the other.
- Every part in the input appears exactly once across the returned rows.
- Rows survive both sort modes and all three filters with members still contiguous.
- An assembly straddling the page boundary is not split: the page ends after the complete run,
  and the hidden count reports the remaining parts.
- A badge on a part whose siblings share its step reports the assembly as in step.
- A badge on a part whose sibling is behind names that sibling and its step.
- A badge is still produced when the siblings are absent from the filtered list.
- The link candidates for a part exclude the part itself and every current member.

## Out of Scope

- **A separate assembly file.** Considered and rejected for now; the module lives in the
  derive module. Splitting the derive module along its three concerns is its own candidate,
  to be judged after this lands and against a file that has already shrunk.
- **Enforcing that linked parts move together.** The domain rules say members *should* stay on
  the same step and that any part can move to any step; the badge deliberately signals drift
  rather than preventing it. Making the advance action carry siblings along would be a product
  change and needs its own decision.
- **Write-side changes.** Linking, merging, unlinking and pruning are untouched.
- **The part row action plumbing.** The six callbacks threaded from the app shell through the
  build detail screen to the part row, and the subtraction applied to that interface on the
  way, stay as they are. One call site does not justify the change yet.
- **The persistence seam.** The sync rule between the local cache and the cloud copy has no
  test surface, but that is a separate candidate with its own trade-off about whether a test
  fake alone justifies a seam.
- **Any change to how assemblies look.** No new styling; the bracket keeps its current
  appearance, and the only visual difference is that it now spans complete assemblies at a
  page boundary.

## Further Notes

This repo has no ADR directory and no domain glossary file; the orientation doc at the repo
root carries both roles, and its domain rules section is where the assembly rules are already
written down. Nothing in this spec contradicts them.

The work follows directly from two commits that just landed: the curing concept was deleted
outright, and the build detail screen's next-step card was collapsed into a single build plan
call. This spec applies the same move to the second cluster of logic that had leaked into that
screen. The build plan work is worth reading first as prior art for the shape — a screen-facing
interface that answers one question completely, with the previously-exported helpers made
private behind it.

One caution for whoever implements this: the sibling lookup and the row grouping look like the
same question and are not. Rows are built from the *visible* parts, so that filtering and
sorting are respected; siblings are looked up across the *whole build*, so that a badge
survives its siblings being filtered away. Collapsing the two would reintroduce, in a new
place, exactly the class of defect this spec exists to remove.
