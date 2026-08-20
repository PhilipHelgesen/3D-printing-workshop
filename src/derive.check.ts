// Self-check for the derived values the screens are built on: `npm run check`.
import assert from 'node:assert/strict';
import {
  BATCH_THRESHOLD,
  assemblies,
  batchGroups,
  groupLinked,
  nextStatus,
  otherSteps,
  partsDone,
  partsWaitingOnYou,
  progressPct,
  recommendedGroup,
  siblings,
  sortByProgress,
  statusPills,
  suggestedNextStep,
  timeAgo,
} from './derive.ts';
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

// —— suggested next step: prime → glue → sand, then print ——
assert.equal(suggestedNextStep(beskar)?.text, 'Prime 2 parts — pauldron L, pauldron R');
assert.equal(suggestedNextStep(hunter)?.text, 'Prime 2 parts — cheek plate L, cheek plate R');
assert.equal(suggestedNextStep(sword)?.text, 'Glue blade halves');
assert.equal(suggestedNextStep(sword)?.tone, 'glue');
assert.equal(
  suggestedNextStep({ ...beskar, parts: beskar.parts.filter((p) => p.status === 'queued') })?.text,
  'Print next: gauntlet, left',
);

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

// —— list ordering: assembly members stay adjacent whatever the sort ——
const ordered = groupLinked(sortByProgress(partsOf(trio)));
const linkedAt = ordered.map((p, i) => (p.linkGroupId ? i : -1)).filter((i) => i >= 0);
assert.deepEqual(linkedAt, [linkedAt[0], linkedAt[0] + 1, linkedAt[0] + 2]);
assert.equal(ordered.length, partsOf(trio).length);

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
