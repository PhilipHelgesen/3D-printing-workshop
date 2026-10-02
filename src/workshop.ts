import { defaultSteps, validateSteps } from './derive.ts';
import type { Build, Part, PartStatus, State, Step, ToolboxEntry } from './types.ts';

/**
 * Every way the workshop can change, as plain `(state, args) => state`.
 * No React in here, so the rules are readable and testable on their own —
 * `store.ts` only wires these to `setState` and persistence.
 */

const now = () => new Date().toISOString();

const mapBuilds = (state: State, fn: (b: Build) => Build): State => ({
  ...state,
  builds: state.builds.map(fn),
});

const mapParts = (state: State, fn: (p: Part) => Part): State =>
  mapBuilds(state, (b) => ({ ...b, parts: b.parts.map(fn) }));

/** Applies `fn` to the named parts, leaving the rest untouched. */
const only = (ids: readonly string[], fn: (p: Part) => Part) => {
  const wanted = new Set(ids);
  return (p: Part) => (wanted.has(p.id) ? fn(p) : p);
};

/** A link group needs two members to mean anything — a lone leftover loses its badge. */
function pruneLoneGroups(parts: Part[]): Part[] {
  const size = new Map<string, number>();
  for (const p of parts) {
    if (p.linkGroupId) size.set(p.linkGroupId, (size.get(p.linkGroupId) ?? 0) + 1);
  }
  return parts.map((p) =>
    p.linkGroupId && size.get(p.linkGroupId)! < 2
      ? { ...p, linkGroupId: undefined, linkGroupName: undefined }
      : p,
  );
}

// ——— parts ———

export const moveTo = (state: State, id: string, status: PartStatus): State =>
  mapBuilds(state, (b) => b.steps.some((step) => step.id === status)
    ? { ...b, parts: b.parts.map(only([id], (p) => ({ ...p, status, updatedAt: now() }))) }
    : b);

export const renamePart = (state: State, id: string, name: string): State =>
  mapParts(state, only([id], (p) => ({ ...p, name })));

export const setNote = (state: State, id: string, note: string): State =>
  mapParts(state, only([id], (p) => ({ ...p, note: note || undefined })));

export const addPart = (state: State, buildId: string, name: string, note?: string): State =>
  mapBuilds(state, (b) =>
    b.id === buildId
      ? {
          ...b,
          parts: [
            { id: crypto.randomUUID(), buildId, name, note, status: b.steps[0].id, updatedAt: now() },
            ...b.parts,
          ],
        }
      : b,
  );

/**
 * Hand order is the parts array itself — there is no order field to keep in
 * sync, and no second source of truth to disagree with it. The move is stated
 * relative to a target part rather than an index, so it stays well-defined when
 * a stage filter has hidden whatever sits between the two on screen.
 */
export function reorderPart(state: State, id: string, targetId: string, before: boolean): State {
  if (id === targetId) return state;
  return mapBuilds(state, (b) => {
    const from = b.parts.findIndex((p) => p.id === id);
    if (from < 0 || !b.parts.some((p) => p.id === targetId)) return b;
    const parts = [...b.parts];
    const [moved] = parts.splice(from, 1);
    // Looked up after the splice: pulling the part out shifts everything behind it.
    const at = parts.findIndex((p) => p.id === targetId);
    parts.splice(before ? at : at + 1, 0, moved);
    return { ...b, parts };
  });
}

/**
 * The same move for a whole assembly: its members leave the array together and
 * land together, so a group can be dragged as the one thing it looks like.
 */
export function reorderGroup(
  state: State,
  groupId: string,
  targetId: string,
  before: boolean,
): State {
  return mapBuilds(state, (b) => {
    const block = b.parts.filter((p) => p.linkGroupId === groupId);
    // Dropping a group on one of its own members would be a move to nowhere.
    if (!block.length || block.some((p) => p.id === targetId)) return b;
    const rest = b.parts.filter((p) => p.linkGroupId !== groupId);
    const at = rest.findIndex((p) => p.id === targetId);
    if (at < 0) return b;
    rest.splice(before ? at : at + 1, 0, ...block);
    return { ...b, parts: rest };
  });
}

export interface PartDrop {
  source: { kind: 'part' | 'group'; id: string };
  target: { kind: 'part' | 'group'; id: string };
  before: boolean;
  joins: boolean;
  reorder: boolean;
}

/** A drop transfers one part, or moves an assembly, in one workshop change. */
export function dropParts(state: State, drop: PartDrop): State {
  const { source, target, before, joins, reorder } = drop;
  const build = state.builds.find(b => b.parts.some(p =>
    source.kind === 'part' ? p.id === source.id : p.linkGroupId === source.id));
  if (!build) return state;
  const targets = build.parts.filter(p =>
    target.kind === 'part' ? p.id === target.id : p.linkGroupId === target.id);
  const anchor = before ? targets[0] : targets[targets.length - 1];
  if (!anchor) return state;
  if (source.kind === 'group') {
    return reorder && anchor.linkGroupId !== source.id
      ? reorderGroup(state, source.id, anchor.id, before)
      : state;
  }
  if (source.id === anchor.id) return state;
  const dragged = build.parts.find(p => p.id === source.id)!;
  const landsIn = joins ? anchor.linkGroupId : undefined;
  let next = state;
  if (dragged.linkGroupId !== landsIn) {
    // Remove first: linking a member still in its old assembly would merge both.
    if (dragged.linkGroupId) next = removeFromGroup(next, dragged.id);
    if (landsIn) next = linkParts(next, [dragged.id, anchor.id]);
  }
  return reorder ? reorderPart(next, dragged.id, anchor.id, before) : next;
}

