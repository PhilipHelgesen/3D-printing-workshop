import { useState } from 'react';
import type { ToolboxEntry } from '../types.ts';
import { isImported } from '../icons.ts';
import { Illustration, LeftRail, ui, type Screen } from '../ui/Shell.tsx';
import s from './toolbox.module.css';

type Filter = 'all' | 'favourites' | 'techniques';

/** Section tint for the icon chip — favourites lemon, tools sea, techniques basil. */
const SECTION_TINT = {
  favourites: 'var(--lemon-tint)',
  tools: 'var(--sea-tint)',
  techniques: 'var(--basil-tint)',
};

export function Toolbox({
  entries,
  onNavigate,
  onToggleFavorite,
  onEdit,
  onCreate,
}: {
  entries: ToolboxEntry[];
  onNavigate: (screen: Screen) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (entry: ToolboxEntry) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const found = entries.filter(
    (e) => !q || e.name.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q),
  );

  const sections = (
    [
      {
        key: 'favourites',
        title: 'Favourites',
        note: 'pinned to the top',
        items: found.filter((e) => e.favorite),
      },
      {
        key: 'tools',
        title: 'Tools',
        note: String(found.filter((e) => e.kind === 'tool' && !e.favorite).length),
        items: found.filter((e) => e.kind === 'tool' && !e.favorite),
      },
      {
        key: 'techniques',
        title: 'Techniques',
        note: 'how you like to do it',
        items: found.filter((e) => e.kind === 'technique' && !e.favorite),
      },
    ] as { key: keyof typeof SECTION_TINT; title: string; note: string; items: ToolboxEntry[] }[]
  ).filter(
      (section) =>
        filter === 'all' ||
        (filter === 'favourites' && section.key === 'favourites') ||
        (filter === 'techniques' && section.key === 'techniques'),
    );

  return (
    <div className={`${ui.page} ${ui.pageWide}`}>
      <LeftRail
        active="toolbox"
        onNavigate={onNavigate}
        bottom={
          <>
            <Illustration />
            <div className={ui.railCopy}>
              Star the ones you reach for
              <br />
              and they stay on top.
            </div>
          </>
        }
      >
        <div className={ui.railBlock}>
          <div className={ui.kicker}>IN THE BOX</div>
          <div className={ui.statRows}>
            <div className={ui.statRow}>
              <span>Tools</span>
              <span className={ui.statValue}>{entries.filter((e) => e.kind === 'tool').length}</span>
            </div>
            <div className={ui.statRow}>
              <span>Techniques</span>
              <span className={ui.statValue}>
                {entries.filter((e) => e.kind === 'technique').length}
              </span>
            </div>
            <div className={ui.statRow}>
              <span>Favourites</span>
              <span className={ui.statValue} style={{ color: 'var(--lemon)' }}>
                {entries.filter((e) => e.favorite).length}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className={ui.btnOutline} onClick={onCreate}>
              + Add to toolbox
            </button>
          </div>
        </div>
      </LeftRail>

      <div className={`${ui.col} ${ui.colWide}`}>
        <div className={s.header}>
          <div>
            <div className={s.title}>Toolbox</div>
            <div className={s.sub}>What&apos;s on the bench — so you know before you start.</div>
          </div>
          <div className={s.controls}>
            <input
              className={s.search}
              placeholder="Search tools…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(['all', 'favourites', 'techniques'] as Filter[]).map((f) => (
              <button
                key={f}
                className={`${s.filter} ${filter === f ? s.filterActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'favourites' ? 'Favourites' : 'Techniques'}
              </button>
            ))}
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.key}>
            <div className={s.sectionHead}>
              <span className={s.sectionTitle}>{section.title}</span>
              <span className={s.sectionNote}>{section.note}</span>
            </div>
            {section.items.length === 0 ? (
              <div className={s.empty}>nothing here</div>
            ) : (
              <div className={s.grid}>
                {section.items.map((entry) => (
                  <div
                    key={entry.id}
                    className={s.card}
                    onClick={() => onEdit(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onEdit(entry)}
                  >
                    <button
                      className={s.pen}
                      aria-label={`Edit ${entry.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(entry);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className={`${s.star} ${entry.favorite ? s.starOn : ''}`}
                      aria-label={`${entry.favorite ? 'Unstar' : 'Star'} ${entry.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(entry.id);
                      }}
                    >
                      {entry.favorite ? '★' : '☆'}
                    </button>
                    <span
                      className={s.icon}
                      style={{
                        background: isImported(entry.iconId) ? undefined : SECTION_TINT[section.key],
                      }}
                    >
                      {isImported(entry.iconId) ? (
                        <img className={s.iconImg} src={entry.iconId} alt="" />
                      ) : (
                        'ICON'
                      )}
                    </span>
                    <span className={s.name}>{entry.name}</span>
                    {entry.note && <span className={s.note}>{entry.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
