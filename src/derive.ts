import type { Build, Part, PartStatus } from './types.ts';

export const PIPELINE: PartStatus[] = [
  'queued',
  'printing',
  'sanding',
  'priming',
  'painting',
  'assembling',
  'done',
];

export const STATUS_LABEL: Record<PartStatus, string> = {
  queued: 'QUEUED',
  printing: 'PRINTING',
  sanding: 'SANDING',
  priming: 'PRIMING',
  painting: 'PAINTING',
  assembling: 'ASSEMBLING',
  done: 'DONE',
};

/** Pill / dot / bar colors, keyed by status. */
export const STATUS_TOKENS: Record<PartStatus, { tint: string; solid: string }> = {
  queued: { tint: 'var(--neutral-tint)', solid: 'var(--neutral)' },
  printing: { tint: 'var(--sea-tint)', solid: 'var(--sea)' },
  sanding: { tint: 'var(--neutral-tint)', solid: 'var(--neutral)' },
  priming: { tint: 'var(--lemon-tint)', solid: 'var(--lemon)' },
  painting: { tint: 'var(--lemon-tint)', solid: 'var(--lemon)' },
  assembling: { tint: 'var(--basil-tint)', solid: 'var(--basil)' },
  done: { tint: 'var(--basil-tint)', solid: 'var(--basil)' },
};

/** Stage flow columns on the build detail header (pipeline order, DONE widest). */
export const STAGES: { status: PartStatus; label: string }[] = [
  { status: 'queued', label: 'QUEUE' },
  { status: 'printing', label: 'PRINT' },
  { status: 'sanding', label: 'SAND' },
  { status: 'priming', label: 'PRIME' },
  { status: 'painting', label: 'PAINT' },
  { status: 'assembling', label: 'ASSY' },
  { status: 'done', label: 'DONE' },
];

/** The manual operations a batch session can be set up for. */
export const STATIONS: { status: PartStatus; label: string; verb: string; noun: string }[] = [
  { status: 'priming', label: 'SPRAY PRIMER', verb: 'Prime', noun: 'primer' },
  { status: 'sanding', label: 'SANDING', verb: 'Sand', noun: 'sanding' },
  { status: 'assembling', label: 'GLUE UP', verb: 'Glue', noun: 'glue-up' },
  { status: 'painting', label: 'AIRBRUSH', verb: 'Airbrush', noun: 'paint' },
];

export const BATCH_THRESHOLD = 3;
/** At or above this share of parts done, a build reads as finishing. */
export const NEARLY_DONE = 0.85;

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
    'sanding',
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

interface NextStep {
  tone: 'manual' | 'glue' | 'print';
  status: PartStatus;
  parts: Part[];
}

/**
 * The highest-priority actionable group in a build: parts ready for the next
 * manual operation (prime → glue → sand) first, then parts waiting to print.
 * Private — `buildPlan` is how the screens ask this; `progressColor` wants the tone.
 */
function suggestedNextStep(b: Build): NextStep | null {
  for (const status of ['priming', 'assembling', 'sanding'] as PartStatus[]) {
    const parts = b.parts.filter((p) => p.status === status);
    if (!parts.length) continue;
    return { tone: status === 'assembling' ? 'glue' : 'manual', status, parts };
  }
  const queued = b.parts.filter((p) => p.status === 'queued');
  if (queued.length) return { tone: 'print', status: 'queued', parts: queued.slice(0, 1) };
  return null;
}

export interface BuildPlan {
  title: string;
  /** How much of the same operation is stacked up in other builds, or null. */
  subtitle: string | null;
  tone: 'manual' | 'glue' | 'print';
  /** Parts the card offers to tick off — empty when the next move is a print. */
  parts: Part[];
}

/**
 * The whole "next step" card for one build: what to do, whether it batches with
 * the other builds, and which parts it clears. One call, so the wording and the
 * elsewhere count can't drift apart the way they did when the screen composed them.
 */
export function buildPlan(build: Build, builds: Build[]): BuildPlan | null {
  const next = suggestedNextStep(build);
  if (!next) return null;

  // A print isn't something the maker does at a station — name it and offer nothing.
  if (next.tone === 'print')
    return {
      title: `Print next: ${lower(next.parts[0].name)}`,
      subtitle: null,
      tone: next.tone,
      parts: [],
    };

  const station = STATIONS.find((s) => s.status === next.status)!;
  const elsewhere = builds
    .filter((b) => b.id !== build.id)
    .reduce((n, b) => n + countByStatus(b.parts, next.status), 0);

  return {
    title: `${station.verb} ${next.parts.length} ${next.parts.length === 1 ? 'part' : 'parts'}`,
    subtitle:
      elsewhere > 0 ? `${elsewhere} more parts elsewhere are ready for ${station.noun} too.` : null,
    tone: next.tone,
    parts: next.parts,
  };
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
 * Cross-build: every part whose next operation is the same station. A group is
 * only worth setting up at BATCH_THRESHOLD parts. Recommended group first — the
 * one clearing the most builds in one setup, count breaking ties.
 */
export function batchGroups(builds: Build[]): BatchGroup[] {
  const groups = STATIONS.map((station) => {
    const parts = builds.flatMap((b) => b.parts.filter((p) => p.status === station.status));
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
export const partsWaitingOnYou = (groups: BatchGroup[]) =>
  groups.reduce((n, g) => n + g.parts.length, 0);

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

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const buildUpdatedAt = (b: Build) =>
  b.parts.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), b.startedAt);

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.round((Date.parse(iso) - now) / (24 * 60 * MIN));
}

/**
 * Assembly members by link group id — one pass, so callers can look a part's
 * siblings up instead of rescanning the list for every row.
 */
export function assemblies(parts: Part[]): Map<string, Part[]> {
  const byGroup = new Map<string, Part[]>();
  for (const p of parts) {
    if (!p.linkGroupId) continue;
    const members = byGroup.get(p.linkGroupId);
    if (members) members.push(p);
    else byGroup.set(p.linkGroupId, [p]);
  }
  return byGroup;
}

/** The rest of a part's assembly — the ones that should stay on the same step as it. */
export const siblings = (part: Part, byGroup: Map<string, Part[]>): Part[] =>
  part.linkGroupId ? (byGroup.get(part.linkGroupId) ?? []).filter((p) => p.id !== part.id) : [];

/** Queued first, done last — how far each part has come through the pipeline. */
export const sortByProgress = (parts: Part[]): Part[] =>
  [...parts].sort((a, b) => PIPELINE.indexOf(a.status) - PIPELINE.indexOf(b.status));

/** Reorders a list so each assembly's members sit together, for the UI to bracket them. */
export function groupLinked(parts: Part[]): Part[] {
  const byGroup = assemblies(parts);
  const seen = new Set<string>();
  const out: Part[] = [];
  for (const p of parts) {
    if (seen.has(p.id)) continue;
    for (const member of p.linkGroupId ? byGroup.get(p.linkGroupId)! : [p]) {
      if (seen.has(member.id)) continue;
      out.push(member);
      seen.add(member.id);
    }
  }
  return out;
}