export const deletePart = (state: State, id: string): State =>
  mapBuilds(state, (b) => ({ ...b, parts: pruneLoneGroups(b.parts.filter((p) => p.id !== id)) }));

// ——— assemblies ———

/**
 * Puts every id in one assembly. Naming a part that already belongs to a group
 * pulls that whole group in too, so linking across two assemblies merges them.
 */
export function linkParts(state: State, ids: string[]): State {
  const all = state.builds.flatMap((b) => b.parts);
  const members = new Set(ids);
  const touched = new Set(
    all.filter((p) => members.has(p.id) && p.linkGroupId).map((p) => p.linkGroupId!),
  );
  for (const p of all) if (p.linkGroupId && touched.has(p.linkGroupId)) members.add(p.id);
  // Keep the existing id when only one group is involved, so the group survives edits.
  const groupId = touched.size === 1 ? [...touched][0] : crypto.randomUUID();
  // Merging two assemblies keeps the first name it finds rather than losing both.
  const name = all.find((p) => members.has(p.id) && p.linkGroupName)?.linkGroupName;
  return mapParts(
    state,
    only([...members], (p) => ({ ...p, linkGroupId: groupId, linkGroupName: name })),
  );
}

/**
 * Names the assembly a part belongs to. The name lives on every member, so this
 * writes them all — the same shape `linkParts` uses for the id.
 */
export function nameAssembly(state: State, id: string, name: string): State {
  const groupId = state.builds.flatMap((b) => b.parts).find((p) => p.id === id)?.linkGroupId;
  if (!groupId) return state;
  return mapParts(state, (p) =>
    p.linkGroupId === groupId ? { ...p, linkGroupName: name || undefined } : p,
  );
}

export const removeFromGroup = (state: State, id: string): State =>
  mapBuilds(state, (b) => ({
    ...b,
    parts: pruneLoneGroups(
      b.parts.map((p) =>
        p.id === id ? { ...p, linkGroupId: undefined, linkGroupName: undefined } : p,
      ),
    ),
  }));

// ——— builds ———

export const addBuild = (state: State, name: string): State => ({
  ...state,
  builds: [...state.builds, { id: crypto.randomUUID(), name, startedAt: now(), steps: defaultSteps(), parts: [] }],
});

/** Apply a workflow edit atomically; an occupied deleted step needs a valid destination. */
export function editBuildSteps(build: Build, steps: Step[], replacements: Record<string, string>): Build {
  validateSteps(steps);
  const present = new Set(steps.map((step) => step.id));
  const parts = build.parts.map((part) => {
    if (present.has(part.status)) return part;
    const status = replacements[part.status];
    if (!present.has(status)) throw new Error('Choose a replacement for every occupied deleted step.');
    return { ...part, status, updatedAt: now() };
  });
  return { ...build, steps: steps.map((step) => ({ ...step, name: step.name.trim() })), parts };
}

export const saveSteps = (state: State, buildId: string, steps: Step[], replacements: Record<string, string>): State =>
  mapBuilds(state, (build) => build.id === buildId ? editBuildSteps(build, steps, replacements) : build);

/** Final destinations after any chain of occupied-step deletions in an editor draft. */
export function stepReplacements(original: Build, draft: Build): Record<string, string> {
  const statuses = new Map(draft.parts.map((part) => [part.id, part.status]));
  const replacements: Record<string, string> = {};
  for (const part of original.parts) {
    const status = statuses.get(part.id);
    if (status && status !== part.status) replacements[part.status] = status;
  }
  return replacements;
}

/** Reorder work steps only; Done stays at the end. Also used by the modal's arrow buttons. */
export function reorderStep(steps: Step[], id: string, targetId: string): Step[] {
  const from = steps.findIndex((step) => step.id === id);
  const to = steps.findIndex((step) => step.id === targetId);
  if (from < 0 || to < 0 || id === 'done' || targetId === 'done') return steps;
  const reordered = [...steps];
  const [step] = reordered.splice(from, 1);
  reordered.splice(to, 0, step);
  return reordered;
}

export const renameBuild = (state: State, id: string, name: string): State =>
  mapBuilds(state, (b) => (b.id === id ? { ...b, name } : b));

/** Both drop the key when cleared, so an empty build carries no empty strings. */
export const setBuildImage = (state: State, id: string, image: string): State =>
  mapBuilds(state, (b) => (b.id === id ? { ...b, image: image || undefined } : b));

export const setBuildNote = (state: State, id: string, note: string): State =>
  mapBuilds(state, (b) => (b.id === id ? { ...b, note: note || undefined } : b));

/** Deleting a build takes its parts with it — there is nowhere else for them to live. */
export const deleteBuild = (state: State, id: string): State => ({
  ...state,
  builds: state.builds.filter((b) => b.id !== id),
});

// ——— toolbox ———

export const toggleFavorite = (state: State, id: string): State => ({
  ...state,
  toolbox: state.toolbox.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)),
});

export const saveEntry = (state: State, draft: ToolboxEntry): State => ({
  ...state,
  toolbox: state.toolbox.some((e) => e.id === draft.id)
    ? state.toolbox.map((e) => (e.id === draft.id ? draft : e))
    : [...state.toolbox, draft],
});

export const deleteEntry = (state: State, id: string): State => ({
  ...state,
  toolbox: state.toolbox.filter((e) => e.id !== id),
});
