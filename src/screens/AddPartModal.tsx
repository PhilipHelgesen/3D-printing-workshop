import { useEffect, useState } from 'react';
import s from './modal.module.css';

export function AddPartModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, note?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const submit = () => {
    if (!trimmed) return;
    onAdd(trimmed, note.trim() || undefined);
  };

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div>
            <div className={s.title}>Add part</div>
            <div className={s.sub}>new part</div>
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={s.rule} />

        <div className={s.kicker}>NAME</div>
        <input
          className={s.field}
          autoFocus
          placeholder="Name this part"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <div className={`${s.kicker} ${s.kickerSpaced}`}>
          NOTE / DESCRIPTION <span className={s.optional}>optional</span>
        </div>
        <textarea
          className={`${s.field} ${s.noteField}`}
          placeholder="e.g. needs a longer fillet on the tab"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className={s.foot}>
          <div className={s.actions}>
            <button className={s.cancel} onClick={onClose}>
              Cancel
            </button>
            <button className={s.save} disabled={!trimmed} onClick={submit}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
