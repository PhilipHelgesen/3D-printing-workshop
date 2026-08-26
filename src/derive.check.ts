// Self-check for the derived values the screens are built on: `npm run check`.
import assert from 'node:assert/strict';
import {
  BATCH_THRESHOLD,
  STATUS_LABEL,
  assemblies,
  assemblyBadge,
  assemblyMembers,
  assemblyName,
  barHeight,
  batchGroups,
  countByStatus,
  linkCandidates,
  nextStatus,
  otherSteps,
  partRows,
  partsAt,
  partsDone,
  partsWaitingOnYou,
  isSegmented,
  progressColor,
  progressPct,
  recommendedGroup,
  siblings,
  sortByProgress,
  statusPills,
  stepName,
  timeAgo,
} from './derive.ts';
import type { Part } from './types.ts';
import { seedState } from './seed.ts';
import * as workshop from './workshop.ts';

const now = Date.UTC(2026, 7, 13, 9, 0, 0);
const { builds } = seedState(now);
const [beskar, hunter, sword, pipboy] = builds;

// —— the handoff's headline figures ——
assert.equal(
  builds.reduce((n, b) => n + b.parts.length, 0),
  62,
);
assert.equal(
  builds.reduce((n, b) => n + partsDone(b), 0),
  31,
);
assert.deepEqual(
  builds.map((b) => [b.parts.length, partsDone(b)]),
  [
    [26, 18],
    [11, 4],
    [8, 7],
    [17, 2],
  ],
);

// —— batch groups are cross-build ——
const groups = batchGroups(builds);
assert.deepEqual(
  groups.map((g) => [g.label, g.parts.length, g.actionable]),
  [
    ['SPRAY PRIMER', 5, true],
    ['SANDING', 8, true],
    ['GLUE UP', 5, true],
    ['AIRBRUSH', 2, false], // 2 of 3 — not worth setting up yet
  ],
);
assert.equal(groups[3].parts.length < BATCH_THRESHOLD, true);
// Recommended = the setup that clears the most builds, not the biggest pile.
assert.equal(recommendedGroup(groups)?.label, 'SPRAY PRIMER');
assert.equal(recommendedGroup(groups)?.buildCount, 3);
assert.equal(partsWaitingOnYou(groups), 20);

// —— the donut: green only once a build reads as finishing ——
// sword is 7 of 8 done (87.5%), beskar 18 of 26.
assert.equal(progressColor(sword), 'var(--basil)');
assert.equal(progressColor(beskar), 'var(--sea)');

// —— pills: pipeline order, queued last, DONE only once a build is finishing ——
assert.deepEqual(
  statusPills(beskar).map((p) => [p.status, p.count]),
  [
    ['printing', 2],
    ['sanding', 3],
    ['priming', 2],
    ['queued', 1],
  ],
);
assert.deepEqual(
  statusPills(sword).map((p) => p.status),
  ['assembling', 'done'],
);
assert.equal(Math.round(progressPct(pipboy)), 12);

// —— the pipeline has no failure state; a broken part goes back to queued ——
assert.equal(nextStatus('sanding'), 'priming');
assert.equal(nextStatus('done'), 'done');
assert.deepEqual(otherSteps('sanding'), ['queued', 'printing', 'priming', 'painting', 'assembling', 'done']);
assert.deepEqual(otherSteps('done'), ['queued', 'printing', 'sanding', 'priming', 'painting', 'assembling']);

// —— assemblies: linking merges groups, unlinking never strands a lone member ——
const state = seedState(now);
const [pauldronL, pauldronR, vambraceL, vambraceR] = state.builds[0].parts;
const partsOf = (s: typeof state) => s.builds[0].parts;
const groupOf = (s: typeof state, id: string) => partsOf(s).find((p) => p.id === id)?.linkGroupId;

