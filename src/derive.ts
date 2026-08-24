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
  queued: { tint: 'var(--stone-tint)', solid: 'var(--stone)' },
  printing: { tint: 'var(--sea-tint)', solid: 'var(--sea)' },
  sanding: { tint: 'var(--neutral-tint)', solid: 'var(--neutral)' },
  priming: { tint: 'var(--olive-tint)', solid: 'var(--olive)' },
  painting: { tint: 'var(--lemon-tint)', solid: 'var(--lemon)' },
  assembling: { tint: 'var(--indigo-tint)', solid: 'var(--indigo)' },
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
export const STATIONS: { status: PartStatus; label: string; noun: string }[] = [
  { status: 'priming', label: 'SPRAY PRIMER', noun: 'primer' },
  { status: 'sanding', label: 'SANDING', noun: 'sanding' },
  { status: 'assembling', label: 'GLUE UP', noun: 'glue-up' },
  { status: 'painting', label: 'AIRBRUSH', noun: 'paint' },
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

/** Donut color: basil once a build reads as finishing, sea until then. */
export const progressColor = (b: Build) =>
  progressPct(b) >= NEARLY_DONE * 100 ? 'var(--basil)' : 'var(--sea)';

export const nextStatus = (s: PartStatus): PartStatus =>
  PIPELINE[Math.min(PIPELINE.indexOf(s) + 1, PIPELINE.length - 1)];

/** Steps offered by the Advance ▾ menu: every other step, in pipeline order — rework can jump either way. */
export const otherSteps = (s: PartStatus): PartStatus[] => PIPELINE.filter((status) => status !== s);

export interface BatchGroup {
  status: PartStatus;
  label: string;
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

/**
 * The rows a parts list should render: either a single part, or the run of parts
 * that make up one assembly. Members are pulled together here, so the list can't
 * scatter them by sorting — an assembly arrives as one row, whole.
 *
 * Runs are built from the parts handed in, so a member filtered out of view
 * simply isn't in the run; a group with one member left standing is a plain row,
 * since a bracket over a single part means nothing.
 */
export function partRows(parts: Part[]): (Part | Part[])[] {
  const byGroup = assemblies(parts);
  const seen = new Set<string>();
  const rows: (Part | Part[])[] = [];
  for (const p of parts) {
    if (seen.has(p.id)) continue;
    const members = p.linkGroupId ? byGroup.get(p.linkGroupId)! : [p];
    for (const m of members) seen.add(m.id);
    rows.push(members.length > 1 ? members : members[0]);
  }
  return rows;
}

export interface AssemblyBadge {
  /** Who else is in the assembly, and which of them have fallen behind. */
  title: string;
  inStep: boolean;
}

/**
 * The link badge on a part, or `null` when it belongs to no assembly. Members
 * *should* sit on the same step; the badge reports drift rather than preventing it.
 */
export function assemblyBadge(part: Part, links: Part[]): AssemblyBadge | null {
  if (!links.length) return null;
  const names = links.map((l) => l.name).join(', ');
  const behind = links.filter((l) => l.status !== part.status);
  if (!behind.length) return { title: `Linked to ${names} — same step`, inStep: true };
  const detail = behind.map((l) => `${l.name} (${STATUS_LABEL[l.status]})`).join(', ');
  return { title: `Linked to ${names} — catch up: ${detail}`, inStep: false };
}

/** The rest of a part's assembly, looked up in a flat list rather than a prepared index. */
export const assemblyMembers = (part: Part, parts: Part[]): Part[] =>
  siblings(part, assemblies(parts));

/** Parts that could still join this part's assembly — never itself, never a current member. */
export function linkCandidates(part: Part, parts: Part[]): Part[] {
  const members = new Set(assemblyMembers(part, parts).map((p) => p.id));
  return parts.filter((p) => p.id !== part.id && !members.has(p.id));
}
