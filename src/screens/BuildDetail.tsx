import { useEffect, useState, type ReactNode } from 'react';
import type { Build, Part, PartStatus } from '../types.ts';
import {
  STAGES,
  STATIONS,
  STATUS_LABEL,
  STATUS_TOKENS,
  batchGroups,
  buildUpdatedAt,
  countByStatus,
  curingParts,
  daysUntil,
  groupLinked,
  isHandsOff,
  linkGroup,
  nextStatus,
  otherSteps,
  partTime,
  partsDone,
  shortDate,
  sortByProgress,
  suggestedNextStep,
  timeAgo,
  timeLeft,
} from '../derive.ts';
import { STEP_SHELF } from '../seed.ts';
import { LeftRail, ShelfList, ui, type Screen } from '../ui/Shell.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';
import s from './build.module.css';

const PAGE = 9;

const TONE_BG = {
  manual: 'var(--lemon-tint)',
  glue: 'var(--basil-tint)',
  print: 'var(--sea-tint)',
};

const label = (status: PartStatus) => status.charAt(0).toUpperCase() + status.slice(1);
const stationOf = (status: PartStatus) => STATIONS.find((st) => st.status === status);

/** Bars read against each other, not against the column: +8px a part, capped. */
const barHeight = (count: number) => (count === 0 ? 5 : Math.min(62, 4 + 8 * count));

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export function BuildDetail({
  build,
  builds,
  onNavigate,
  onBack,
  onAddPart,
  onRenameBuild,
  onMove,
  onAdvance,
  onRename,
  onNote,
  onDelete,
  onLinkPart,
}: {
  build: Build;
  builds: Build[];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onAddPart: () => void;
  onRenameBuild: (name: string) => void;
  onMove: (ids: string[], status: PartStatus) => void;
  onAdvance: (ids: string[]) => void;
  onRename: (id: string) => void;
  onNote: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkPart: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs' | 'done'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'progress'>('recent');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(build.name);

  useEffect(() => {
    setEditingName(false);
  }, [build.id]);

  const saveName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== build.name) onRenameBuild(trimmed);
    else setNameDraft(build.name);
  };

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
  const next = suggestedNextStep(build);
  const group = next ? batchGroups(builds).find((g) => g.status === next.status) : undefined;
  const elsewhere = group
    ? group.parts.length - group.parts.filter((p) => p.buildId === build.id).length
    : 0;
  const waiting = curingParts([build]);

  const byFilter = build.parts.filter((p) =>
    filter === 'all' ? true : filter === 'done' ? p.status === 'done' : p.status !== 'done',
  );
  // Linked pairs are pulled adjacent last, after ordering — pairing wins over strict progress order.
  const filtered = groupLinked(sortMode === 'progress' ? sortByProgress(byFilter) : byFilter);
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  const picked = build.parts.filter((p) => selected.includes(p.id));
  const sharedStatus =
    picked.length > 0 && picked.every((p) => p.status === picked[0].status) ? picked[0].status : null;
  const sharedStation = sharedStatus ? stationOf(sharedStatus) : undefined;

  const toggle = (part: Part) =>
    setSelected((ids) =>
      ids.includes(part.id) ? ids.filter((id) => id !== part.id) : [...ids, part.id],
    );

  const runSelection = () => {
    onAdvance(selected);
    setSelected([]);
  };

  const renderRow = (part: Part, links: Part[]): ReactNode => {
    const isDone = part.status === 'done';
    const isSelected = selected.includes(part.id);
    const outOfStep = links.filter((l) => l.status !== part.status);
    return (
      <div
        key={part.id}
        className={`${s.row} ${isSelected ? s.rowSelected : ''} ${isDone ? s.rowDone : ''}`}
      >
        <button
          className={`${s.check} ${isSelected ? s.checkOn : ''} ${isDone ? s.checkDone : ''}`}
          disabled={isDone}
          aria-label={`Select ${part.name}`}
          onClick={() => toggle(part)}
        >
          {isDone && <span />}
        </button>
        <div className={s.partInfo}>
          <span className={s.nameLine}>
            <span className={s.partName}>{part.name}</span>
            {links.length > 0 && (
              <span
                className={`${s.linkBadge} ${outOfStep.length ? s.linkBadgeOff : ''}`}
                title={
                  outOfStep.length === 0
                    ? `Linked to ${links.map((l) => l.name).join(', ')} — same step`
                    : `Linked to ${links.map((l) => l.name).join(', ')} — catch up: ${outOfStep
                        .map((l) => `${l.name} (${STATUS_LABEL[l.status]})`)
                        .join(', ')}`
                }
              >
                <LinkIcon />
              </span>
            )}
          </span>
          {part.note && <span className={s.partNote}>{part.note}</span>}
        </div>
        <StatusPill status={part.status} />
        <span className={s.stamp}>{partTime(part)}</span>
        <button
          className={`${s.advance} ${openMenu === part.id ? s.advanceOpen : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenu(openMenu === part.id ? null : part.id);
          }}
        >
          Advance <span>▾</span>
        </button>
        {openMenu === part.id && (
          <div className={s.menu} onClick={(e) => e.stopPropagation()}>
            <div className={s.menuKicker}>MOVE TO STEP</div>
            {otherSteps(part.status).map((status) => (
              <button
                key={status}
                className={`${s.menuItem} ${status === nextStatus(part.status) ? s.menuNext : ''}`}
                onClick={() => {
                  onMove([part.id], status);
                  setOpenMenu(null);
                }}
              >
                <span className={s.menuDot} style={{ background: STATUS_TOKENS[status].solid }} />
                {status === 'queued' ? 'Back to queue' : label(status)}
                {status === nextStatus(part.status) && <span className={s.menuTag}>next</span>}
              </button>
            ))}
            <div className={s.menuRule} />
            <button
              className={s.menuItem}
              onClick={() => {
                onRename(part.id);
                setOpenMenu(null);
              }}
            >
              Rename part
            </button>
            <button
              className={s.menuItem}
              onClick={() => {
                onNote(part.id);
                setOpenMenu(null);
              }}
            >
              Notes &amp; details
            </button>
            <button
              className={s.menuItem}
              onClick={() => {
                onLinkPart(part.id);
                setOpenMenu(null);
              }}
            >
              {links.length ? `Edit link (${links.length + 1})` : 'Link part'}
            </button>
            <button
              className={`${s.menuItem} ${s.menuDanger}`}
              onClick={() => {
                onDelete(part.id);
                setOpenMenu(null);
              }}
            >
              Delete part
            </button>
          </div>
        )}
      </div>
    );
  };

  const rows: ReactNode[] = [];
  for (let i = 0; i < visible.length; i++) {
    const part = visible[i];
    if (part.linkGroupId && visible[i + 1]?.linkGroupId === part.linkGroupId) {
      const run = [part];
      let j = i + 1;
      while (j < visible.length && visible[j].linkGroupId === part.linkGroupId) {
        run.push(visible[j]);
        j++;
      }
      rows.push(
        <div key={`group-${part.id}`} className={s.linkGroup}>
          <div className={s.linkBracket} />
          {run.map((rp) => renderRow(rp, linkGroup(build, rp)))}
        </div>,
      );
      i = j - 1;
    } else {
      rows.push(renderRow(part, linkGroup(build, part)));
    }
  }

  return (
    <div className={ui.page}>
      <LeftRail
        active="dashboard"
        onNavigate={onNavigate}
        bottom={
          <button className={ui.btnOutline} onClick={onAddPart}>
            + Add part
          </button>
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
              <div className={s.nameRow}>
                {editingName ? (
                  <input
                    className={s.nameField}
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') {
                        setNameDraft(build.name);
                        setEditingName(false);
                      }
                    }}
                  />
                ) : (
                  <>
                    <div className={s.name}>{build.name}</div>
                    <button
                      className={s.namePen}
                      onClick={() => {
                        setNameDraft(build.name);
                        setEditingName(true);
                      }}
                      aria-label="Rename build"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
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
          <div className={s.flow}>
            {STAGES.map((stage) => {
              const count = countByStatus(build.parts, stage.status);
              return (
                <div
                  key={stage.status}
                  className={`${s.stage} ${stage.status === 'done' ? s.stageWide : ''}`}
                >
                  <span className={`${s.stageCount} ${count === 0 ? s.stageEmpty : ''}`}>{count}</span>
                  <span
                    className={s.stageBar}
                    style={{
                      height: barHeight(count),
                      background: count === 0 ? 'var(--track)' : STATUS_TOKENS[stage.status].solid,
                    }}
                  />
                  <span
                    className={s.stageLabel}
                    style={count === 0 ? { color: 'var(--muted)' } : undefined}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
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
            <button className={s.selectionBtn} onClick={runSelection}>
              {sharedStation ? `${sharedStation.verb} them together ▸` : 'Advance them ▸'}
            </button>
          </div>
        )}

        <div className={s.rows}>
          {rows}
          {!showAll && filtered.length > PAGE && (
            <button className={s.showMore} onClick={() => setShowAll(true)}>
              Show {filtered.length - PAGE} more parts
            </button>
          )}
        </div>
      </div>

      <div className={ui.col}>
        {next && (
          <div className={s.nextCard} style={{ background: TONE_BG[next.tone] }}>
            <div className={s.nextKicker}>NEXT STEP</div>
            <div className={s.nextTitle}>
              {group ? `${group.verb} ${next.parts.length} ${next.parts.length === 1 ? 'part' : 'parts'}` : next.text}
            </div>
            {elsewhere > 0 && group && (
              <div className={s.nextSub}>
                {elsewhere} more parts elsewhere are ready for {group.noun} too.
              </div>
            )}
            {group && (
              <div className={s.nextParts}>
                {next.parts.map((p) => (
                  <button key={p.id} className={s.nextPart} onClick={() => onAdvance([p.id])}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {waiting.length > 0 && (
          <div className={ui.card} style={{ flex: 'none' }}>
            <div className={ui.cardTitle}>Waiting</div>
            {waiting.map((p) => (
              <div key={p.id} className={s.waitRow}>
                <span className={s.waitDot} />
                <div>
                  <div className={s.waitName}>{p.name}</div>
                  <div className={s.waitNote}>
                    {isHandsOff(p) ? `curing — free in ${timeLeft(p.curingUntil!)}` : 'ready'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={ui.card} style={{ flex: 'none' }}>
          <div className={ui.cardTitle}>For the next step</div>
          <ShelfList materials={STEP_SHELF} />
        </div>
      </div>
    </div>
  );
}