const pair = workshop.linkParts(state, [pauldronL.id, pauldronR.id]);
assert.equal(groupOf(pair, pauldronL.id), groupOf(pair, pauldronR.id));
assert.ok(groupOf(pair, pauldronL.id));
assert.equal(groupOf(pair, vambraceL.id), undefined);

// Linking a third part into an existing pair keeps that pair's group id.
const trio = workshop.linkParts(pair, [pauldronL.id, vambraceL.id]);
assert.equal(groupOf(trio, vambraceL.id), groupOf(pair, pauldronL.id));
assert.equal(siblings(partsOf(trio)[0], assemblies(partsOf(trio))).length, 2);

// Touching two separate assemblies merges everyone into one.
const otherPair = workshop.linkParts(trio, [vambraceR.id, partsOf(trio)[4].id]);
const merged = workshop.linkParts(otherPair, [pauldronL.id, vambraceR.id]);
assert.equal(new Set(partsOf(merged).filter((p) => p.linkGroupId).map((p) => p.linkGroupId)).size, 1);
assert.equal(partsOf(merged).filter((p) => p.linkGroupId).length, 5);

// Dropping to one member clears the leftover badge rather than leaving a group of one.
const broken = workshop.removeFromGroup(pair, pauldronR.id);
assert.equal(groupOf(broken, pauldronL.id), undefined);
assert.equal(groupOf(broken, pauldronR.id), undefined);
// Same when the other half is deleted outright.
assert.equal(groupOf(workshop.deletePart(pair, pauldronR.id), pauldronL.id), undefined);

// —— the parts list: an assembly is one row, so nothing can split it ——
const isRun = (row: Part | Part[]): row is Part[] => Array.isArray(row);

// No assemblies at all: one row per part, same order.
assert.deepEqual(partRows(beskar.parts), beskar.parts);

// An assembly is a single row holding all of its members.
const trioRows = partRows(partsOf(trio));
const trioRuns = trioRows.filter(isRun);
assert.equal(trioRuns.length, 1);
assert.equal(trioRuns[0].length, 3);
// Every part is placed exactly once.
assert.deepEqual(
  trioRows.flat().map((p) => p.id),
  partsOf(trio).map((p) => p.id),
);

// Two assemblies produce two runs; neither absorbs the other.
const twoRuns = partRows(partsOf(otherPair)).filter(isRun);
assert.deepEqual(
  twoRuns.map((r) => r.length),
  [3, 2],
);

// Sorting can't scatter a group — the members are already inside one row.
assert.equal(partRows(sortByProgress(partsOf(trio))).filter(isRun)[0].length, 3);

// Filtering can leave one member visible. A run of one still carries its assembly:
// the old rule pruned it because a bracket over a single part means nothing, but a
// run is now headed by the assembly's name, and a name over one part means plenty.
const loneMember = partsOf(trio).filter((p) => p.id !== pauldronR.id && p.id !== vambraceL.id);
assert.equal(loneMember.some((p) => p.linkGroupId), true);
assert.equal(partRows(loneMember).filter(isRun).length, 1);
// A part in no assembly is still a plain row, not a run of one.
assert.equal(partRows(beskar.parts).some(isRun), false);

// —— what an assembly is called ——
// Unnamed until the maker says otherwise — the head renders its own invitation.
assert.equal(assemblyName(partsOf(trio).filter((p) => p.linkGroupId)), undefined);

const named = workshop.nameAssembly(trio, pauldronL.id, 'Right pauldron');
const namedMembers = partsOf(named).filter((p) => p.linkGroupId);
assert.equal(assemblyName(namedMembers), 'Right pauldron');
// The name lives on every member — there is no group record to hang it on.
assert.equal(namedMembers.every((p) => p.linkGroupName === 'Right pauldron'), true);
assert.equal(namedMembers.length, 3);
// Parts outside the assembly are untouched.
assert.equal(partsOf(named).filter((p) => p.linkGroupName).length, 3);
// Clearing drops the key rather than storing an empty string.
assert.equal(
  partsOf(workshop.nameAssembly(named, pauldronL.id, '')).some((p) => p.linkGroupName),
  false,
);
// Naming a part that belongs to no assembly changes nothing.
assert.deepEqual(workshop.nameAssembly(state, partsOf(state)[0].id, 'Nope'), state);

