import { useEffect, useState } from 'react';
import type { Part } from '../types.ts';
import { STATUS_LABEL, STATUS_TOKENS } from '../derive.ts';
import s from './modal.module.css';

export function LinkPartModal({
  part,
  members,
  candidates,
  onAdd,
  onRemoveMember,
  onClose,
}: {
  part: Part;
  /** Other parts already in this assembly. */
  members: Part[];
  /** Other parts in the build not yet in this assembly. */
  candidates: Part[];
  onAdd: (ids: string[]) => void;
  onRemoveMember: (id: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <div>
            <div className={s.title}>Link part</div>
            <div className={s.sub}>{part.name}</div>
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={s.rule} />

        {members.length > 0 && (
          <>
            <div className={s.kicker}>IN THIS ASSEMBLY</div>
            <div className={s.linkList}>
              {members.map((m) => (
                <div key={m.id} className={s.linkedRow}>
                  <span className={s.linkedDot} style={{ background: STATUS_TOKENS[m.status].solid }} />
                  <span className={s.linkedName}>{m.name}</span>
                  <button className={s.unlink} onClick={() => onRemoveMember(m.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={`${s.kicker} ${members.length ? s.kickerSpaced : ''}`}>
          {members.length ? 'ADD TO ASSEMBLY' : 'PICK PARTS TO LINK'}
        </div>

        <div className={s.linkList}>
          {candidates.length === 0 && <div className={s.linkEmpty}>No other parts in this build.</div>}
          {candidates.map((c) => {
            const isSelected = selected.includes(c.id);
            return (
              <button
                key={c.id}
                className={`${s.linkOption} ${isSelected ? s.linkOptionOn : ''}`}
                onClick={() => toggle(c.id)}
              >
                <span className={`${s.linkCheck} ${isSelected ? s.linkCheckOn : ''}`} />
                <span className={s.linkOptionName}>{c.name}</span>
                <span className={s.linkOptionStatus}>{STATUS_LABEL[c.status]}</span>
              </button>
            );
          })}
        </div>

        <div className={s.foot}>
          <div className={s.actions}>
            <button className={s.cancel} onClick={onClose}>
              Close
            </button>
            <button
              className={s.save}
              disabled={selected.length === 0}
              onClick={() => {
                onAdd(selected);
                setSelected([]);
              }}
            >
              {members.length ? `Add ${selected.length || ''}`.trim() : `Link ${selected.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
