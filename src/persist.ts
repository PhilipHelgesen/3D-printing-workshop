// The workshop copy: turning a stored blob into state we trust, and deciding
// when a change is owed to the cloud. Kept out of `store.ts` — and free of React
// and Supabase imports — so `npm run check` can reach it. See ADR-0004.
import type { Build, PartStatus, State } from './types.ts';
import { seedState } from './seed.ts';

/** The `smoothing` stage was renamed `sanding`; copies stored before that still say it. */
const normalizePartStatus = (status: string): PartStatus =>
  status === 'smoothing' ? 'sanding' : (status as PartStatus);

/**
 * A stored blob migrated into the shape this version expects. There is no
 * `ALTER TABLE` for a JSON blob (ADR-0001), so every rename lands here instead.
 * Throws on a blob it can't read at all — both callers guard for that.
 */
export function normalizeState(state: State): State {
  return {
    ...state,
    builds: state.builds.map(({ ...build }) => {
      // `deadline` was deleted with the whole idea of a date on a build (ADR-0006).
      delete (build as Build & { deadline?: string }).deadline;
      return {
        ...build,
        parts: build.parts.map((part) => ({
          ...part,
          status: normalizePartStatus(part.status),
        })),
      };
    }),
  };
}

/**
 * The stored copy, or a fresh workshop when there's nothing readable there.
 * Takes the raw string rather than reading storage itself: `localStorage` doesn't
 * exist in Node, and reading it can throw on its own (Safari with "Block All
 * Cookies"), which is the caller's problem to catch.
 */
export function parseStored(raw: string | null): State {
  try {
    if (raw) return normalizeState(JSON.parse(raw) as State);
  } catch {
    // corrupt, or a shape this version can't read — start fresh rather than crash
  }
  return seedState();
}

/**
 * Whether a change is *not* owed to the cloud — the guard at the top of the push
 * effect. `known` is what the cloud is known to hold: `undefined` until the pull
 * settles, `''` when there's nothing up there yet, otherwise the JSON it returned.
 * Make it past this and the push is safe.
 */
export const shouldSkipPush = (known: string | undefined, next: string): boolean =>
  known === undefined || known === next;