// Merging two assemblies keeps a name rather than losing both.
const mergedNamed = workshop.linkParts(named, [pauldronL.id, vambraceR.id]);
assert.equal(
  partsOf(mergedNamed).find((p) => p.id === vambraceR.id)?.linkGroupName,
  'Right pauldron',
);
// Leaving an assembly drops the name with the id.
assert.equal(
  partsOf(workshop.removeFromGroup(named, pauldronR.id)).find((p) => p.id === pauldronR.id)
    ?.linkGroupName,
  undefined,
);

// —— how a stage bar is drawn ——
// Up to three parts you can count the pieces; past that the bar goes solid.
assert.equal(isSegmented(0), false);
assert.equal(isSegmented(1), true);
assert.equal(isSegmented(3), true);
assert.equal(isSegmented(4), false);
// Height still reports the count, which is what the two charts have in common.
assert.equal(barHeight(0), 5);
assert.ok(barHeight(2) > barHeight(1));
assert.equal(barHeight(99), barHeight(99, 8, 62), 'the cap is the cap');
assert.ok(barHeight(3, 4, 20) < barHeight(3), 'the mini chart draws the same counts smaller');

// A row is a whole assembly, never a slice of one: two rows here carry four parts.
assert.equal(partRows(partsOf(trio)).slice(0, 2).flat().length, 4);

// —— the link badge ——
const drifted = workshop.moveTo(trio, pauldronR.id, 'queued');
const dParts = partsOf(drifted);
const badgeOf = (p: Part, all: Part[]) => assemblyBadge(p, siblings(p, assemblies(all)));

// Not in an assembly, no badge.
assert.equal(badgeOf(dParts[5], dParts), null);

// A sibling that has fallen behind is named, with the step to catch up to.
const behind = badgeOf(dParts[0], dParts);
assert.equal(behind?.inStep, false);
assert.equal(behind?.title.includes(`${pauldronR.name} (${STATUS_LABEL.queued})`), true);

// Members on the same step: named, no catch-up.
const aligned = partsOf(
  [pauldronL.id, pauldronR.id, vambraceL.id].reduce(
    (s, id) => workshop.moveTo(s, id, 'sanding'),
    trio,
  ),
);
assert.equal(badgeOf(aligned[0], aligned)?.inStep, true);
assert.equal(badgeOf(aligned[0], aligned)?.title.includes('same step'), true);

// The badge is looked up across the whole build, so filtering the siblings away keeps it.
assert.ok(badgeOf(dParts[0], dParts));

// —— the link modal's inputs ——
assert.deepEqual(
  assemblyMembers(dParts[0], dParts)
    .map((p) => p.id)
    .sort(),
  [pauldronR.id, vambraceL.id].sort(),
);
const candidates = linkCandidates(dParts[0], dParts);
// Never the part itself, never a part already in the assembly.
assert.equal(
  candidates.some((p) => p.id === dParts[0].id || p.linkGroupId === dParts[0].linkGroupId),
  false,
);
assert.equal(candidates.length, dParts.length - 3);

// —— builds ——

// Deleting a build takes its parts with it and leaves the others alone.
// —— the parts at a step ——
// The number on a stage button and the list under it are the same set, which is
// the build page's whole claim (ADR-0006).
assert.equal(partsAt(beskar.parts, 'priming').length, countByStatus(beskar.parts, 'priming'));
assert.ok(partsAt(beskar.parts, 'priming').every((p) => p.status === 'priming'));
assert.deepEqual(partsAt(beskar.parts, 'done').length, partsDone(beskar));
// A step nothing is at is empty, not absent.
assert.deepEqual(partsAt(sword.parts, 'queued'), []);

