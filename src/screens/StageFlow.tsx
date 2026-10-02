import type { Part, Step } from '../types.ts';
import { barHeight, countByStatus, isSegmented, stepTokens } from '../derive.ts';
import s from './build.module.css';

export function StageBar({ count, color, height }: { count: number; color: string; height: number }) {
  const pieces = isSegmented(count) ? count : 1;
  return (
    <span className={s.stageBar} style={{ height }}>
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} className={s.stagePiece} style={{ background: color }} />
      ))}
    </span>
  );
}

/** The same count/bar/name visualization in the build header and its editor. */
export function StageContents({ step, count, editing = false }: { step: Step; count: number; editing?: boolean }) {
  return (
    <>
      <span className={`${s.stageCount} ${count === 0 ? s.stageEmpty : ''}`}>{count}</span>
      <StageBar count={count}
        color={count === 0 && !editing ? 'var(--track)' : stepTokens(step.id, [step]).solid}
        height={barHeight(count)} />
      <span className={s.stageLabel}>{step.name}</span>
    </>
  );
}

export function StageFlow({ steps, parts, picked, onPick }: {
  steps: Step[];
  parts: Part[];
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className={s.flow}>
      {steps.map((step) => {
        const count = countByStatus(parts, step.id);
        const on = picked === step.id;
        return (
          <button key={step.id}
            className={[s.stage, step.id === 'done' ? s.stageWide : '', on ? s.stageOn : '', picked && !on ? s.stageDim : ''].join(' ')}
            aria-pressed={on} disabled={count === 0 && !on}
            onClick={() => onPick(on ? null : step.id)}>
            <StageContents step={step} count={count} />
          </button>
        );
      })}
    </div>
  );
}
