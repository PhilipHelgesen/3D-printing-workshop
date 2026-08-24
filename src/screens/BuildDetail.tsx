import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { Build, Part, PartStatus, Screen } from '../types.ts';
import {
  STAGES,
  STATUS_TOKENS,
  assemblies,
  assemblyName,
  barHeight,
  buildUpdatedAt,
  countByStatus,
  isSegmented,
  partRows,
  partsAt,
  partsDone,
  siblings,
  sortByProgress,
  stepName,
  timeAgo,
} from '../derive.ts';
import { PHOTO_EDGE, uploadImage } from '../icons.ts';
import { LeftRail } from '../ui/Shell.tsx';
import { PartRow } from './PartRow.tsx';
import { PartTile } from './PartTile.tsx';
import type { PartActions } from './AdvanceMenu.tsx';
import ui from '../ui/ui.module.css';
import s from './build.module.css';

/**
 * One stage's bar. Up to three parts it is drawn as that many pieces you can
 * count; past that the pieces stop being countable and it goes solid. The height
 * carries the count either way, which is what the two charts have in common.
 */
function StageBar({ count, color, height }: { count: number; color: string; height: number }) {
  const pieces = isSegmented(count) ? count : 1;
  return (
    <span className={s.stageBar} style={{ height }}>
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} className={s.stagePiece} style={{ background: color }} />
      ))}
    </span>
  );
}

/** `empty` is the track colour, which has to stand off whatever the bar sits on. */
const stageColor = (count: number, status: PartStatus, empty = 'var(--track)') =>
  count === 0 ? empty : STATUS_TOKENS[status].solid;

/**
 * The pipeline, and the way the page is filtered. The maker arrives having
 * already picked the operation he's set up for, so the counts are the control:
 * click SAND and the list below is the parts that need sanding (ADR-0006).
 */
function StageFlow({
  parts,
  picked,
  onPick,
}: {
  parts: Part[];
  picked: PartStatus | null;
  onPick: (status: PartStatus | null) => void;
}) {
  return (
    <div className={s.flow}>
      {STAGES.map((stage) => {
        const count = countByStatus(parts, stage.status);
        const empty = count === 0;
        const on = picked === stage.status;
        // An empty stage has nothing to filter to. A picked one stays live even at
        // zero, so clearing the last part at a step doesn't strand the filter.
        return (
          <button
            key={stage.status}
            className={[
              s.stage,
              stage.status === 'done' ? s.stageWide : '',
              on ? s.stageOn : '',
              picked && !on ? s.stageDim : '',
            ].join(' ')}
            aria-pressed={on}
            disabled={empty && !on}
            onClick={() => onPick(on ? null : stage.status)}
          >
            <span className={`${s.stageCount} ${empty ? s.stageEmpty : ''}`}>{count}</span>
            <StageBar
              count={count}
              color={stageColor(count, stage.status)}
              height={barHeight(count)}
            />
            <span className={s.stageLabel}>{stage.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The assembly's spread across the pipeline, at header scale: no counts, no
 * labels, the tooltip carries the breakdown. It reports the whole assembly, not
 * the slice filtering has left on screen — the head is about the assembly.
 */
function MiniFlow({ members }: { members: Part[] }) {
  const spread = STAGES.map((stage) => ({ ...stage, count: countByStatus(members, stage.status) }));
  const title = spread
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${stepName(s.status).toLowerCase()}`)
    .join(' · ');

  return (
    <span className={s.miniFlow} title={title}>
      {spread.map((stage) => (
        <span key={stage.status} className={s.miniStage}>
          <StageBar
            count={stage.count}
            color={stageColor(stage.count, stage.status, 'var(--border)')}
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
  all,
  collapsed,
  onToggle,
  onName,
}: {
  /** The members currently on screen; `all` is the assembly whole. */
  visible: Part[];
  all: Part[];
  collapsed: boolean;
  onToggle: () => void;
  onName: (name: string) => void;
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
    <div className={`${s.groupHead} ${collapsed ? s.groupCollapsed : ''}`} onClick={onToggle}>
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
      <MiniFlow members={all} />
    </div>
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
  onRenameBuild,
  onDeleteBuild,
  onLinkPart,
  onSetImage,
  onSetNote,
  onNameAssembly,
  rowActions,
}: {
  build: Build;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onAddPart: () => void;
  onRenameBuild: (name: string) => void;
  onDeleteBuild: () => void;
  onLinkPart: (id: string) => void;
  onSetImage: (image: string) => void;
  onSetNote: (note: string) => void;
  onNameAssembly: (partId: string, name: string) => void;
  rowActions: Omit<PartActions, 'onLink'>;
}) {
  const [stage, setStage] = useState<PartStatus | null>(null);
  const [view, setView] = useState<'tiles' | 'list'>('tiles');
  const [sortMode, setSortMode] = useState<'recent' | 'progress'>('recent');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // "Get this out of my way for a minute" — not a property of the assembly, so
  // it lives here and every group is open again next time the build is opened.
  const [collapsed, setCollapsed] = useState<string[]>([]);

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

  const done = partsDone(build);

  const byGroup = useMemo(() => assemblies(build.parts), [build.parts]);

  // The screen owns filtering and sorting; derive turns what's left into rows.
  const kept = useMemo(() => {
    const filtered = stage ? partsAt(build.parts, stage) : build.parts;
    return sortMode === 'progress' ? sortByProgress(filtered) : filtered;
  }, [build.parts, stage, sortMode]);

  const actions: PartActions = { ...rowActions, onLink: onLinkPart };

  const shared = (part: Part) => ({
    part,
    links: siblings(part, byGroup),
    menuOpen: openMenu === part.id,
    onOpenMenu: setOpenMenu,
    actions,
  });

  // An assembly arrives as one row: the bracket spans its head and its members.
  const renderRun = (run: Part[]) => {
    const groupId = run[0].linkGroupId!;
    const isShut = collapsed.includes(groupId);
    return (
      <div key={groupId} className={s.linkGroup}>
        <div className={s.linkBracket} />
        <AssemblyHead
          visible={run}
          all={byGroup.get(groupId) ?? run}
          collapsed={isShut}
          onToggle={() =>
            setCollapsed((ids) =>
              ids.includes(groupId) ? ids.filter((x) => x !== groupId) : [...ids, groupId],
            )
          }
          onName={(name) => onNameAssembly(run[0].id, name)}
        />
        {!isShut && run.map((part) => <PartRow key={part.id} {...shared(part)} />)}
      </div>
    );
  };

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
          <StageFlow parts={build.parts} picked={stage} onPick={setStage} />
        </div>

        <div className={s.filterRow}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            {stage ? `${stepName(stage)} — ${kept.length}` : `Parts — ${build.parts.length}`}
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
              onClick={() => setSortMode((m) => (m === 'recent' ? 'progress' : 'recent'))}
              title="Sort by how far along each part is — done parts sink to the bottom"
            >
              Sort: {sortMode === 'progress' ? 'Progress' : 'Recent'}
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
          <div className={s.rows}>
            {partRows(kept).map((row) =>
              Array.isArray(row) ? renderRun(row) : <PartRow key={row.id} {...shared(row)} />,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
