// Self-check for the derived values the screens are built on: `npm run check`.
import assert from 'node:assert/strict';
import {
  BATCH_THRESHOLD,
  STATUS_LABEL,
  assemblies,
  assemblyBadge,
  assemblyMembers,
  batchGroups,
  buildPlan,
  linkCandidates,
  nextStatus,
  otherSteps,
  partRows,
  partsDone,
  partsWaitingOnYou,
  progressPct,
  recommendedGroup,
  siblings,
  sortByProgress,
  statusPills,
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

// —— the build plan: prime → glue → sand, then print ——
assert.equal(buildPlan(beskar, builds)?.title, 'Prime 2 parts');
assert.equal(buildPlan(hunter, builds)?.title, 'Prime 2 parts');
assert.equal(buildPlan(sword, builds)?.tone, 'glue');

// The count in the subtitle is the same operation stacked up in the OTHER builds.
assert.equal(buildPlan(beskar, builds)?.subtitle, '3 more parts elsewhere are ready for primer too.');
// Alone, a build has nothing to batch with — no subtitle at all.
assert.equal(buildPlan(beskar, [beskar])?.subtitle, null);
// Every part the card offers belongs to this build; the elsewhere ones are only counted.
assert.equal(
  buildPlan(beskar, builds)?.parts.every((p) => p.buildId === beskar.id),
  true,
);

// A print is named, not offered — there is nothing to tick off until it comes off the bed.
const queuedOnly = { ...beskar, parts: beskar.parts.filter((p) => p.status === 'queued') };
assert.equal(buildPlan(queuedOnly, builds)?.title, 'Print next: gauntlet, left');
assert.deepEqual(buildPlan(queuedOnly, builds)?.parts, []);
assert.equal(buildPlan(queuedOnly, builds)?.subtitle, null);

// Nothing left to do at all.
assert.equal(buildPlan({ ...beskar, parts: [] }, builds), null);

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

// Filtering can leave one member visible; one part is a plain row, not a bracket over itself.
const loneMember = partsOf(trio).filter((p) => p.id !== pauldronR.id && p.id !== vambraceL.id);
assert.equal(loneMember.some((p) => p.linkGroupId), true);
assert.equal(partRows(loneMember).some(isRun), false);

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
const without = workshop.deleteBuild(state, hunter.id);
assert.equal(without.builds.length, state.builds.length - 1);
assert.equal(without.builds.some((b) => b.id === hunter.id), false);
assert.equal(without.builds.flatMap((b) => b.parts).some((p) => p.buildId === hunter.id), false);
assert.equal(without.toolbox.length, state.toolbox.length);

// —— stamps ——
const ago = (ms: number) => new Date(now - ms).toISOString();
assert.equal(timeAgo(ago(14 * 60_000), now), '14m ago');
assert.equal(timeAgo(ago(2 * 3600_000), now), '2h ago');
assert.equal(timeAgo(ago(26 * 3600_000), now), 'yesterday');
assert.equal(timeAgo(ago(3 * 86_400_000), now), '3d ago');

console.log('derive: ok');
