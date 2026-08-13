import type { Build, Part, PartStatus } from './types.ts';

export const PIPELINE: PartStatus[] = [
  'queued',
  'printing',
  'smoothing',
  'priming',
  'painting',
  'assembling',
  'done',
];

export const STATUS_LABEL: Record<PartStatus, string> = {
  queued: 'QUEUED',
  printing: 'PRINTING',
  smoothing: 'SMOOTHING',
  priming: 'PRIMING',
  painting: 'PAINTING',
  assembling: 'ASSEMBLING',
  done: 'DONE',
};

/** Pill / dot / bar colors, keyed by status. */
export const STATUS_TOKENS: Record<PartStatus, { tint: string; solid: string }> = {
  queued: { tint: 'var(--neutral-tint)', solid: 'var(--neutral)' },
  printing: { tint: 'var(--sea-tint)', solid: 'var(--sea)' },
  smoothing: { tint: 'var(--neutral-tint)', solid: 'var(--neutral)' },
  priming: { tint: 'var(--lemon-tint)', solid: 'var(--lemon)' },
  painting: { tint: 'var(--lemon-tint)', solid: 'var(--lemon)' },
  assembling: { tint: 'var(--basil-tint)', solid: 'var(--basil)' },
  done: { tint: 'var(--basil-tint)', solid: 'var(--basil)' },
};

/** Stage flow columns on the build detail header (pipeline order, DONE widest). */
export const STAGES: { status: PartStatus; label: string }[] = [
  { status: 'queued', label: 'QUEUE' },
  { status: 'printing', label: 'PRINT' },
  { status: 'smoothing', label: 'SMOOTH' },
  { status: 'priming', label: 'PRIME' },
  { status: 'painting', label: 'PAINT' },
  { status: 'assembling', label: 'ASSY' },
  { status: 'done', label: 'DONE' },
];

/** The manual operations a batch session can be set up for. */
export const STATIONS: { status: PartStatus; label: string; verb: string; noun: string }[] = [
  { status: 'priming', label: 'SPRAY PRIMER', verb: 'Prime', noun: 'primer' },
  { status: 'smoothing', label: 'SAND / SMOOTH', verb: 'Sand', noun: 'sanding' },
  { status: 'assembling', label: 'GLUE UP', verb: 'Glue', noun: 'glue-up' },
  { status: 'painting', label: 'AIRBRUSH', verb: 'Airbrush', noun: 'paint' },
];

export const BATCH_THRESHOLD = 3;
/** At or above this share of parts done, a build reads as finishing. */
export const NEARLY_DONE = 0.85;

/** A part is hands-off while it cures — or while its print is still running. */
export const isHandsOff = (p: Part, now = Date.now()) =>
  !!p.curingUntil && Date.parse(p.curingUntil) > now;

export const partsDone = (b: Build) => b.parts.filter((p) => p.status === 'done').length;

export const progressPct = (b: Build) =>
  b.parts.length === 0 ? 0 : (partsDone(b) / b.parts.length) * 100;

export const countByStatus = (parts: Part[], status: PartStatus) =>
  parts.filter((p) => p.status === status).length;

/**
 * Pills shown on a build card: non-zero counts, pipeline order with queued last.
 * DONE is only worth a pill once the build is finishing — otherwise the donut says it.
 */
export function statusPills(b: Build): { status: PartStatus; count: number }[] {
  const order: PartStatus[] = [
    'printing',
    'smoothing',
    'priming',
    'painting',
    'assembling',
    'done',
    'queued',
  ];
  return order
    .filter((s) => s !== 'done' || progressPct(b) >= NEARLY_DONE * 100)
    .map((status) => ({ status, count: countByStatus(b.parts, status) }))
    .filter((p) => p.count > 0);
}

/** Donut color: finishing → basil, waiting on the maker → lemon, otherwise sea. */
export function progressColor(b: Build): string {
  if (progressPct(b) >= NEARLY_DONE * 100) return 'var(--basil)';
  return suggestedNextStep(b)?.tone === 'print' ? 'var(--sea)' : 'var(--lemon)';
}

export const nextStatus = (s: PartStatus): PartStatus =>
  PIPELINE[Math.min(PIPELINE.indexOf(s) + 1, PIPELINE.length - 1)];

/** Steps offered by the Advance ▾ menu: every other step, in pipeline order — rework can jump either way. */
export const otherSteps = (s: PartStatus): PartStatus[] => PIPELINE.filter((status) => status !== s);

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

const nameList = (parts: Part[]) => {
  const shown = parts.slice(0, 3).map((p) => lower(p.name));
  return parts.length > 3 ? `${shown.join(', ')}…` : shown.join(', ');
};

export interface NextStep {
  text: string;
  tone: 'manual' | 'glue' | 'print';
  status: PartStatus;
  parts: Part[];
}

