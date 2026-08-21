import { useEffect, useState } from 'react';
import type { Part, PartStatus } from '../types.ts';
import { STATUS_TOKENS, assemblyBadge, nextStatus, otherSteps, timeAgo } from '../derive.ts';
import { StatusPill } from '../ui/StatusPill.tsx';
import s from './build.module.css';

/**
 * How tall the Advance menu stands. Measured, not computed: the menu isn't in the
 * DOM until it opens, and the row that opens it has to decide which way it goes.
 * ponytail: a constant holds while the menu's items are fixed — measure on open if
 * it ever grows a variable section.
 */
const MENU_HEIGHT = 340;

const stepLabel = (status: PartStatus) =>
  status === 'queued' ? 'Back to queue' : status.charAt(0).toUpperCase() + status.slice(1);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export interface PartRowActions {
  onToggleSelect: (id: string) => void;
  onMove: (ids: string[], status: PartStatus) => void;
  onRename: (part: Part) => void;
  onNote: (part: Part) => void;
  onDelete: (part: Part) => void;
  onLink: (id: string) => void;
}

export function PartRow({
  part,
  links,
  isSelected,
  menuOpen,
  onOpenMenu,
  actions,
}: {
  part: Part;
  /** The rest of this part's assembly, if any. */
  links: Part[];
  isSelected: boolean;
  menuOpen: boolean;
  /** `null` closes; the parent keeps this so only one menu is ever open. */
  onOpenMenu: (id: string | null) => void;
  actions: PartRowActions;
}) {
  const isDone = part.status === 'done';
  const badge = assemblyBadge(part, links);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => onOpenMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, onOpenMenu]);

  const pick = (run: () => void) => () => {
    run();
    onOpenMenu(null);
  };

  return (
    <div className={`${s.row} ${isSelected ? s.rowSelected : ''} ${isDone ? s.rowDone : ''}`}>
      <button
        className={`${s.check} ${isSelected ? s.checkOn : ''} ${isDone ? s.checkDone : ''}`}
        disabled={isDone}
        aria-label={`Select ${part.name}`}
        aria-pressed={isSelected}
        onClick={() => actions.onToggleSelect(part.id)}
      >
        {isDone && <span />}
      </button>

      <div className={s.partInfo}>
        <span className={s.nameLine}>
          <span className={s.partName}>{part.name}</span>
          {badge && (
            <span
              className={`${s.linkBadge} ${badge.inStep ? '' : s.linkBadgeOff}`}
              title={badge.title}
            >
              <LinkIcon />
            </span>
          )}
        </span>
        {part.note && <span className={s.partNote}>{part.note}</span>}
      </div>

      <StatusPill status={part.status} />
      <span className={s.stamp}>{timeAgo(part.updatedAt)}</span>

      <button
        className={`${s.advance} ${menuOpen ? s.advanceOpen : ''}`}
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          // Decided at the click, while the button's place on screen is known.
          if (!menuOpen) {
            const { bottom } = e.currentTarget.getBoundingClientRect();
            setFlipped(bottom + MENU_HEIGHT > window.innerHeight);
          }
          onOpenMenu(menuOpen ? null : part.id);
        }}
      >
        Advance <span>▾</span>
      </button>

      {menuOpen && (
        <div
          className={`${s.menu} ${flipped ? s.menuUp : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={s.menuKicker}>MOVE TO STEP</div>
          {otherSteps(part.status).map((status) => {
            const isNext = status === nextStatus(part.status);
            return (
              <button
                key={status}
                className={`${s.menuItem} ${isNext ? s.menuNext : ''}`}
                onClick={pick(() => actions.onMove([part.id], status))}
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
      )}
    </div>
  );
}
