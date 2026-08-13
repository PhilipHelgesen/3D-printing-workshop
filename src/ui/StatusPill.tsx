import type { PartStatus } from '../types.ts';
import { STATUS_LABEL, STATUS_TOKENS } from '../derive.ts';
import s from './pill.module.css';

/** With a count it's a build-card summary pill; without, a part row's status. */
export function StatusPill({ status, count }: { status: PartStatus; count?: number }) {
  const token = STATUS_TOKENS[status];
  return (
    <span
      className={count === undefined ? s.pillBare : s.pill}
      style={{ background: token.tint }}
    >
      <span className={s.dot} style={{ background: token.solid }} />
      {count !== undefined && <span className={s.count}>{count}</span>}
      <span className={count === undefined ? s.labelBare : s.label}>{STATUS_LABEL[status]}</span>
    </span>
  );
}
