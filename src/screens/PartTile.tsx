import { useState, type CSSProperties } from 'react';
import type { Part, Step } from '../types.ts';
import { stepName, stepTokens, assemblyBadge } from '../derive.ts';
import { AdvanceMenu, LinkIcon, menuPlace, type PartActions } from './AdvanceMenu.tsx';
import s from './build.module.css';

/**
 * A part as one square of colour. Tiles answer "how does the whole build look",
 * which the list can't: 27 of them fit on a screen and the wall of colour reads
 * as the shape of the work left.
 *
 * A tile is too narrow for a bracket, so an assembly reads as badges here and
 * as a group in the list — see ADR-0006.
 */
export function PartTile({
  part,
  steps,
  links,
  menuOpen,
  onOpenMenu,
  actions,
}: {
  part: Part;
  steps: Step[];
  links: Part[];
  menuOpen: boolean;
  onOpenMenu: (id: string | null) => void;
  actions: PartActions;
}) {
  const token = stepTokens(part.status, steps);
  const badge = assemblyBadge(part, links, steps);
  const [place, setPlace] = useState<CSSProperties>({});

  return (
    <div className={s.tileWrap}>
      <button
        className={`${s.tile} ${menuOpen ? s.tileOpen : ''}`}
        style={{ background: token.tint }}
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (!menuOpen) setPlace(menuPlace(e.currentTarget, steps.length));
          onOpenMenu(menuOpen ? null : part.id);
        }}
      >
        <span className={s.tileHead}>
          <span className={s.tileDot} style={{ background: token.solid }} />
          <span className={s.tileStatus}>{stepName(part.status, steps).toUpperCase()}</span>
          {badge && (
            <span
              className={`${s.linkBadge} ${s.tileBadge} ${badge.inStep ? '' : s.linkBadgeOff}`}
              title={badge.title}
            >
              <LinkIcon />
            </span>
          )}
        </span>
        <span className={s.tileName}>{part.name}</span>
      </button>

      {menuOpen && (
        <AdvanceMenu
          part={part}
          steps={steps}
          links={links}
          place={place}
          actions={actions}
          onClose={() => onOpenMenu(null)}
        />
      )}
    </div>
  );
}
