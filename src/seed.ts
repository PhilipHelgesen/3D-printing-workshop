import type { Build, Part, PartStatus, State, ToolboxEntry } from './types.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Mock workshop, seeded relative to first load so "14m ago" reads right.
 * Numbers match the handoff: 62 parts, 31 done, and batch groups of 5/8/5/2.
 */
export function seedState(now = Date.now()): State {
  const ago = (ms: number) => new Date(now - ms).toISOString();

  let seq = 0;
  const build = (
    id: string,
    name: string,
    startedAt: string,
    parts: [string, PartStatus, number][],
  ): Build => ({
    id,
    name,
    startedAt,
    parts: parts.map(
      ([partName, status, agoMs]): Part => ({
        id: `p${++seq}`,
        buildId: id,
        name: partName,
        status,
        updatedAt: ago(agoMs),
      }),
    ),
  });

  const done = (names: string[], firstAgo: number): [string, PartStatus, number][] =>
    names.map((n, i) => [n, 'done', firstAgo - i * DAY]);

  return {
    builds: [
      build('b1', 'Mandalorian Beskar Set', ago(68 * DAY), [
        ['Pauldron L', 'priming', 2 * HOUR],
        ['Pauldron R', 'priming', 2 * HOUR],
        ['Vambrace, left', 'sanding', 26 * HOUR],
        ['Vambrace, right', 'sanding', 26 * HOUR],
        ['Knee, right', 'printing', 14 * MIN],
        ['Cod piece', 'printing', 40 * MIN],
        ['Gauntlet, left', 'queued', 3 * DAY],
        ['Helmet dome', 'done', 68 * DAY],
        ['Chest plate', 'done', 66 * DAY],
        ['Belt buckle', 'sanding', 5 * HOUR],
        ...done(
          [
            'Backplate',
            'Shoulder bell L',
            'Shoulder bell R',
            'Thigh L',
            'Thigh R',
            'Shin L',
            'Shin R',
            'Boot cap L',
            'Boot cap R',
            'Gauntlet, right',
            'Knee, left',
            'Belt panel',
            'Jetpack shell',
            'Jetpack nozzle',
            'Rangefinder',
            'Chest emblem',
          ],
          64 * DAY,
        ),
      ]),
      build('b2', 'Hunter Helmet v3', ago(40 * DAY), [
        ['Chin vent', 'printing', 2 * HOUR],
        ['Mandible', 'painting', 5 * HOUR],
        ['Brow plate', 'painting', 6 * HOUR],
        ['Cheek plate L', 'priming', 8 * HOUR],
        ['Cheek plate R', 'priming', 9 * HOUR],
        ['Antenna mount', 'queued', 3 * DAY],
        ['Rangefinder stalk', 'queued', 4 * DAY],
        ...done(['Dome shell', 'Visor frame', 'Ear cap L', 'Ear cap R'], 30 * DAY),
      ]),
      build('b3', 'Energy Sword Prop', ago(55 * DAY), [
        ['Blade halves', 'assembling', 3 * DAY],
        ...done(
          ['Hilt shell L', 'Hilt shell R', 'Emitter', 'Grip wrap', 'Blade core', 'Power cell', 'Guard'],
          20 * DAY,
        ),
      ]),
      build('b4', 'Pip-Boy Cuff', ago(30 * DAY), [
        ['Screen bezel', 'printing', 5 * DAY],
        ['Dial ring', 'sanding', 6 * DAY],
        ['Knob A', 'sanding', 6 * DAY],
        ['Knob B', 'sanding', 7 * DAY],
        ['Speaker grille', 'sanding', 7 * DAY],
        ['Antenna', 'sanding', 8 * DAY],
        ['Wrist band', 'priming', 6 * DAY],
        ['Gauge cluster', 'assembling', 7 * DAY],
        ['Switch bank', 'assembling', 7 * DAY],
        ['Battery cover', 'assembling', 8 * DAY],
        ['Cable guard', 'assembling', 9 * DAY],
        ['Screen lens', 'queued', 10 * DAY],
        ['Strap buckle', 'queued', 10 * DAY],
        ['Side panel L', 'queued', 11 * DAY],
        ['Side panel R', 'queued', 11 * DAY],
        ...done(['Cuff base', 'Hinge pin'], 12 * DAY),
      ]),
    ],
    toolbox: TOOLBOX,
  };
}

const entry = (
  id: string,
  kind: 'tool' | 'technique',
  name: string,
  note?: string,
  favorite = false,
  iconId = 'a',
): ToolboxEntry => ({ id, kind, name, note, iconId, favorite });

const TOOLBOX: ToolboxEntry[] = [
  entry('t1', 'tool', 'Filler primer', 'Rust-Oleum grey', true),
  entry('t2', 'tool', 'Heat gun', undefined, true, 'b'),
  entry('t3', 'tool', 'Airbrush', '0.4mm needle', true, 'b'),
  entry('t4', 'tool', 'Rotary tool', 'sanding drums low', true, 'c'),
  entry('t5', 'tool', 'Graphite powder'),
  entry('t6', 'tool', 'Spray paint', '6 cans, mixed', false, 'b'),
  entry('t7', 'tool', 'CA glue + activator'),
  entry('t8', 'tool', 'Epoxy putty', undefined, false, 'c'),
  entry('t9', 'tool', 'Sanding sponges', '220 / 400 / 800'),
  entry('t10', 'tool', 'Wet sandpaper', undefined, false, 'b'),
  entry('t11', 'tool', 'Respirator', 'P2 filters', false, 'c'),
  entry('t12', 'tool', 'Spray booth'),
  entry('t13', 'tool', 'Hobby knife', undefined, false, 'b'),
  entry('t14', 'tool', 'Digital calipers'),
  entry('t15', 'tool', 'Contour gauge', undefined, false, 'c'),
  entry('t16', 'tool', 'Magnets 6mm', 'running low'),
  entry('t17', 'tool', 'Velcro + straps', undefined, false, 'b'),
  entry('t18', 'tool', 'Worbla scraps'),
  entry('k1', 'technique', 'Seam filling', 'putty, then 220'),
  entry('k2', 'technique', 'Heat smoothing', undefined, false, 'b'),
  entry('k3', 'technique', 'Graphite buffing', 'over black base'),
  entry('k4', 'technique', 'Battle damage', undefined, false, 'c'),
  entry('k5', 'technique', 'Magnet mounting', undefined, false, 'b'),
  entry('k6', 'technique', 'Strapping'),
];

export const ICON_IDS = ['a', 'b', 'c'];

export const ICON_TINTS: Record<string, string> = {
  a: 'var(--lemon-tint)',
  b: 'var(--sea-tint)',
  c: 'var(--basil-tint)',
};
