// Self-check for the workshop copy: how a stored blob becomes state we trust,
// and when a change is owed to the cloud. Run by `npm run check`.
import assert from 'node:assert/strict';
import type { PartStatus } from './types.ts';
import { normalizeState, parseStored, shouldSkipPush } from './persist.ts';
import { seedState } from './seed.ts';

const now = Date.UTC(2026, 7, 13, 9, 0, 0);
const fresh = seedState(now);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// —— a copy written by an older version ——
// `smoothing` was renamed to `sanding`. A blob stored before that rename still
// says the old name, and there is no ALTER TABLE for a JSON blob (ADR-0001), so
// the migration runs here, on read.
const old = clone(fresh);
old.builds[0].parts[0].status = 'smoothing' as PartStatus;

const migrated = normalizeState(old);
assert.equal(migrated.builds[0].parts[0].status, 'sanding');
// Nothing else is disturbed on the way through.
assert.deepEqual(
  migrated.builds.map((b) => b.parts.length),
  fresh.builds.map((b) => b.parts.length),
);
assert.equal(migrated.toolbox.length, fresh.toolbox.length);
// A copy with nothing to migrate comes back unchanged. Compared against a
// round-tripped copy because JSON drops keys whose value is undefined.
const stored = clone(fresh);
assert.deepEqual(normalizeState(clone(fresh)), stored);

// —— what parseStored makes of what it finds ——
// Nothing stored yet: a fresh workshop, not a crash.
assert.ok(parseStored(null).builds.length > 0);
// Unreadable: same answer.
assert.ok(parseStored('{ not json').builds.length > 0);
// Valid JSON of a shape this version can't read: still a workshop, still no crash.
assert.ok(parseStored('{"nope":1}').builds.length > 0);
assert.ok(parseStored('null').builds.length > 0);
// A real stored copy round-trips, with the migration applied on the way in.
assert.deepEqual(parseStored(JSON.stringify(fresh)), stored);
assert.equal(parseStored(JSON.stringify(old)).builds[0].parts[0].status, 'sanding');

// —— when a change is owed to the cloud ——
// `known` is what the cloud is known to hold. This is the guard at the top of
// the push effect: make it past here and the push is safe.
const json = JSON.stringify(fresh);

// The pull hasn't settled — never push over a copy we haven't seen.
assert.equal(shouldSkipPush(undefined, json), true);
// The cloud already holds exactly this — never echo back what we just pulled.
assert.equal(shouldSkipPush(json, json), true);
// Nothing up there yet: the next change seeds it.
assert.equal(shouldSkipPush('', json), false);
// The cloud is behind.
assert.equal(shouldSkipPush('{"an":"older copy"}', json), false);

console.log('persist: ok');
