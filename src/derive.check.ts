// Self-check for the derived values the screens are built on: `npm run check`.
import assert from 'node:assert/strict';
import {
  BATCH_THRESHOLD,
  batchGroups,
  forwardSteps,
  nextStatus,
  partsDone,
  partsWaitingOnYou,
  progressPct,
  recommendedGroup,
  statusPills,
  suggestedNextStep,
  timeAgo,
  timeLeft,
} from './derive.ts';
import { seedState } from './seed.ts';

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

// —— batch groups are cross-build, hands-off parts don't count ——
const groups = batchGroups(builds, now);
assert.deepEqual(
  groups.map((g) => [g.label, g.parts.length, g.actionable]),
  [
    ['SPRAY PRIMER', 5, true],
    ['SAND / SMOOTH', 7, true],
    ['GLUE UP', 4, true],
    ['AIRBRUSH', 2, false], // 2 of 3 — not worth setting up yet
  ],
);
assert.equal(groups[3].parts.length < BATCH_THRESHOLD, true);
// Belt buckle is smoothing but curing, blade halves is assembling but curing:
assert.equal(
  groups.some((g) => g.parts.some((p) => p.name === 'Belt buckle' || p.name === 'Blade halves')),
  false,
);
// Recommended = the setup that clears the most builds, not the biggest pile.
assert.equal(recommendedGroup(groups)?.label, 'SPRAY PRIMER');
assert.equal(recommendedGroup(groups)?.buildCount, 3);
assert.equal(partsWaitingOnYou(builds, now), 18);

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
    ['smoothing', 3],
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
assert.equal(nextStatus('smoothing'), 'priming');
assert.equal(nextStatus('done'), 'done');
assert.deepEqual(forwardSteps('smoothing'), ['priming', 'painting', 'assembling', 'done']);
assert.deepEqual(forwardSteps('done'), []);

// —— stamps ——
const ago = (ms: number) => new Date(now - ms).toISOString();
assert.equal(timeAgo(ago(14 * 60_000), now), '14m ago');
assert.equal(timeAgo(ago(2 * 3600_000), now), '2h ago');
assert.equal(timeAgo(ago(26 * 3600_000), now), 'yesterday');
assert.equal(timeAgo(ago(3 * 86_400_000), now), '3d ago');
assert.equal(timeLeft(new Date(now + 100 * 60_000).toISOString(), now), '1h 40m');
assert.equal(timeLeft(new Date(now + 22 * 60_000).toISOString(), now), '22m');

console.log('derive: ok');
