import type { Build, Screen } from '../types.ts';
import {
  batchGroups,
  buildUpdatedAt,
  partsDone,
  partsWaitingOnYou,
  progressColor,
  progressPct,
  recommendedGroup,
  statusPills,
  timeAgo,
} from '../derive.ts';
import { Illustration, LeftRail } from '../ui/Shell.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';
import ui from '../ui/ui.module.css';
import s from './dashboard.module.css';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = (n: number) => WORDS[n] ?? String(n);

export function Dashboard({
  builds,
  onNavigate,
  onOpenBuild,
  onNewBuild,
}: {
  builds: Build[];
  onNavigate: (screen: Screen) => void;
  onOpenBuild: (id: string) => void;
  onNewBuild: () => void;
}) {
  const groups = batchGroups(builds);
  const recommended = recommendedGroup(groups);
  const totalParts = builds.reduce((n, b) => n + b.parts.length, 0);
  const totalDone = builds.reduce((n, b) => n + partsDone(b), 0);

  return (
    <div className={`${ui.page} ${ui.pageWide}`}>
      <LeftRail
        active="dashboard"
        onNavigate={onNavigate}
        bottom={
          <>
            <Illustration />
            <div className={ui.railCopy}>
              {builds.length} builds on the bench,
              <br />
              {partsWaitingOnYou(groups)} parts waiting on you
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
            <div className={s.greeting}>Hello, Philip!</div>
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
          {builds.map((b) => (
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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
