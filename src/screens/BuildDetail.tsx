import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Build, Part, PartStatus, Screen, Step } from '../types.ts';
import type { PartDrop } from '../workshop.ts';
import {
  stepTokens,
  assemblies,
  assemblyName,
  barHeight,
  buildUpdatedAt,
  countByStatus,
  partRows,
  partsAt,
  partsDone,
  siblings,
  sortByProgress,
  stepName,
  timeAgo,
} from '../derive.ts';
import { StageBar, StageFlow } from './StageFlow.tsx';
import { PHOTO_EDGE, uploadImage } from '../icons.ts';
import { LeftRail } from '../ui/Shell.tsx';
import { PartRow } from './PartRow.tsx';
import { PartTile } from './PartTile.tsx';
import type { PartActions } from './AdvanceMenu.tsx';
import ui from '../ui/ui.module.css';
import s from './build.module.css';

/** How wide a member row is against a loose one: the panel's padding, both sides. */
const PANEL_INSET = 28;

/** The spacing the list and a panel are laid out with, as the stylesheet has it. */
const LIST_GAP = 12;
const MEMBER_GAP = 4;

/**
 * A press becomes a drag only after this much movement, so a tap still opens the
 * Advance menu and still collapses an assembly.
 */
const DRAG_SLOP = 5;

/** A drop, read off whichever target the pointer is over. */
interface Aim {
  /** The part the drop is anchored to, or the assembly when it's a panel edge. */
  target: PartDrop['target'];
  before: boolean;
  /** Whether landing here also means joining the assembly under the pointer. */
  joins: boolean;
}

const noop = () => {};

/**
 * Rows and panel edges sit inside the panel they belong to, so the pointer is
 * always over several drop targets at once. Specific beats general: a row's half
 * first, then the strip above or below a panel, then the panel itself.
 */
const rank = (id: string) => (id.startsWith('row:') ? 0 : id.endsWith(':in') ? 2 : 1);
const nearest: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length < 2) return hits;
  return [[...hits].sort((a, b) => rank(String(a.id)) - rank(String(b.id)))[0]];
};

/**
 * The assembly's spread across the pipeline, at header scale: no counts, no
 * labels, the tooltip carries the breakdown. It reports the whole assembly, not
 * the slice filtering has left on screen — the head is about the assembly.
 */
function MiniFlow({ members, steps }: { members: Part[]; steps: Step[] }) {
  const spread = steps.map((stage) => ({ ...stage, count: countByStatus(members, stage.id) }));
  const title = spread
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${stepName(s.id, steps).toLowerCase()}`)
    .join(' · ');

  return (
    <span className={s.miniFlow} title={title}>
      {spread.map((stage) => (
        <span key={stage.id} className={s.miniStage}>
          <StageBar
            count={stage.count}
            color={stage.count === 0 ? 'var(--border)' : stepTokens(stage.id, steps).solid}
            height={barHeight(stage.count, 4, 20)}
          />
        </span>
      ))}
    </span>
  );
}

/**
 * The head of an assembly in the list: what the group is called, how much of it
 * you're looking at, and where its members sit. No badge, no timestamp, no
 * Advance — those belong to a part, and this is not one.
 */
function AssemblyHead({
  visible,
  steps,
  all,
  collapsed,
  onToggle,
  onName,
  handle = {},
}: {
  /** The members currently on screen; `all` is the assembly whole. */
  visible: Part[];
  steps: Step[];
  all: Part[];
  collapsed: boolean;
  onToggle: () => void;
  onName: (name: string) => void;
  /** Drag wiring, when this head is the handle for its whole assembly. */
  handle?: Record<string, unknown>;
}) {
  const stored = assemblyName(all);
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    const trimmed = (draft ?? '').trim();
    if (trimmed !== (stored ?? '')) onName(trimmed);
    setDraft(null);
  };

  // The whole strip toggles, so anything you can click inside it has to stop there.
  const own = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div className={s.groupHead} onClick={onToggle} {...handle}>
      {/* No handler of its own — the click bubbles to the strip, so the button
          is what a keyboard reaches and the strip is still what a mouse hits. */}
      <button
        className={`${s.caret} ${collapsed ? s.caretShut : ''}`}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Open' : 'Close'} this assembly`}
      >
        <CaretIcon />
      </button>
      {draft === null ? (
        <>
          <span className={stored ? s.groupName : s.groupNameEmpty}>
            {stored || '+ Name this assembly'}
          </span>
          {visible.length < all.length && (
            <span className={s.groupCount}>
              · {visible.length} of {all.length}
            </span>
          )}
          <button
            className={s.namePen}
            aria-label={stored ? `Rename ${stored}` : 'Name this assembly'}
            onClick={(e) => {
              own(e);
              setDraft(stored ?? '');
            }}
          >
            ✎
          </button>
        </>
      ) : (
        <input
          className={s.groupField}
          autoFocus
          placeholder="Name this assembly"
          value={draft}
          onClick={own}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
      )}
      <MiniFlow members={all} steps={steps} />
    </div>
  );
}

