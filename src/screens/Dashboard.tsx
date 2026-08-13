import type { Build } from '../types.ts';
import {
  BATCH_THRESHOLD,
  batchGroups,
  buildUpdatedAt,
  curingParts,
  partsDone,
  partsWaitingOnYou,
  progressColor,
  progressPct,
  recommendedGroup,
  statusPills,
  suggestedNextStep,
  timeAgo,
  timeLeft,
} from '../derive.ts';
import { SHELF } from '../seed.ts';
import { Illustration, LeftRail, ShelfList, ui, type Screen } from '../ui/Shell.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';
import s from './dashboard.module.css';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = (n: number) => WORDS[n] ?? String(n);

const TONE_BG = {
  manual: 'var(--lemon-tint)',
  glue: 'var(--basil-tint)',
  print: 'var(--sea-tint)',
};

export function Dashboard({
  builds,
  onNavigate,
  onOpenBuild,
  onNewBuild,
  onBatch,
}: {
  builds: Build[];
  onNavigate: (screen: Screen) => void;
  onOpenBuild: (id: string) => void;
  onNewBuild: () => void;
  onBatch: (partIds: string[]) => void;
}) {
  const groups = batchGroups(builds);
  const recommended = recommendedGroup(groups);
  const curing = curingParts(builds);
  const totalParts = builds.reduce((n, b) => n + b.parts.length, 0);
  const totalDone = builds.reduce((n, b) => n + partsDone(b), 0);

  return (
    <div className={ui.page}>
      <LeftRail
        active="dashboard"
        onNavigate={onNavigate}
        bottom={
          <>
            <Illustration />
            <div className={ui.railCopy}>
              {builds.length} builds on the bench,
              <br />
              {partsWaitingOnYou(builds)} parts waiting on you
            </div>
            <button className={ui.btnFill} onClick={onNewBuild}>
              + New build
            </button>
          </>
        }
      />

      <div className={ui.col}>
        <div className={s.hero}>
          <div>
            <div className={s.greeting}>Buongiorno, Mara</div>
            <div className={s.heroSub}>
              {recommended
                ? `${recommended.parts.length} parts are ready for ${recommended.noun} — one setup clears ${word(recommended.buildCount)} ${recommended.buildCount === 1 ? 'build' : 'builds'}.`
                : 'Nothing is stacked up enough to batch yet.'}
            </div>
            <div className={s.heroFigure}>
              {totalDone}
              <span> / {totalParts} parts done</span>
            </div>
          </div>
          <div className={s.heroArt}>ILLUSTRATION</div>
        </div>

        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Builds</span>
          <span className={s.sectionNote}>{builds.length} active</span>
        </div>

        <div className={s.buildGrid}>
          {builds.map((b) => {
            const next = suggestedNextStep(b);
            return (
              <button key={b.id} className={s.buildCard} onClick={() => onOpenBuild(b.id)}>
                <div className={s.buildHead}>
                  <div
                    className={s.donut}
                    style={{
                      background: `conic-gradient(${progressColor(b)} ${progressPct(b)}%, var(--track) 0)`,
                    }}
                  >
                    <div className={s.donutHole}>
                      <span className={s.donutDone}>{partsDone(b)}</span>
                      <span className={s.donutTotal}>/{b.parts.length}</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className={s.buildName}>{b.name}</div>
                    <div className={s.buildMeta}>updated {timeAgo(buildUpdatedAt(b))}</div>
                  </div>
                </div>
                <div className={s.pills}>
                  {statusPills(b).map((p) => (
                    <StatusPill key={p.status} status={p.status} count={p.count} />
                  ))}
                </div>
                {next && (
                  <div className={s.nextStep} style={{ background: TONE_BG[next.tone] }}>
                    <div className={s.nextKicker}>NEXT STEP</div>
                    <div className={s.nextText}>{next.text}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={ui.col}>
        <div className={s.batchPanel}>
          <div className={s.batchTitle}>Ready to batch</div>
          <div className={s.tiles}>
            {groups.map((g) => {
              const active = g === recommended;
              return (
                <div
                  key={g.status}
                  className={`${s.tile} ${active ? s.tileActive : ''} ${g.actionable ? '' : s.tileBelow}`}
                >
                  <span className={s.tileIcon} />
                  <div>
                    <div className={s.tileCount}>{g.parts.length}</div>
                    <div className={s.tileLabel}>{g.label}</div>
                    {!g.actionable && (
                      <div className={s.tileNote}>
                        {g.parts.length} of {BATCH_THRESHOLD} — not worth setting up yet
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className={ui.btnFill}
            style={{ marginTop: 14 }}
            disabled={!recommended}
            onClick={() => recommended && onBatch(recommended.parts.map((p) => p.id))}
          >
            Enter workbench ▸
          </button>
        </div>

        {curing.length > 0 && (
          <div className={s.curing}>
            <div className={ui.cardTitle}>Curing — hands off</div>
            <div className={s.curingBody}>
              {curing.map((p) => p.name).join(' · ')}
              <br />
              free in{' '}
              <span className={s.curingTimer}>
                {timeLeft(curing.map((p) => p.curingUntil!).sort()[0])}
              </span>
            </div>
          </div>
        )}

        <div className={ui.card} style={{ flex: 'none' }}>
          <div className={ui.cardHead}>
            <span className={ui.cardTitle}>Materials &amp; tools</span>
            <button className={ui.link} onClick={() => onNavigate('toolbox')}>
              Open
            </button>
          </div>
          <ShelfList materials={SHELF} />
        </div>
      </div>
    </div>
  );
}
