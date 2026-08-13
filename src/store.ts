import { useCallback, useEffect, useRef, useState } from 'react';
import type { Part, PartStatus, State, ToolboxEntry } from './types.ts';
import { nextStatus } from './derive.ts';
import { seedState } from './seed.ts';
import { ROW_ID, supabase } from './supabase.ts';

const KEY = 'nozzle.v1';

/** A link group of one part is meaningless — clear it so a lone leftover doesn't show a badge. */
function pruneLoneGroups(parts: Part[]): Part[] {
  const counts = new Map<string, number>();
  for (const p of parts) if (p.linkGroupId) counts.set(p.linkGroupId, (counts.get(p.linkGroupId) ?? 0) + 1);
  return parts.map((p) => (p.linkGroupId && (counts.get(p.linkGroupId) ?? 0) < 2 ? { ...p, linkGroupId: undefined } : p));
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // corrupt or unreadable — fall back to a fresh workshop
  }
  return seedState();
}

/**
 * localStorage is the instant cache (renders with no network wait, works
 * offline); Supabase is the shared copy other browsers pull from. Cloud pull
 * runs once on mount and wins if it returns something; every change after
 * that is pushed up, debounced. Single row, last write wins — fine for one
 * maker. ponytail: no conflict resolution across concurrent devices; add
 * a `version` column + check if this ever needs multi-device concurrent edits.
 */
export function useStore() {
  const [state, setState] = useState<State>(load);
  const pulledFromCloud = useRef(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('workshop')
      .select('state')
      .eq('id', ROW_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('Nozzle: could not reach the cloud — working from this device only.', error.message);
        if (data?.state) setState(data.state as State);
        pulledFromCloud.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // out of quota — keep the session usable rather than crashing
      console.warn('Nozzle: could not save locally — storage is full.');
    }

    if (!pulledFromCloud.current) return; // don't push seed data over a cloud copy we haven't seen yet
    const timer = setTimeout(() => {
      supabase
        .from('workshop')
        .upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn('Nozzle: could not save to the cloud.', error.message);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const mapParts = useCallback(
    (ids: string[], fn: (p: Part) => Part) =>
      setState((s) => ({
        ...s,
        builds: s.builds.map((b) => ({
          ...b,
          parts: b.parts.map((p) => (ids.includes(p.id) ? fn(p) : p)),
        })),
      })),
    [],
  );

  /** Moving a part always stamps it and hands it back to the maker. */
  const moveTo = useCallback(
    (ids: string[], status: PartStatus) =>
      mapParts(ids, (p) => ({ ...p, status, updatedAt: new Date().toISOString(), curingUntil: undefined })),
    [mapParts],
  );

  return {
    state,
    moveTo,
    /** Finish the current operation on these parts — each moves one step down the pipeline. */
    advance: useCallback(
      (ids: string[]) =>
        mapParts(ids, (p) => ({
          ...p,
          status: nextStatus(p.status),
          updatedAt: new Date().toISOString(),
          curingUntil: undefined,
        })),
      [mapParts],
    ),
    addPart: useCallback(
      (buildId: string, name: string, note?: string) =>
        setState((s) => ({
          ...s,
          builds: s.builds.map((b) =>
            b.id === buildId
              ? {
                  ...b,
                  parts: [
                    {
                      id: crypto.randomUUID(),
                      buildId,
                      name,
                      note,
                      status: 'queued' as PartStatus,
                      updatedAt: new Date().toISOString(),
                    },
                    ...b.parts,
                  ],
                }
              : b,
          ),
        })),
      [],
    ),
    addBuild: useCallback(
      (name: string) =>
        setState((s) => ({
          ...s,
          builds: [
            ...s.builds,
            { id: crypto.randomUUID(), name, startedAt: new Date().toISOString(), parts: [] },
          ],
        })),
      [],
    ),
    renamePart: useCallback((id: string, name: string) => mapParts([id], (p) => ({ ...p, name })), [mapParts]),
    renameBuild: useCallback(
      (id: string, name: string) =>
        setState((s) => ({ ...s, builds: s.builds.map((b) => (b.id === id ? { ...b, name } : b)) })),
      [],
    ),
    setNote: useCallback(
      (id: string, note: string) => mapParts([id], (p) => ({ ...p, note: note || undefined })),
      [mapParts],
    ),
    deletePart: useCallback(
      (id: string) =>
        setState((s) => ({
          ...s,
          builds: s.builds.map((b) => ({ ...b, parts: pruneLoneGroups(b.parts.filter((p) => p.id !== id)) })),
        })),
      [],
    ),
    /**
     * Puts every id in one assembly. If any already belong to a group, that whole
     * group comes along too (touching two different groups merges them into one).
     */
    linkParts: useCallback(
      (ids: string[]) =>
        setState((s) => {
          const allParts = s.builds.flatMap((b) => b.parts);
          const members = new Set(ids);
          const touchedGroups = new Set(
            allParts.filter((p) => members.has(p.id) && p.linkGroupId).map((p) => p.linkGroupId!),
          );
          if (touchedGroups.size) {
            for (const p of allParts) if (p.linkGroupId && touchedGroups.has(p.linkGroupId)) members.add(p.id);
          }
          const groupId = touchedGroups.size === 1 ? [...touchedGroups][0] : crypto.randomUUID();
          return {
            ...s,
            builds: s.builds.map((b) => ({
              ...b,
              parts: b.parts.map((p) => (members.has(p.id) ? { ...p, linkGroupId: groupId } : p)),
            })),
          };
        }),
      [],
    ),
    /** Pulls one part out of its assembly. If that leaves a lone member behind, its badge clears too. */
    removeFromGroup: useCallback(
      (id: string) =>
        setState((s) => ({
          ...s,
          builds: s.builds.map((b) => ({
            ...b,
            parts: pruneLoneGroups(b.parts.map((p) => (p.id === id ? { ...p, linkGroupId: undefined } : p))),
          })),
        })),
      [],
    ),
    toggleFavorite: useCallback(
      (id: string) =>
        setState((s) => ({
          ...s,
          toolbox: s.toolbox.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)),
        })),
      [],
    ),
    saveEntry: useCallback(
      (draft: ToolboxEntry) =>
        setState((s) => ({
          ...s,
          toolbox: s.toolbox.some((e) => e.id === draft.id)
            ? s.toolbox.map((e) => (e.id === draft.id ? draft : e))
            : [...s.toolbox, draft],
        })),
      [],
    ),
    deleteEntry: useCallback(
      (id: string) => setState((s) => ({ ...s, toolbox: s.toolbox.filter((e) => e.id !== id) })),
      [],
    ),
  };
}
