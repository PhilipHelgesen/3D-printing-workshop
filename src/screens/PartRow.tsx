import { useState } from 'react';
import type { Part } from '../types.ts';
import { assemblyBadge, timeAgo } from '../derive.ts';
import { AdvanceMenu, LinkIcon, menuPlace, type MenuPlace, type PartActions } from './AdvanceMenu.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';
import s from './build.module.css';

/** A part as a line of detail: its note, its step, when it last moved. */
export function PartRow({
  part,
  links,
  menuOpen,
  onOpenMenu,
  actions,
}: {
  part: Part;
  /** The rest of this part's assembly, if any. */
  links: Part[];
  menuOpen: boolean;
  /** `null` closes; the parent keeps this so only one menu is ever open. */
  onOpenMenu: (id: string | null) => void;
  actions: PartActions;
}) {
  const isDone = part.status === 'done';
  const badge = assemblyBadge(part, links);
  const [place, setPlace] = useState<MenuPlace>({ left: false, up: false });

  return (
    <div className={`${s.row} ${isDone ? s.rowDone : ''}`}>
      {/* A marker, not a control: the row's step is changed from the Advance menu. */}
      <span className={`${s.check} ${isDone ? s.checkDone : ''}`}>{isDone && <span />}</span>

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
          // The menu hangs off the row, not off this button, so the row is what's measured.
          if (!menuOpen) setPlace(menuPlace(e.currentTarget.parentElement!, 'row'));
          e.stopPropagation();
          onOpenMenu(menuOpen ? null : part.id);
        }}
      >
        Advance <span>▾</span>
      </button>

      {menuOpen && (
        <AdvanceMenu
          part={part}
          links={links}
          place={place}
          actions={actions}
          onClose={() => onOpenMenu(null)}
        />
      )}
    </div>
  );
}