/** One chevron: down when the group is open, rotated a quarter turn when shut. */
function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9.5 12 15.5 18 9.5" />
    </svg>
  );
}

/**
 * An assembly on the list: one tinted block, dragged by its head. Its own
 * padding is the strip above and below it — a drop there sits the part beside
 * the assembly, while anywhere else on the panel means joining it.
 */
function GroupPanel({
  groupId,
  children,
  head,
}: {
  groupId: string;
  children: React.ReactNode;
  head: (handle: Record<string, unknown>) => React.ReactNode;
}) {
  const drag = useDraggable({ id: `group:${groupId}`, data: { kind: 'group', groupId } });
  const body = useDroppable({ id: `panel:${groupId}:in` });
  const above = useDroppable({ id: `panel:${groupId}:above` });
  const below = useDroppable({ id: `panel:${groupId}:below` });

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        body.setNodeRef(el);
      }}
      data-group={groupId}
      className={s.linkGroup}
    >
      <span ref={above.setNodeRef} className={`${s.half} ${s.edgeTop}`} aria-hidden />
      <span ref={below.setNodeRef} className={`${s.half} ${s.edgeBottom}`} aria-hidden />
      {head({ ...drag.listeners, ...drag.attributes })}
      {children}
    </div>
  );
}

/** Only rows animate; changing gap heights immediately keeps the layout stable. */
function Hole({ open, height, pull = 0 }: { open: boolean; height: number; pull?: number }) {
  // Inside a panel the hole is a flex item, so it arrives with a gap in front of
  // it whether it is open or not; the pull takes that back.
  return (
    <div data-drop-gap style={{ height: open ? height : 0, marginTop: -pull }} aria-hidden />
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.5h5v2" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </svg>
  );
}

function BuildName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    const trimmed = (draft ?? '').trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setDraft(null);
  };

  if (draft === null) {
    return (
      <div className={s.nameRow}>
        <div className={s.name}>{name}</div>
        <button className={s.namePen} onClick={() => setDraft(name)} aria-label="Rename build">
          ✎
        </button>
      </div>
    );
  }

  return (
    <div className={s.nameRow}>
      <input
        className={s.nameField}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
    </div>
  );
}