// A status as a heading, next to the shouted form the pills use.
assert.equal(stepName('queued'), 'Queued');
assert.equal(stepName('assembling'), 'Assembling');
assert.equal(STATUS_LABEL.assembling, 'ASSEMBLING');

// —— a build's photo and note ——
// Both are optional and replaceable; neither existed before ADR-0006.
const shot = workshop.setBuildImage(state, beskar.id, 'https://example.test/beskar.webp');
assert.equal(shot.builds[0].image, 'https://example.test/beskar.webp');
assert.equal(shot.builds[1].image, undefined, 'only the named build is touched');
// Clearing drops the key rather than storing an empty string.
assert.equal(workshop.setBuildImage(shot, beskar.id, '').builds[0].image, undefined);

const noted = workshop.setBuildNote(state, beskar.id, 'Chest plate needs a reprint');
assert.equal(noted.builds[0].note, 'Chest plate needs a reprint');
assert.equal(noted.builds[1].note, undefined);
assert.equal(workshop.setBuildNote(noted, beskar.id, '').builds[0].note, undefined);
// Neither disturbs the parts.
assert.equal(noted.builds[0].parts.length, beskar.parts.length);

const without = workshop.deleteBuild(state, hunter.id);
assert.equal(without.builds.length, state.builds.length - 1);
assert.equal(without.builds.some((b) => b.id === hunter.id), false);
assert.equal(without.builds.flatMap((b) => b.parts).some((p) => p.buildId === hunter.id), false);
assert.equal(without.toolbox.length, state.toolbox.length);

// —— hand order: the parts array is the order, moves stated against a target ——
const ids = (s: typeof state) => partsOf(s).map((p) => p.id);
const [first, second, third, fourth] = ids(state);

// Dropping the first part below the third: it lands after it, the rest close up.
const moved = workshop.reorderPart(state, first, third, false);
assert.deepEqual(ids(moved).slice(0, 3), [second, third, first]);
assert.equal(partsOf(moved).length, partsOf(state).length);

// Dropping it above instead puts it in front of the same target.
assert.deepEqual(ids(workshop.reorderPart(state, first, third, true)).slice(0, 3), [
  second,
  first,
  third,
]);

// Moving backwards works the same way — the index is looked up after the lift.
assert.deepEqual(ids(workshop.reorderPart(state, fourth, second, true)).slice(0, 4), [
  first,
  fourth,
  second,
  third,
]);

// A part dropped on itself, or on something that isn't there, changes nothing.
assert.equal(workshop.reorderPart(state, first, first, true), state);
assert.deepEqual(ids(workshop.reorderPart(state, first, 'gone', true)), ids(state));

// —— a whole assembly moves as one block ——
const grouped = workshop.linkParts(state, [second, fourth]);
const groupId = groupOf(grouped, second)!;
const blockMoved = workshop.reorderGroup(grouped, groupId, first, true);
assert.deepEqual(ids(blockMoved).slice(0, 3), [second, fourth, first]);
assert.equal(partsOf(blockMoved).length, partsOf(state).length);

// Dropped after a part, the members stay contiguous and in their own order.
assert.deepEqual(ids(workshop.reorderGroup(grouped, groupId, third, false)).slice(0, 4), [
  first,
  third,
  second,
  fourth,
]);

// A group dropped on one of its own members, or on nothing, doesn't move.
assert.deepEqual(ids(workshop.reorderGroup(grouped, groupId, second, true)), ids(grouped));
assert.deepEqual(ids(workshop.reorderGroup(grouped, groupId, 'gone', true)), ids(grouped));

// —— stamps ——
const ago = (ms: number) => new Date(now - ms).toISOString();
assert.equal(timeAgo(ago(14 * 60_000), now), '14m ago');
assert.equal(timeAgo(ago(2 * 3600_000), now), '2h ago');
assert.equal(timeAgo(ago(26 * 3600_000), now), 'yesterday');
assert.equal(timeAgo(ago(3 * 86_400_000), now), '3d ago');

console.log('derive: ok');
