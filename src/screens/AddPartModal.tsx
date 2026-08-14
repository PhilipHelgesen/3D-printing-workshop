import { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import s from '../ui/modal.module.css';

export function AddPartModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, note?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const trimmed = name.trim();
  const submit = () => {
    if (trimmed) onAdd(trimmed, note.trim() || undefined);
  };

  return (
    <Modal
      title="Add part"
      subtitle="new part"
      onClose={onClose}
      footer={
        <div className={s.actions}>
          <button className={s.cancel} onClick={onClose}>
            Cancel
          </button>
          <button className={s.save} disabled={!trimmed} onClick={submit}>
            Add
          </button>
        </div>
      }
    >
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
    </Modal>
  );
}
