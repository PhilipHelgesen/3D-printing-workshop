import type { CSSProperties } from 'react';
import type { Part, PartStatus, Step } from '../types.ts';
import { stepTokens, nextStatus, otherSteps, stepName } from '../derive.ts';
import s from './build.module.css';

export interface PartActions {
  onMove: (id: string, status: PartStatus) => void;
  onRename: (part: Part) => void;
  onNote: (part: Part) => void;
  onDelete: (part: Part) => void;
  onLink: (id: string) => void;
}

/** Fit variable-length workflows inside the viewport, with scrolling for long menus. */
export const menuPlace = (el: Element, stepCount: number): CSSProperties => {
  const box = el.getBoundingClientRect();
  const width = Math.min(268, window.innerWidth - 24);
  const height = Math.min(32 * (stepCount - 1) + 184, window.innerHeight - 24);
  return {
    width,
    left: Math.max(12, Math.min(box.width < width ? box.left : box.right - width, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(box.bottom + 4, window.innerHeight - height - 12)),
    maxHeight: window.innerHeight - 24,
    overflowY: 'auto',
  };
};

/** Every step a part can move to, then the things you can do to the part itself. */
export function AdvanceMenu({
  part,
  steps,
  links,
  place,
  actions,
  onClose,
}: {
  part: Part;
  steps: Step[];
  /** The rest of this part's assembly — the count on the link item. */
  links: Part[];
  /** Viewport position from `menuPlace`, measured when the opener was clicked. */
  place: CSSProperties;
  actions: PartActions;
  onClose: () => void;
}) {
  const pick = (run: () => void) => () => {
    run();
    onClose();
  };

  return (
    <div
      className={s.menu}
      style={place}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.menuKicker}>MOVE TO STEP</div>
      {otherSteps(part.status, steps).map((status) => {
        const isNext = status === nextStatus(part.status, steps);
        return (
          <button
            key={status}
            className={`${s.menuItem} ${isNext ? s.menuNext : ''}`}
            onClick={pick(() => actions.onMove(part.id, status))}
          >
            <span className={s.menuDot} style={{ background: stepTokens(status, steps).solid }} />
            {stepName(status, steps)}
            {isNext && <span className={s.menuTag}>next</span>}
          </button>
        );
      })}

      <div className={s.menuRule} />
      <button className={s.menuItem} onClick={pick(() => actions.onRename(part))}>
        Rename part
      </button>
      <button className={s.menuItem} onClick={pick(() => actions.onNote(part))}>
        Notes &amp; details
      </button>
      <button className={s.menuItem} onClick={pick(() => actions.onLink(part.id))}>
        {links.length ? `Edit link (${links.length + 1})` : 'Link part'}
      </button>
      <button
        className={`${s.menuItem} ${s.menuDanger}`}
        onClick={pick(() => actions.onDelete(part))}
      >
        Delete part
      </button>
    </div>
  );
}

/** Shared by both views: a part in an assembly wears one wherever it's shown. */
export const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);
