import type { Build, Part, PartStatus, Step, StepColor } from './types.ts';

/** Work colors come from the app palette; basil is reserved for Done. */
export const STEP_COLORS: { id: Exclude<StepColor, 'basil'>; name: string }[] = [
  { id: 'sea', name: 'Teal' },
  { id: 'neutral', name: 'Sand' },
  { id: 'olive', name: 'Olive' },
  { id: 'lemon', name: 'Gold' },
  { id: 'indigo', name: 'Blue' },
  { id: 'stone', name: 'Stone' },
  { id: 'terra', name: 'Clay' },
  { id: 'rose', name: 'Rose' },
  { id: 'violet', name: 'Violet' },
  { id: 'apricot', name: 'Apricot' },
];

export const DONE_STEP: Step = { id: 'done', name: 'Done', color: 'basil' };
export const defaultSteps = (): Step[] => [
  { id: 'printing', name: 'Print', color: 'sea' },
  { id: 'sanding', name: 'Sand', color: 'neutral' },
  { id: 'priming', name: 'Prime', color: 'olive' },
  { id: 'painting', name: 'Paint', color: 'lemon' },
  { id: 'assembling', name: 'Assemble', color: 'indigo' },
  { ...DONE_STEP },
];

/** Reject invalid stored or edited workflows before parts can refer to them. */
export function validateSteps(steps: Step[]): void {
  if (!Array.isArray(steps) || steps.length < 2 ||
      steps.at(-1)?.id !== 'done' ||
      new Set(steps.map((step) => step.id)).size !== steps.length) {
    throw new Error('Keep at least one work step and Done fixed at the end.');
  }
  for (const step of steps) {
    if (typeof step.id !== 'string' || !step.id.trim() ||
        typeof step.name !== 'string' || !step.name.trim() ||
        (step.id === 'done'
          ? step.name !== DONE_STEP.name || step.color !== DONE_STEP.color
          : !STEP_COLORS.some((color) => color.id === step.color))) {
      throw new Error('Each work step needs a name and a palette color. Done stays unchanged.');
    }
  }
}

export const stepName = (status: PartStatus, steps: Step[]): string =>
  steps.find((step) => step.id === status)?.name ?? status;

export const stepTokens = (status: PartStatus, steps: Step[]) => {
  const color = steps.find((step) => step.id === status)?.color ?? 'stone';
  return { solid: `var(--${color})`, tint: `var(--${color}-tint)` };
};

/** At or above this share of parts done, a build reads as finishing. */
export const NEARLY_DONE = 0.85;

export const partsDone = (b: Build) => b.parts.filter((p) => p.status === 'done').length;

export const progressPct = (b: Build) =>
  b.parts.length === 0 ? 0 : (partsDone(b) / b.parts.length) * 100;

/**
 * How tall a stage's bar stands. Bars read against each other, not against the
 * column: +`step` a part, capped. The mini chart on an assembly head passes a
 * smaller step and cap so the same counts draw smaller.
 */
export const barHeight = (count: number, step = 8, max = 62) =>
  count === 0 ? 5 : Math.min(max, 4 + step * count);

/** Past three, pieces stop being countable and the bar is drawn solid instead. */
const MAX_SEGMENTS = 3;
export const isSegmented = (count: number) => count > 0 && count <= MAX_SEGMENTS;

/**
 * The parts at one step. The build page's whole claim is that the number on a
 * stage and the list under it are the same set (ADR-0006), so they are one
 * expression rather than two that happen to agree.
 */
export const partsAt = (parts: Part[], status: PartStatus) =>
  parts.filter((p) => p.status === status);

export const countByStatus = (parts: Part[], status: PartStatus) =>
  partsAt(parts, status).length;

/** Non-empty steps in the build's order. The donut already reports Done below 85%. */
export function statusPills(b: Build): { status: PartStatus; count: number }[] {
  return b.steps
    .filter((step) => step.id !== 'done' || progressPct(b) >= NEARLY_DONE * 100)
    .map((step) => ({ status: step.id, count: countByStatus(b.parts, step.id) }))
    .filter((pill) => pill.count > 0);
}

/** Donut color: basil once a build reads as finishing, sea until then. */
export const progressColor = (b: Build) =>
  progressPct(b) >= NEARLY_DONE * 100 ? 'var(--basil)' : 'var(--sea)';

export const nextStatus = (s: PartStatus, steps: Step[]): PartStatus =>
  steps[Math.min(steps.findIndex((step) => step.id === s) + 1, steps.length - 1)].id;

/** Steps offered by the Advance ▾ menu: every other step, in pipeline order — rework can jump either way. */
export const otherSteps = (s: PartStatus, steps: Step[]): PartStatus[] =>
  steps.filter((step) => step.id !== s).map((step) => step.id);

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

/** Only `timeAgo` reaches for this now — anything older than a week reads as a date. */
const shortDate = (iso: string) =>
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

/** Build order, Done last. */
export const sortByProgress = (parts: Part[], steps: Step[]): Part[] =>
  [...parts].sort((a, b) => steps.findIndex((step) => step.id === a.status) -
    steps.findIndex((step) => step.id === b.status));

/**
 * The rows a parts list should render: either a single part, or the run of parts
 * that make up one assembly. Members are pulled together here, so the list can't
 * scatter them by sorting — an assembly arrives as one row, whole.
 *
 * Runs are built from the parts handed in, so a member filtered out of view
 * simply isn't in the run. A run of one is still a run: it used to be flattened
 * because a bracket over a single part means nothing, but a run now carries the
 * assembly's name, and being told the part on screen is the last of "Right leg"
 * is exactly what you want when filtering has hidden the rest.
 */
export function partRows(parts: Part[]): (Part | Part[])[] {
  const byGroup = assemblies(parts);
  const seen = new Set<string>();
  const rows: (Part | Part[])[] = [];
  for (const p of parts) {
    if (seen.has(p.id)) continue;
    const members = p.linkGroupId ? byGroup.get(p.linkGroupId)! : [p];
    for (const m of members) seen.add(m.id);
    rows.push(p.linkGroupId ? members : members[0]);
  }
  return rows;
}

/**
 * What a run of linked parts is called, or `undefined` while it is unnamed —
 * the head renders its own invitation for that. Here rather than in the screen
 * because "the name lives on every member" is the model's business, not the
 * list's.
 */
export const assemblyName = (members: Part[]) => members[0]?.linkGroupName;

export interface AssemblyBadge {
  /** Who else is in the assembly, and which of them have fallen behind. */
  title: string;
  inStep: boolean;
}

/**
 * The link badge on a part, or `null` when it belongs to no assembly. Members
 * *should* sit on the same step; the badge reports drift rather than preventing it.
 */
export function assemblyBadge(part: Part, links: Part[], steps: Step[]): AssemblyBadge | null {
  if (!links.length) return null;
  const names = links.map((l) => l.name).join(', ');
  const behind = links.filter((l) => l.status !== part.status);
  if (!behind.length) return { title: `Linked to ${names} — same step`, inStep: true };
  const detail = behind.map((l) => `${l.name} (${stepName(l.status, steps)})`).join(', ');
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
