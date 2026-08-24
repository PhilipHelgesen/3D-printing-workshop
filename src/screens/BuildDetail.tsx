import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Build, Part, PartStatus, Screen } from '../types.ts';
import {
  STAGES,
  STATUS_LABEL,
  STATUS_TOKENS,
  assemblies,
  buildUpdatedAt,
  countByStatus,
  partRows,
  partsDone,
  siblings,
  sortByProgress,
  timeAgo,
} from '../derive.ts';
import { PHOTO_EDGE, uploadImage } from '../icons.ts';
import { LeftRail } from '../ui/Shell.tsx';
import { PartRow } from './PartRow.tsx';
import { PartTile } from './PartTile.tsx';
import type { PartActions } from './AdvanceMenu.tsx';
import ui from '../ui/ui.module.css';
import s from './build.module.css';

/** Bars read against each other, not against the column: +8px a part, capped. */
const barHeight = (count: number) => (count === 0 ? 5 : Math.min(62, 4 + 8 * count));

const stageLabel = (status: PartStatus) =>
  STATUS_LABEL[status].charAt(0) + STATUS_LABEL[status].slice(1).toLowerCase();

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
            <span
              className={s.stageBar}
              style={{
                height: barHeight(count),
                background: empty ? 'var(--track)' : STATUS_TOKENS[stage.status].solid,
              }}
            />
            <span className={s.stageLabel} style={empty && !on ? { color: 'var(--muted)' } : undefined}>
              {stage.label}
            </span>
          </button>
        );
      })}
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
  const input = useRef<HTMLInputElement>(null);
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
      <input ref={input} type="file" accept="image/*" hidden onChange={choose} />
      {image ? (
        <button
          className={s.photo}
          onClick={() => input.current?.click()}
          disabled={uploading}
          title={uploading ? 'Replacing…' : 'Replace photo'}
        >
          <img src={image} alt="" style={uploading ? { opacity: 0.5 } : undefined} />
        </button>
      ) : (
        <button
          className={s.photoEmpty}
          onClick={() => input.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Adding…' : '+ Add photo'}
        </button>
      )}
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
  rowActions: Omit<PartActions, 'onLink'>;
}) {
  const [stage, setStage] = useState<PartStatus | null>(null);
  const [view, setView] = useState<'tiles' | 'list'>('tiles');
  const [sortMode, setSortMode] = useState<'recent' | 'progress'>('recent');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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
    const filtered = stage ? build.parts.filter((p) => p.status === stage) : build.parts;
    return sortMode === 'progress' ? sortByProgress(filtered) : filtered;
  }, [build.parts, stage, sortMode]);

  const rows = useMemo(() => partRows(kept), [kept]);

  const actions: PartActions = { ...rowActions, onLink: onLinkPart };

  const shared = (part: Part) => ({
    part,
    links: siblings(part, byGroup),
    menuOpen: openMenu === part.id,
    onOpenMenu: setOpenMenu,
    actions,
  });

  // An assembly arrives as one row, so a single bracket spans exactly its members.
  const renderRun = (run: Part[]) => (
    <div key={`group-${run[0].id}`} className={s.linkGroup}>
      <div className={s.linkBracket} />
      {run.map((part) => (
        <PartRow key={part.id} {...shared(part)} />
      ))}
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
          <StageFlow parts={build.parts} picked={stage} onPick={setStage} />
        </div>

        <div className={s.filterRow}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            {stage ? `${stageLabel(stage)} — ${kept.length}` : `Parts — ${build.parts.length}`}
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
            {rows.map((row) =>
              Array.isArray(row) ? renderRun(row) : <PartRow key={row.id} {...shared(row)} />,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
