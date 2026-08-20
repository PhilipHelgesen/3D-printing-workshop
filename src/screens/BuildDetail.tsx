import { useMemo, useState, type ReactNode } from 'react';
import type { Build, Part, PartStatus, Screen } from '../types.ts';
import {
  STAGES,
  STATIONS,
  STATUS_TOKENS,
  assemblies,
  buildPlan,
  buildUpdatedAt,
  countByStatus,
  daysUntil,
  groupLinked,
  partsDone,
  shortDate,
  siblings,
  sortByProgress,
  timeAgo,
} from '../derive.ts';
import { LeftRail } from '../ui/Shell.tsx';
import { PartRow, type PartRowActions } from './PartRow.tsx';
import ui from '../ui/ui.module.css';
import s from './build.module.css';

const PAGE = 9;

const TONE_BG = {
  manual: 'var(--lemon-tint)',
  glue: 'var(--basil-tint)',
  print: 'var(--sea-tint)',
};

/** Bars read against each other, not against the column: +8px a part, capped. */
const barHeight = (count: number) => (count === 0 ? 5 : Math.min(62, 4 + 8 * count));

function StageFlow({ parts }: { parts: Part[] }) {
  return (
    <div className={s.flow}>
      {STAGES.map((stage) => {
        const count = countByStatus(parts, stage.status);
        const empty = count === 0;
        return (
          <div key={stage.status} className={`${s.stage} ${stage.status === 'done' ? s.stageWide : ''}`}>
            <span className={`${s.stageCount} ${empty ? s.stageEmpty : ''}`}>{count}</span>
            <span
              className={s.stageBar}
              style={{
                height: barHeight(count),
                background: empty ? 'var(--track)' : STATUS_TOKENS[stage.status].solid,
              }}
            />
            <span className={s.stageLabel} style={empty ? { color: 'var(--muted)' } : undefined}>
              {stage.label}
            </span>
          </div>
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

export function BuildDetail({
  build,
  builds,
  onNavigate,
  onBack,
  onAddPart,
  onRenameBuild,
  onDeleteBuild,
  onAdvance,
  onLinkPart,
  rowActions,
}: {
  build: Build;
  builds: Build[];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onAddPart: () => void;
  onRenameBuild: (name: string) => void;
  onDeleteBuild: () => void;
  onAdvance: (ids: string[]) => void;
  onLinkPart: (id: string) => void;
  rowActions: Omit<PartRowActions, 'onToggleSelect' | 'onLink'>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs' | 'done'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'progress'>('recent');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const done = partsDone(build);
  const plan = buildPlan(build, builds);

  const byGroup = useMemo(() => assemblies(build.parts), [build.parts]);

  const visible = useMemo(() => {
    const kept = build.parts.filter((p) =>
      filter === 'all' ? true : filter === 'done' ? p.status === 'done' : p.status !== 'done',
    );
    // Assemblies are pulled together last, so a linked pair stays adjacent whatever the sort.
    return groupLinked(sortMode === 'progress' ? sortByProgress(kept) : kept);
  }, [build.parts, filter, sortMode]);

  const shown = showAll ? visible : visible.slice(0, PAGE);

  const picked = build.parts.filter((p) => selected.includes(p.id));
  const sharedStatus =
    picked.length > 0 && picked.every((p) => p.status === picked[0].status) ? picked[0].status : null;
  const sharedStation = sharedStatus ? STATIONS.find((st) => st.status === sharedStatus) : undefined;

  const actions: PartRowActions = {
    ...rowActions,
    onLink: onLinkPart,
    onToggleSelect: (id) =>
      setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
  };

  const renderRow = (part: Part) => (
    <PartRow
      key={part.id}
      part={part}
      links={siblings(part, byGroup)}
      isSelected={selected.includes(part.id)}
      menuOpen={openMenu === part.id}
      onOpenMenu={setOpenMenu}
      actions={actions}
    />
  );

  // Consecutive members of one assembly get wrapped so a single bracket spans them.
  const rows: ReactNode[] = [];
  for (let i = 0; i < shown.length; i++) {
    const groupId = shown[i].linkGroupId;
    if (!groupId || shown[i + 1]?.linkGroupId !== groupId) {
      rows.push(renderRow(shown[i]));
      continue;
    }
    const run: Part[] = [];
    while (i < shown.length && shown[i].linkGroupId === groupId) run.push(shown[i++]);
    i--;
    rows.push(
      <div key={`group-${run[0].id}`} className={s.linkGroup}>
        <div className={s.linkBracket} />
        {run.map(renderRow)}
      </div>,
    );
  }

  return (
    <div className={ui.page}>
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
        <div className={ui.railBlock}>
          <div className={ui.kicker}>THIS BUILD</div>
          <div className={ui.statRows}>
            <div className={ui.statRow}>
              <span>Parts</span>
              <span className={ui.statValue}>{build.parts.length}</span>
            </div>
            <div className={ui.statRow}>
              <span>Started</span>
              <span className={ui.statValue}>{shortDate(build.startedAt)}</span>
            </div>
            <div className={ui.statRow}>
              <span>In queue</span>
              <span className={ui.statValue}>{countByStatus(build.parts, 'queued')}</span>
            </div>
          </div>
        </div>
      </LeftRail>

      <div className={ui.col}>
        <div className={s.header}>
          <button className={s.back} onClick={onBack}>
            ◂ Dashboard
          </button>
          <div className={s.headRow}>
            <div>
              <BuildName name={build.name} onRename={onRenameBuild} />
              <div className={s.meta}>
                updated {timeAgo(buildUpdatedAt(build))}
                {build.deadline && ` · con in ${daysUntil(build.deadline)} days`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={s.figure}>
                {done}
                <span>/{build.parts.length}</span>
              </div>
              <div className={s.figureKicker}>PARTS DONE</div>
            </div>
          </div>
          <StageFlow parts={build.parts} />
        </div>

        <div className={s.filterRow}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Parts</span>
          <div className={s.filters}>
            <button
              className={`${s.filter} ${filter === 'all' ? s.filterActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All {build.parts.length}
            </button>
            <button
              className={`${s.filter} ${filter === 'needs' ? s.filterActive : ''}`}
              onClick={() => setFilter('needs')}
            >
              Needs me {build.parts.length - done}
            </button>
            <button
              className={`${s.filter} ${s.filterMuted} ${filter === 'done' ? s.filterActive : ''}`}
              onClick={() => setFilter('done')}
            >
              Done {done}
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

        {selected.length > 0 && (
          <div className={s.selectionBar}>
            <span className={s.selectionText}>
              {selected.length} {selected.length === 1 ? 'part' : 'parts'} selected —{' '}
              {sharedStation
                ? `${selected.length === 1 ? '' : selected.length === 2 ? 'both ' : 'all '}waiting on ${sharedStation.noun}`
                : 'mixed steps'}
            </span>
            <button
              className={s.selectionBtn}
              onClick={() => {
                onAdvance(selected);
                setSelected([]);
              }}
            >
              {sharedStation ? `${sharedStation.verb} them together ▸` : 'Advance them ▸'}
            </button>
          </div>
        )}

        <div className={s.rows}>
          {rows}
          {!showAll && visible.length > PAGE && (
            <button className={s.showMore} onClick={() => setShowAll(true)}>
              Show {visible.length - PAGE} more parts
            </button>
          )}
        </div>
      </div>

      <div className={ui.col}>
        {plan && (
          <div className={s.nextCard} style={{ background: TONE_BG[plan.tone] }}>
            <div className={s.nextKicker}>NEXT STEP</div>
            <div className={s.nextTitle}>{plan.title}</div>
            {plan.subtitle && <div className={s.nextSub}>{plan.subtitle}</div>}
            {plan.parts.length > 0 && (
              <div className={s.nextParts}>
                {plan.parts.map((p) => (
                  <button key={p.id} className={s.nextPart} onClick={() => onAdvance([p.id])}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