/** Edited in place, the way the name above it is — one idiom per header. */
function BuildNote({ note, onSave }: { note?: string; onSave: (note: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        className={`${s.note} ${note ? '' : s.noteEmpty}`}
        onClick={() => setDraft(note ?? '')}
      >
        {note || '+ Add a note'}
      </button>
    );
  }

  return (
    <textarea
      className={s.noteField}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed !== (note ?? '')) onSave(trimmed);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

/**
 * A picture of the thing being made, in the rail. On day one there's nothing
 * finished to photograph, so this is usually the model listing's render or a
 * slicer screenshot — which is the point: it has to be there while the work is.
 */
function BuildPhoto({ image, onPick }: { image?: string; onPick: (url: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be picked twice
    if (!file) return;
    setUploading(true);
    try {
      onPick(await uploadImage(file, PHOTO_EDGE));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={ui.railBlock}>
      <div className={ui.kicker}>THIS BUILD</div>
      <label
        className={image ? s.photo : s.photoEmpty}
        title={uploading ? 'Adding…' : image ? 'Replace photo' : undefined}
      >
        {image ? <img src={image} alt="" /> : uploading ? 'Adding…' : '+ Add photo'}
        <input
          type="file"
          accept="image/*"
          className={s.fileInput}
          aria-label={image ? 'Replace the build photo' : 'Add a build photo'}
          disabled={uploading}
          onChange={choose}
        />
      </label>
      {error && <div className={s.photoError}>{error}</div>}
    </div>
  );
}

export function BuildDetail({
  build,
  onNavigate,
  onBack,
  onAddPart,
  onEditSteps,
  onRenameBuild,
  onDeleteBuild,
  onLinkPart,
  onSetImage,
  onSetNote,
  onNameAssembly,
  onDrop,
  rowActions,
}: {
  build: Build;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onAddPart: () => void;
  onEditSteps: () => void;
  onRenameBuild: (name: string) => void;
  onDeleteBuild: () => void;
  onLinkPart: (id: string) => void;
  onSetImage: (image: string) => void;
  onSetNote: (note: string) => void;
  onNameAssembly: (partId: string, name: string) => void;
  onDrop: (drop: PartDrop) => void;
  rowActions: Omit<PartActions, 'onLink'>;
}) {
  const [stage, setStage] = useState<PartStatus | null>(null);
  const [view, setView] = useState<'tiles' | 'list'>('tiles');
  // 'manual' is the parts array as the maker has dragged it — the old 'recent'
  // was the same order under a name that only described how it started out.
  const [sortMode, setSortMode] = useState<'manual' | 'progress'>('manual');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // "Get this out of my way for a minute" — not a property of the assembly, so
  // it lives here and every group is open again next time the build is opened.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  // What is in flight: one part, or a whole assembly picked up by its head.
  const [lift, setLift] = useState<PartDrop['source'] | null>(
    null,
  );
  /** Where it would land: which row or panel, on which side, and whether it joins. */
  const [aim, setAim] = useState<Aim | null>(null);
  /** What the thing in hand measured, which is the room it needs to land. */
  const flyingHeight = useRef(0);
  /** The width a part flies at when it would land outside an assembly. */
  const listRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_SLOP } }),
  );

  // One listener for the whole page: only one menu is ever open.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    if (stage && !build.steps.some((step) => step.id === stage)) setStage(null);
    setOpenMenu(null);
  }, [build.steps]);

  const done = partsDone(build);

  const byGroup = useMemo(() => assemblies(build.parts), [build.parts]);

  // The screen owns filtering and sorting; derive turns what's left into rows.
  const kept = useMemo(() => {
    const filtered = stage ? partsAt(build.parts, stage) : build.parts;
    return sortMode === 'progress' ? sortByProgress(filtered, build.steps) : filtered;
  }, [build.parts, build.steps, stage, sortMode]);

  const actions: PartActions = { ...rowActions, onLink: onLinkPart };

  // Capture the visible positions before a preview changes. Animate only the
  // rows' transforms afterwards, never the heights used to measure drop targets.
  const beforeLayout = useRef(new Map<HTMLElement, number>());
  const animations = useRef<Animation[]>([]);
  const inHand = (node: HTMLElement) => lift?.kind === 'part'
    ? node.dataset.part === lift.id
    : lift?.kind === 'group' && node.closest('[data-group]')?.getAttribute('data-group') === lift.id;
  const captureLayout = () => {
    const list = listRef.current;
    beforeLayout.current.clear();
    if (!list) return;
    const top = list.getBoundingClientRect().top;
    for (const node of list.querySelectorAll<HTMLElement>('[data-part], [data-group]')) {
      if (!inHand(node)) beforeLayout.current.set(node, node.getBoundingClientRect().top - top);
    }
  };

  useLayoutEffect(() => {
    for (const animation of animations.current) animation.cancel();
    animations.current = [];
    const list = listRef.current;
    const before = beforeLayout.current;
    if (!list || !before.size) return;
    const top = list.getBoundingClientRect().top;
    const after = new Map([...before.keys()].filter(node => list.contains(node))
      .map(node => [node, node.getBoundingClientRect().top - top]));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const [node, position] of after) {
        if (inHand(node)) continue;
        const parent = node.parentElement?.closest<HTMLElement>('[data-group]');
        const parentShift = parent && before.has(parent) && after.has(parent)
          ? before.get(parent)! - after.get(parent)! : 0;
        const shift = before.get(node)! - position - parentShift;
        if (Math.abs(shift) < 0.5) continue;
        animations.current.push(node.animate(
          [{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }],
          { duration: 150, easing: 'ease-out' },
        ));
      }
    }
    before.clear();
  }, [aim, lift, build.parts]);

  useEffect(() => () => {
    for (const animation of animations.current) animation.cancel();
  }, []);

  const clearDrag = () => {
    captureLayout();
    setLift(null);
    setAim(null);
  };

  /** The id of a drop target, read back into where the thing would land. */
  const readAim = (id: string | null): Aim | null => {
    if (!id) return null;
    const [kind, key, side] = id.split(':');
    if (kind === 'row') {
      const part = build.parts.find((p) => p.id === key);
      return part ? { target: { kind: 'part', id: key }, before: side === 'before', joins: true } : null;
    }
    if (kind === 'panel') {
      if (side === 'in') return { target: { kind: 'group', id: key }, before: false, joins: true };
      return { target: { kind: 'group', id: key }, before: side === 'above', joins: false };
    }
    return null;
  };

  /** The part a landing is measured against, and whose assembly it would join. */
  const anchorPart = (a: Aim): Part | undefined => {
    if (a.target.kind === 'part') {
      const { id } = a.target;
      return build.parts.find((p) => p.id === id);
    }
    const members = byGroup.get(a.target.id) ?? [];
    return a.before ? members[0] : members[members.length - 1];
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const kind = active.data.current?.kind === 'group' ? 'group' : 'part';
    const id = kind === 'group' ? String(active.data.current?.groupId) : String(active.id);
    // A whole assembly leaves a panel-sized hole; a part, a row-sized one.
    const node = document.querySelector(
      kind === 'group' ? `[data-group="${id}"]` : `[data-part="${id}"]`,
    );
    flyingHeight.current = node?.getBoundingClientRect().height ?? 0;
    captureLayout();
    setOpenMenu(null);
    setLift({ kind, id });
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    captureLayout();
    setAim(readAim(over ? String(over.id) : null));
  };

  const onDragEnd = ({ over }: DragEndEvent) => {
    const a = readAim(over ? String(over.id) : null);
    if (a && lift) onDrop({ ...a, source: lift, reorder: sortMode === 'manual' });
    clearDrag();
  };

  /** Keep the source's space until there is a destination gap. Internal moves
   * trade equal heights so neither the assembly nor its scroll position jumps. */
  const move = (() => {
    if (!lift || !aim) return null;
    const target = anchorPart(aim);
    if (!target) return null;
    if (lift.kind === 'group') return target.linkGroupId === lift.id ? null : aim;
    return target.id === lift.id ? null : aim;
  })();

  /**
   * The slot of the thing in hand: its own height at lift-off, then nothing.
   * A flex item at no height still has a gap on either side of it, so the
   * negative margin eats the one the list would otherwise be left holding.
   */
  const lifted = (kind: 'part' | 'group', id: string, gap: number) => {
    if (lift?.kind !== kind || lift.id !== id) return undefined;
    const shut = !!move;
    return {
      height: shut ? 0 : flyingHeight.current,
      marginBottom: shut ? -gap : 0,
      overflow: 'hidden' as const,
      visibility: 'hidden' as const,
    };
  };

  /** Does the gap belong before or after this row, and is one open at all? */
  const gapAt = (partId: string, side: 'before' | 'after') => {
    if (!move || move.target.kind !== 'part') return false;
    return move.target.id === partId && move.before === (side === 'before');
  };

  const gapAtPanel = (groupId: string, side: 'above' | 'below' | 'in') => {
    if (!move || move.target.kind !== 'group' || move.target.id !== groupId) return false;
    return side === 'in' ? move.joins : !move.joins && move.before === (side === 'above');
  };

  const shared = (part: Part) => ({
    part,
    steps: build.steps,
    links: siblings(part, byGroup),
    menuOpen: openMenu === part.id,
    onOpenMenu: setOpenMenu,
    actions,
  });

  /**
   * What the maker is holding. A part flies at the width it would land at —
   * a member's inside an assembly, the list's outside one — so the size in hand
   * answers the question the drop is about to.
   */
  const flying = (() => {
    if (!lift) return null;
    if (lift.kind === 'group') {
      const members = byGroup.get(lift.id) ?? [];
      return (
        <div className={`${s.linkGroup} ${s.flying}`}>
          <AssemblyHead steps={build.steps} visible={members} all={members} collapsed={false} onToggle={noop} onName={noop} />
          {members.map((m) => (
            <PartRow key={m.id} {...shared(m)} overlay />
          ))}
        </div>
      );
    }
    const part = build.parts.find((p) => p.id === lift.id);
    if (!part) return null;
    const listWidth = listRef.current?.getBoundingClientRect().width ?? 0;
    // Narrow only where it would actually land inside a panel — over a loose row
    // it stays list width, which is what a loose row is.
    const target = move && move.joins ? anchorPart(move) : undefined;
    const asMember = !!target?.linkGroupId;
    return (
      <div className={s.flying} style={{ width: asMember ? listWidth - PANEL_INSET : listWidth }}>
        <PartRow {...shared(part)} overlay />
      </div>
    );
  })();

  // An assembly arrives as one row: the panel holds its head and its members.
  const renderRun = (run: Part[]) => {
    const groupId = run[0].linkGroupId!;
    const isShut = collapsed.includes(groupId);
    return (
      <div key={groupId} className={s.slot} style={lifted('group', groupId, LIST_GAP)}>
        <Hole open={gapAtPanel(groupId, 'above')} height={flyingHeight.current + LIST_GAP} />
        <GroupPanel
          groupId={groupId}
          head={(handle) => (
            <AssemblyHead
              steps={build.steps}
              visible={run}
              all={byGroup.get(groupId) ?? run}
              collapsed={isShut}
              onToggle={() =>
                setCollapsed((ids) =>
                  ids.includes(groupId) ? ids.filter((x) => x !== groupId) : [...ids, groupId],
                )
              }
              onName={(name) => onNameAssembly(run[0].id, name)}
              handle={handle}
            />
          )}
        >
          {!isShut && run.map((part) => renderRow(part, MEMBER_GAP))}
          <Hole
            open={gapAtPanel(groupId, 'in')}
            height={flyingHeight.current + MEMBER_GAP}
            pull={MEMBER_GAP}
          />
        </GroupPanel>
        <Hole open={gapAtPanel(groupId, 'below')} height={flyingHeight.current + LIST_GAP} />
      </div>
    );
  };

  /**
   * A row and the room on either side of it. The hole is the seam it would open:
   * the height the part needs plus the gap that would sit above it, since the
   * seam already carries one.
   */
  const renderRow = (part: Part, gap: number) => (
    <div key={part.id} className={s.slot} style={lifted('part', part.id, gap)}>
      <Hole open={gapAt(part.id, 'before')} height={flyingHeight.current + gap} />
      <PartRow {...shared(part)} />
      <Hole open={gapAt(part.id, 'after')} height={flyingHeight.current + gap} />
    </div>
  );

  return (
    <div className={`${ui.page} ${ui.pageWide}`}>
      <LeftRail
        active="dashboard"
        onNavigate={onNavigate}
        bottom={
          <>
            <button className={ui.btnDanger} onClick={onDeleteBuild}>
              <TrashIcon />
              Delete Project
            </button>
            <button className={ui.btnOutline} onClick={onAddPart}>
              + Add part
            </button>
          </>
        }
      >
        <BuildPhoto image={build.image} onPick={onSetImage} />
      </LeftRail>

      <div className={ui.col}>
        <div className={s.header}>
          <button className={s.back} onClick={onBack}>
            ◂ Dashboard
          </button>
          <div className={s.headRow}>
            <div>
              <BuildName name={build.name} onRename={onRenameBuild} />
              <div className={s.meta}>updated {timeAgo(buildUpdatedAt(build))}</div>
              <BuildNote note={build.note} onSave={onSetNote} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={s.figure}>
                {done}
                <span>/{build.parts.length}</span>
              </div>
              <div className={s.figureKicker}>PARTS DONE</div>
            </div>
          </div>
          <div className={s.flowHeading}>
            <span className={s.figureKicker}>STEPS · PARTS NEEDING THIS WORK</span>
            <button className={s.sortToggle} onClick={onEditSteps}>Edit steps</button>
          </div>
          <StageFlow steps={build.steps} parts={build.parts} picked={stage} onPick={setStage} />
        </div>

        <div className={s.filterRow}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            {stage ? `${stepName(stage, build.steps)} — ${kept.length}` : `Parts — ${build.parts.length}`}
          </span>
          <div className={s.filters}>
            <button
              className={`${s.filter} ${stage === null ? s.filterActive : ''}`}
              onClick={() => setStage(null)}
            >
              All {build.parts.length}
            </button>
            <button
              className={s.sortToggle}
              onClick={() => setView((v) => (v === 'tiles' ? 'list' : 'tiles'))}
              title="Tiles show the whole build at once; the list shows notes, times and assemblies"
            >
              View: {view === 'tiles' ? 'Tiles' : 'List'}
            </button>
            <button
              className={s.sortToggle}
              onClick={() => setSortMode((m) => (m === 'manual' ? 'progress' : 'manual'))}
              title="Manual is the order you have dragged the parts into; Progress sorts by how far along each is, done last"
            >
              Sort: {sortMode === 'progress' ? 'Progress' : 'Manual'}
            </button>
          </div>
        </div>

        {kept.length === 0 ? (
          <div className={s.empty}>
            Nothing at this step.{' '}
            <button className={s.emptyClear} onClick={() => setStage(null)}>
              Show all {build.parts.length}
            </button>
          </div>
        ) : view === 'tiles' ? (
          <div className={s.tiles}>
            {kept.map((part) => (
              <PartTile key={part.id} {...shared(part)} />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={nearest}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={clearDrag}
          >
            <div className={s.rows} ref={listRef}>
              {partRows(kept).map((row) => (Array.isArray(row) ? renderRun(row) : renderRow(row, LIST_GAP)))}
            </div>
            <DragOverlay dropAnimation={null}>{flying}</DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
