import type { PartStatus, Step } from '../types.ts';
import { stepName, stepTokens } from '../derive.ts';
import s from './pill.module.css';

/** With a count it's a build-card summary pill; without, a part row's status. */
export function StatusPill({ status, steps, count }: { status: PartStatus; steps: Step[]; count?: number }) {
  const token = stepTokens(status, steps);
  return (
    <span
      className={count === undefined ? s.pillBare : s.pill}
      style={{ background: token.tint }}
    >
      <span className={s.dot} style={{ background: token.solid }} />
      {count !== undefined && <span className={s.count}>{count}</span>}
      <span className={count === undefined ? s.labelBare : s.label}>{stepName(status, steps).toUpperCase()}</span>
    </span>
  );
}
