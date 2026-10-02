# 7. Each build owns its step list

Different builds need different operations, so each build owns an editable,
ordered step list rather than sharing the fixed workshop pipeline. Editing one
build's steps leaves other builds unchanged. This scope decision was agreed on
2026-10-01 and is implemented.

A step continues to mean work a part still needs. Done remains fixed at the end
and determines completion, preserving the meaning of existing progress figures.
This replaces the fixed-pipeline rule in CLAUDE.md and supersedes ADR-0006's fixed
seven-stage palette; stage filtering remains unchanged.

New builds start with Print → Sand → Prime → Paint → Assemble → Done. Queue is
removed; existing queued parts move to Print when stored builds are migrated.
New parts start at their build's first work step. Each build must retain at least
one work step before Done.

Deleting a step containing parts requires choosing a replacement step and showing
the affected part count before deletion. Reordering keeps parts on their existing
steps; the next-step highlight and progress sorting follow the build's order.

Repeated operations are separate steps. For example, graphite powder is applied
after black gloss and again after clear coat to preserve the shine. These steps
must remain distinct even if they use the same operation or color; parts belong
to a particular step, not to a shared operation name.

All step edits and deletion reassignments apply together on Save. Cancel or
closing the modal discards unsaved edits.

The dashboard batching suggestion under the greeting is removed because
the maker never reads it. Custom steps therefore do not need cross-build matching
for that suggestion. This retires the dashboard suggestion retained in ADR-0005;
it does not introduce replacement advice. Editing controls are recorded in
DECISIONS.md.
