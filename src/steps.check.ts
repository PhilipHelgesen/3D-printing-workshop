// Build-specific workflow behavior through the existing workshop/derive seams.
import assert from 'node:assert/strict';
import { seedState } from './seed.ts';
import { addBuild, addPart, editBuildSteps, saveSteps, stepReplacements } from './workshop.ts';
import { nextStatus, sortByProgress, stepName, statusPills } from './derive.ts';

const state = seedState();
const build = state.builds[0];
const steps = [
  { ...build.steps[1], name: 'Rough sand' },
  { ...build.steps[0] },
  ...build.steps.slice(2),
];
const edited = saveSteps(state, build.id, steps, {});
assert.equal(edited.builds[0].steps[0].name, 'Rough sand');
assert.deepEqual(edited.builds[0].parts, build.parts, 'rename/reorder preserves step membership');
assert.equal(edited.builds[1], state.builds[1], 'other builds are untouched');
assert.equal(addPart(edited, build.id, 'New part').builds[0].parts[0].status, 'sanding');
assert.equal(nextStatus('sanding', steps), 'printing');
assert.equal(nextStatus('done', steps), 'done');
assert.equal(sortByProgress(build.parts, steps)[0].status, 'sanding');
assert.equal(stepName('sanding', steps), 'Rough sand');
assert.equal(statusPills(edited.builds[0])[0].status, 'sanding');
assert.equal(addBuild(state, 'New build').builds.at(-1)?.steps[0].id, 'printing');

// Repeated graphite applications have independent identities, even with the
// same name and color. Reordering/recoloring never marks work complete.
const graphite = [
  ...steps.slice(0, -1),
  { id: 'graphite-gloss', name: 'Graphite', color: 'stone' as const },
  { id: 'clear-coat', name: 'Clear coat', color: 'sea' as const },
  { id: 'graphite-clear', name: 'Graphite', color: 'stone' as const },
  steps.at(-1)!,
];
const repeated = saveSteps(edited, build.id, graphite, {});
assert.equal(nextStatus('graphite-gloss', graphite), 'clear-coat');
assert.equal(nextStatus('clear-coat', graphite), 'graphite-clear');
assert.equal(nextStatus('graphite-clear', graphite), 'done');

// An occupied deleted step cannot strand parts or silently mark them done.
const withoutSand = graphite.filter((step) => step.id !== 'sanding');
assert.throws(() => saveSteps(repeated, build.id, withoutSand, {}), /replacement/);
assert.throws(() => saveSteps(repeated, build.id, withoutSand, { sanding: 'missing' }), /replacement/);
const reassigned = saveSteps(repeated, build.id, withoutSand, { sanding: 'graphite-gloss' });
assert.equal(reassigned.builds[0].parts.filter((part) => part.status === 'graphite-gloss').length, 3);
assert.equal(reassigned.builds[0].parts.filter((part) => part.status === 'done').length, 18);
assert.deepEqual(reassigned.builds[0].parts.map((part) => part.id), build.parts.map((part) => part.id));
assert.deepEqual(repeated.builds[0].parts, build.parts, 'draft edits do not mutate the original');

assert.throws(() => saveSteps(state, build.id, [steps.at(-1)!], {}), /at least one/);
assert.throws(() => saveSteps(state, build.id, steps.slice(0, -1), {}), /Done/);
assert.throws(() => saveSteps(state, build.id, [steps.at(-1)!, ...steps.slice(0, -1)], {}), /Done/);
assert.throws(() => saveSteps(state, build.id, [steps[0], steps[0], steps.at(-1)!], {}), /Done/);
assert.throws(() => saveSteps(state, build.id, [{ ...steps[0], name: ' ' }, ...steps.slice(1)], {}), /name/);
assert.throws(() => saveSteps(state, build.id, [{ ...steps[0], color: 'basil' }, ...steps.slice(1)], {}), /color/);

const finalDraft = editBuildSteps(reassigned.builds[0], withoutSand.filter((step) => step.id !== 'graphite-gloss'), { 'graphite-gloss': 'graphite-clear' });
assert.deepEqual(stepReplacements(repeated.builds[0], finalDraft), { sanding: 'graphite-clear' });
const committed = saveSteps(repeated, build.id, finalDraft.steps, stepReplacements(repeated.builds[0], finalDraft));
assert.equal(committed.builds[0].parts.filter((part) => part.status === 'graphite-clear').length, 3);

console.log('steps: ok');
