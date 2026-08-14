import { useMemo, useState } from 'react';
import type { Screen, ToolboxEntry } from '../types.ts';
import { isImported } from '../icons.ts';
import { Illustration, LeftRail } from '../ui/Shell.tsx';
import ui from '../ui/ui.module.css';
import s from './toolbox.module.css';

type Filter = 'all' | 'favourites' | 'techniques';
type SectionKey = 'favourites' | 'tools' | 'techniques';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'techniques', label: 'Techniques' },
];

/** Section tint for the icon chip — favourites lemon, tools sea, techniques basil. */
const SECTION_TINT: Record<SectionKey, string> = {
  favourites: 'var(--lemon-tint)',
  tools: 'var(--sea-tint)',
  techniques: 'var(--basil-tint)',
};

/** Favourites float out of their kind and pin to the top; the rest split tool vs technique. */
function split(entries: ToolboxEntry[]) {
  const favourites: ToolboxEntry[] = [];
  const tools: ToolboxEntry[] = [];
  const techniques: ToolboxEntry[] = [];
  for (const e of entries) {
    if (e.favorite) favourites.push(e);
    else if (e.kind === 'tool') tools.push(e);
    else techniques.push(e);
  }
  return { favourites, tools, techniques };
}

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

  const stats = useMemo(
    () => ({
      tools: entries.filter((e) => e.kind === 'tool').length,
      techniques: entries.filter((e) => e.kind === 'technique').length,
      favourites: entries.filter((e) => e.favorite).length,
    }),
    [entries],
  );

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q
      ? entries.filter(
          (e) => e.name.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q),
        )
      : entries;
    const { favourites, tools, techniques } = split(found);
    const all: { key: SectionKey; title: string; note: string; items: ToolboxEntry[] }[] = [
      { key: 'favourites', title: 'Favourites', note: 'pinned to the top', items: favourites },
      { key: 'tools', title: 'Tools', note: String(tools.length), items: tools },
      { key: 'techniques', title: 'Techniques', note: 'how you like to do it', items: techniques },
    ];
    return filter === 'all' ? all : all.filter((section) => section.key === filter);
  }, [entries, query, filter]);

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
              <span className={ui.statValue}>{stats.tools}</span>
            </div>
            <div className={ui.statRow}>
              <span>Techniques</span>
              <span className={ui.statValue}>{stats.techniques}</span>
            </div>
            <div className={ui.statRow}>
              <span>Favourites</span>
              <span className={ui.statValue} style={{ color: 'var(--lemon)' }}>
                {stats.favourites}
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
              aria-label="Search the toolbox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${s.filter} ${filter === f.id ? s.filterActive : ''}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {sections.map((section) => (
          <section key={section.key}>
            <div className={s.sectionHead}>
              <span className={s.sectionTitle}>{section.title}</span>
              <span className={s.sectionNote}>{section.note}</span>
            </div>
            {section.items.length === 0 ? (
              <div className={s.empty}>nothing here</div>
            ) : (
              <div className={s.grid}>
                {section.items.map((entry) => (
                  <div key={entry.id} className={s.card} onClick={() => onEdit(entry)}>
                    {/* The pen is the keyboard/AT path to the same edit the card click does. */}
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
                      aria-pressed={entry.favorite}
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
                    <span className={s.info}>
                      <span className={s.name}>{entry.name}</span>
                      {entry.note && <span className={s.note}>{entry.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
