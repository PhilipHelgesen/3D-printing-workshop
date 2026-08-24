import { useEffect, useMemo, useRef, useState } from 'react';
import type { PartStatus, State, ToolboxEntry } from './types.ts';
import { normalizeState, parseStored, shouldSkipPush } from './persist.ts';
import { seedState } from './seed.ts';
import { ROW_ID, supabase } from './supabase.ts';
import * as workshop from './workshop.ts';

const KEY = 'nozzle.v1';
const PUSH_DELAY_MS = 500;

function loadLocal(): State {
  try {
    return parseStored(localStorage.getItem(KEY));
  } catch {
    // reading storage can throw outright — Safari with "Block All Cookies" on
    return seedState();
  }
}

/**
 * localStorage is the instant cache (renders with no network wait, works
 * offline); Supabase is the shared copy other browsers pull from. The cloud
 * pull runs once on mount and wins if it returns anything; changes after that
 * are pushed back, debounced. Single row, last write wins — fine for one maker.
 * ponytail: no conflict resolution across concurrent devices; add a `version`
 * column + check if this ever needs concurrent multi-device edits.
 */
export function useStore() {
  const [state, setState] = useState<State>(loadLocal);
  // What the cloud is known to hold. `undefined` until the pull settles, so we
  // never push over a copy we haven't seen — and never echo back what we pulled.
  const cloudJson = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('workshop')
      .select('state')
      .eq('id', ROW_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Nozzle: could not reach the cloud — working from this device only.', error.message);
        }
        if (data?.state) {
          try {
            // Normalise before claiming the cloud copy is known: a blob this
            // version can't read must not be recorded as the copy we hold.
            const next = normalizeState(data.state as State);
            cloudJson.current = JSON.stringify(data.state);
            setState(next);
          } catch {
            console.warn("Nozzle: the cloud copy couldn't be read — working from this device.");
            cloudJson.current = ''; // treat it as empty; the next change overwrites it
          }
        } else {
          cloudJson.current = ''; // nothing up there yet (or unreachable) — next change seeds it
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const json = JSON.stringify(state);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // out of quota — keep the session usable rather than crashing
      console.warn('Nozzle: could not save locally — storage is full.');
    }

    if (shouldSkipPush(cloudJson.current, json)) return;
    const timer = setTimeout(() => {
      supabase
        .from('workshop')
        .upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn('Nozzle: could not save to the cloud.', error.message);
          else cloudJson.current = json;
        });
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  // setState is stable, so every action is too — built once and reused.
  const actions = useMemo(
    () => ({
      moveTo: (id: string, status: PartStatus) => setState((s) => workshop.moveTo(s, id, status)),
      addPart: (buildId: string, name: string, note?: string) =>
        setState((s) => workshop.addPart(s, buildId, name, note)),
      renamePart: (id: string, name: string) => setState((s) => workshop.renamePart(s, id, name)),
      setNote: (id: string, note: string) => setState((s) => workshop.setNote(s, id, note)),
      deletePart: (id: string) => setState((s) => workshop.deletePart(s, id)),
      linkParts: (ids: string[]) => setState((s) => workshop.linkParts(s, ids)),
      removeFromGroup: (id: string) => setState((s) => workshop.removeFromGroup(s, id)),
      addBuild: (name: string) => setState((s) => workshop.addBuild(s, name)),
      renameBuild: (id: string, name: string) => setState((s) => workshop.renameBuild(s, id, name)),
      setBuildImage: (id: string, image: string) =>
        setState((s) => workshop.setBuildImage(s, id, image)),
      setBuildNote: (id: string, note: string) =>
        setState((s) => workshop.setBuildNote(s, id, note)),
      deleteBuild: (id: string) => setState((s) => workshop.deleteBuild(s, id)),
      toggleFavorite: (id: string) => setState((s) => workshop.toggleFavorite(s, id)),
      saveEntry: (draft: ToolboxEntry) => setState((s) => workshop.saveEntry(s, draft)),
      deleteEntry: (id: string) => setState((s) => workshop.deleteEntry(s, id)),
    }),
    [],
  );

  return { state, ...actions };
}
