import type { Part, PartStatus } from '../types.ts';
import { STATUS_TOKENS, nextStatus, otherSteps } from '../derive.ts';
import s from './build.module.css';

export interface PartActions {
  onMove: (id: string, status: PartStatus) => void;
  onRename: (part: Part) => void;
  onNote: (part: Part) => void;
  onDelete: (part: Part) => void;
  onLink: (id: string) => void;
}

/**
 * Where the menu hangs from. It isn't in the DOM until it opens, so its opener
 * measures the space at the click — while its own place on screen is known.
 * ponytail: the height holds while the menu's items are fixed; measure on open
 * if it ever grows a variable section.
 */
const MENU_WIDTH = 268;
const MENU_HEIGHT = 384;

export interface MenuPlace {
  left: boolean;
  up: boolean;
}

/** A row is wider than the menu and anchors right; a tile takes whichever corner fits. */
export const menuPlace = (el: Element, anchor: 'row' | 'tile'): MenuPlace => {
  const box = el.getBoundingClientRect();
  return {
    left: anchor === 'tile' && box.left + MENU_WIDTH <= window.innerWidth,
    up: box.bottom + MENU_HEIGHT > window.innerHeight,
  };
};

const stepLabel = (status: PartStatus) =>
  status === 'queued' ? 'Back to queue' : status.charAt(0).toUpperCase() + status.slice(1);

/** Every step a part can move to, then the things you can do to the part itself. */
export function AdvanceMenu({
  part,
  links,
  place,
  actions,
  onClose,
}: {
  part: Part;
  /** The rest of this part's assembly — the count on the link item. */
  links: Part[];
  place: MenuPlace;
  actions: PartActions;
  onClose: () => void;
}) {
  const pick = (run: () => void) => () => {
    run();
    onClose();
  };

  return (
    <div
      className={`${s.menu} ${place.up ? s.menuUp : ''} ${place.left ? s.menuLeft : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.menuKicker}>MOVE TO STEP</div>
      {otherSteps(part.status).map((status) => {
        const isNext = status === nextStatus(part.status);
        return (
          <button
            key={status}
            className={`${s.menuItem} ${isNext ? s.menuNext : ''}`}
            onClick={pick(() => actions.onMove(part.id, status))}
          >
            <span className={s.menuDot} style={{ background: STATUS_TOKENS[status].solid }} />
            {stepLabel(status)}
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