/**
 * The highest-priority actionable group in a build: parts ready for the next
 * manual operation (prime → glue → sand) first, then parts waiting to print.
 */
export function suggestedNextStep(b: Build): NextStep | null {
  for (const status of ['priming', 'assembling', 'smoothing'] as PartStatus[]) {
    const parts = b.parts.filter((p) => p.status === status);
    if (!parts.length) continue;
    const station = STATIONS.find((s) => s.status === status)!;
    return {
      text:
        parts.length === 1
          ? `${station.verb} ${lower(parts[0].name)}`
          : `${station.verb} ${parts.length} parts — ${nameList(parts)}`,
      tone: status === 'assembling' ? 'glue' : 'manual',
      status,
      parts,
    };
  }
  const queued = b.parts.filter((p) => p.status === 'queued');
  if (queued.length)
    return {
      text: `Print next: ${lower(queued[0].name)}`,
      tone: 'print',
      status: 'queued',
      parts: queued.slice(0, 1),
    };
  return null;
}

export interface BatchGroup {
  status: PartStatus;
  label: string;
  verb: string;
  noun: string;
  parts: Part[];
  buildCount: number;
  actionable: boolean;
}

/**
 * Cross-build: every part whose next operation is the same station. Parts that
 * are curing (or still printing) are hands-off and don't count. A group is only
 * worth setting up at BATCH_THRESHOLD parts. Recommended group first — the one
 * clearing the most builds in one setup, count breaking ties.
 */
export function batchGroups(builds: Build[], now = Date.now()): BatchGroup[] {
  const groups = STATIONS.map((station) => {
    const parts = builds.flatMap((b) =>
      b.parts.filter((p) => p.status === station.status && !isHandsOff(p, now)),
    );
    return {
      ...station,
      parts,
      buildCount: new Set(parts.map((p) => p.buildId)).size,
      actionable: parts.length >= BATCH_THRESHOLD,
    };
  });
  const rank = (g: BatchGroup) =>
    g.actionable ? g.buildCount * 1000 + g.parts.length : g.parts.length;
  return groups.sort((a, b) => rank(b) - rank(a));
}

export const recommendedGroup = (groups: BatchGroup[]) =>
  groups[0]?.actionable ? groups[0] : null;

/** Parts the maker has to pick up and do something with, across all builds. */
export const partsWaitingOnYou = (builds: Build[], now = Date.now()) =>
  batchGroups(builds, now).reduce((n, g) => n + g.parts.length, 0);

// ——— formatting ———

const MIN = 60_000;

export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m ago`;
  if (ms < 24 * 60 * MIN) return `${Math.round(ms / (60 * MIN))}h ago`;
  if (ms < 48 * 60 * MIN) return 'yesterday';
  if (ms < 7 * 24 * 60 * MIN) return `${Math.round(ms / (24 * 60 * MIN))}d ago`;
  return shortDate(iso);
}

/** "1h 40m" left on a run — minutes only under an hour. */
export function timeLeft(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / MIN));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Timestamp column on a part row. */
export function partTime(p: Part, now = Date.now()): string {
  if (p.status === 'printing' && isHandsOff(p, now)) return `running ${timeLeft(p.curingUntil!, now)}`;
  return timeAgo(p.updatedAt, now);
}

export const buildUpdatedAt = (b: Build) =>
  b.parts.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), b.startedAt);

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.round((Date.parse(iso) - now) / (24 * 60 * MIN));
}

/** Parts that are hands-off for a reason other than a running print. */
export const curingParts = (builds: Build[], now = Date.now()) =>
  builds.flatMap((b) => b.parts.filter((p) => p.status !== 'printing' && isHandsOff(p, now)));

/** The rest of a part's assembly — other parts sharing its link group, that should stay on the same step. */
export const linkGroup = (build: Build, part: Part): Part[] =>
  part.linkGroupId ? build.parts.filter((p) => p.id !== part.id && p.linkGroupId === part.linkGroupId) : [];

/** Queued first, done last — how far each part has come through the pipeline. */
export const sortByProgress = (parts: Part[]): Part[] =>
  [...parts].sort((a, b) => PIPELINE.indexOf(a.status) - PIPELINE.indexOf(b.status));

/** Reorders a part list so each assembly's members sit next to each other, so the UI can draw connectors between them. */
export function groupLinked(parts: Part[]): Part[] {
  const seen = new Set<string>();
  const out: Part[] = [];
  for (const p of parts) {
    if (seen.has(p.id)) continue;
    out.push(p);
    seen.add(p.id);
    if (p.linkGroupId) {
      for (const q of parts) {
        if (q.id !== p.id && q.linkGroupId === p.linkGroupId && !seen.has(q.id)) {
          out.push(q);
          seen.add(q.id);
        }
      }
    }
  }
  return out;
}
