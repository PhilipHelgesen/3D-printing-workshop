import { useEffect, useState, type ChangeEvent } from 'react';
import type { ToolboxEntry } from '../types.ts';
import { ICON_IDS, ICON_TINTS } from '../seed.ts';
import { isImported, uploadIcon } from '../icons.ts';
import s from './modal.module.css';

const KIND_COLOR = { tool: 'var(--sea)', technique: 'var(--basil)' };

/** One component, two modes: an existing entry is edited, a blank one is created. */
export function ToolboxModal({
  entry,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  entry: ToolboxEntry;
  isNew: boolean;
  onSave: (entry: ToolboxEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(entry);
  const [iconError, setIconError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickIcon = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be picked twice
    if (!file) return;
    setUploading(true);
    try {
      const iconId = await uploadIcon(file);
      setDraft((d) => ({ ...d, iconId }));
      setIconError(null);
    } catch (err) {
      setIconError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accent = KIND_COLOR[draft.kind];
  const name = draft.name.trim();

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div>
            <div className={s.title}>{isNew ? 'Add to toolbox' : `Edit ${entry.kind}`}</div>
            <div className={s.sub}>{isNew ? 'new entry' : entry.name}</div>
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={s.rule} />

        <div className={s.kicker}>KIND</div>
        <div className={s.kinds}>
          {(['tool', 'technique'] as const).map((kind) => (
            <button
              key={kind}
              className={`${s.kind} ${draft.kind === kind ? s.kindOn : ''}`}
              style={draft.kind === kind ? { background: KIND_COLOR[kind] } : undefined}
              onClick={() => setDraft({ ...draft, kind })}
            >
              {kind === 'tool' ? 'Tool' : 'Technique'}
            </button>
          ))}
        </div>

        <div className={s.kicker}>ICON</div>
        <div className={s.icons}>
          {ICON_IDS.map((id) => (
            <button
              key={id}
              className={s.swatch}
              style={{
                background: ICON_TINTS[id],
                borderColor: draft.iconId === id ? accent : 'transparent',
              }}
              aria-label={`Icon ${id}`}
              onClick={() => setDraft({ ...draft, iconId: id })}
            >
              ICON
            </button>
          ))}
          {isImported(draft.iconId) && (
            <span className={s.swatch} style={{ borderColor: accent }}>
              <img className={s.swatchImg} src={draft.iconId} alt="" />
            </span>
          )}
          {/* "add your own" — a photo of the maker's own tool, or an icon file */}
          <label className={`${s.swatch} ${s.swatchAdd}`} title="Import an icon or photo">
            {uploading ? '…' : '+'}
            <input
              type="file"
              accept="image/*"
              className={s.fileInput}
              aria-label="Import an icon or photo"
              disabled={uploading}
              onChange={pickIcon}
            />
          </label>
        </div>
        {uploading && <div className={s.iconStatus}>Uploading…</div>}
        {iconError && <div className={s.iconError}>{iconError}</div>}

        <div className={`${s.kicker} ${s.kickerSpaced}`}>NAME</div>
        <input
          className={s.field}
          autoFocus
          placeholder={draft.kind === 'tool' ? 'Name this tool' : 'Name this technique'}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />

        <div className={`${s.kicker} ${s.kickerSpaced}`}>
          NOTE <span className={s.optional}>optional</span>
        </div>
        <textarea
          className={`${s.field} ${s.noteField}`}
          placeholder="e.g. putty, then 220 grit"
          value={draft.note ?? ''}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />

        <div className={s.foot}>
          {!isNew && (
            <button className={s.delete} onClick={() => onDelete(entry.id)}>
              Delete
            </button>
          )}
          <div className={s.actions}>
            <button className={s.cancel} onClick={onClose}>
              Cancel
            </button>
            <button
              className={s.save}
              disabled={!name}
              onClick={() => onSave({ ...draft, name, note: draft.note?.trim() || undefined })}
            >
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
