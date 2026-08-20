import type { Build, Part, PartStatus, State, ToolboxEntry } from './types.ts';
import { nextStatus } from './derive.ts';

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
    p.linkGroupId && size.get(p.linkGroupId)! < 2 ? { ...p, linkGroupId: undefined } : p,
  );
}

// ——— parts ———

export const moveTo = (state: State, ids: string[], status: PartStatus): State =>
  mapParts(state, only(ids, (p) => ({ ...p, status, updatedAt: now() })));

/** Finish the current operation on these parts — each moves one step down the pipeline. */
export const advance = (state: State, ids: string[]): State =>
  mapParts(state, only(ids, (p) => ({ ...p, status: nextStatus(p.status), updatedAt: now() })));

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
            { id: crypto.randomUUID(), buildId, name, note, status: 'queued', updatedAt: now() },
            ...b.parts,
          ],
        }
      : b,
  );

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
  return mapParts(state, only([...members], (p) => ({ ...p, linkGroupId: groupId })));
}

export const removeFromGroup = (state: State, id: string): State =>
  mapBuilds(state, (b) => ({
    ...b,
    parts: pruneLoneGroups(b.parts.map((p) => (p.id === id ? { ...p, linkGroupId: undefined } : p))),
  }));

// ——— builds ———

export const addBuild = (state: State, name: string): State => ({
  ...state,
  builds: [...state.builds, { id: crypto.randomUUID(), name, startedAt: now(), parts: [] }],
});

export const renameBuild = (state: State, id: string, name: string): State =>
  mapBuilds(state, (b) => (b.id === id ? { ...b, name } : b));

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
