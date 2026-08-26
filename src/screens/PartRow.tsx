import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Part } from '../types.ts';
import { STATUS_TOKENS, assemblyBadge, timeAgo } from '../derive.ts';
import { AdvanceMenu, LinkIcon, menuPlace, type PartActions } from './AdvanceMenu.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';
import s from './build.module.css';

/**
 * The two halves of a row, as drop targets. Which half the pointer is in decides
 * whether the drop lands above or below — as rectangles rather than pointer
 * arithmetic, so dnd-kit's own collision detection answers the question.
 */
function DropHalves({ id }: { id: string }) {
  const above = useDroppable({ id: `row:${id}:before` });
  const below = useDroppable({ id: `row:${id}:after` });
  return (
    <>
      <span ref={above.setNodeRef} className={`${s.half} ${s.halfTop}`} aria-hidden />
      <span ref={below.setNodeRef} className={`${s.half} ${s.halfBottom}`} aria-hidden />
    </>
  );
}

/** A part as a line of detail: its note, its step, when it last moved. */
export function PartRow({
  part,
  links,
  menuOpen,
  onOpenMenu,
  actions,
  overlay = false,
}: {
  part: Part;
  /** The rest of this part's assembly, if any. */
  links: Part[];
  menuOpen: boolean;
  /** `null` closes; the parent keeps this so only one menu is ever open. */
  onOpenMenu: (id: string | null) => void;
  actions: PartActions;
  /**
   * The copy in the maker's hand: no drag wiring of its own, and without the
   * furniture that can't be used mid-flight — the stamp and the Advance button.
   */
  overlay?: boolean;
}) {
  const isDone = part.status === 'done';
  const badge = assemblyBadge(part, links);
  const [place, setPlace] = useState('');
  const drag = useDraggable({ id: part.id, data: { kind: 'part' }, disabled: overlay });

  return (
    <div
      ref={overlay ? undefined : drag.setNodeRef}
      data-part={overlay ? undefined : part.id}
      className={s.row}
      style={{ borderLeftColor: STATUS_TOKENS[part.status].solid }}
      {...(overlay ? {} : drag.listeners)}
      {...(overlay ? {} : drag.attributes)}
    >
      {!overlay && <DropHalves id={part.id} />}
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
      {!overlay && (
        <>
          <span className={s.stamp}>{timeAgo(part.updatedAt)}</span>
          <button
            className={`${s.advance} ${menuOpen ? s.advanceOpen : ''}`}
            aria-expanded={menuOpen}
            onClick={(e) => {
              // The menu hangs off the row, not off this button, so the row is what's measured.
              if (!menuOpen) setPlace(menuPlace(e.currentTarget.parentElement!));
              e.stopPropagation();
              onOpenMenu(menuOpen ? null : part.id);
            }}
          >
            Advance <span>▾</span>
          </button>
        </>
      )}

      {menuOpen && !overlay && (
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
