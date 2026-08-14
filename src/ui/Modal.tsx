import { useEffect, type ReactNode } from 'react';
import s from './modal.module.css';

/** Backdrop, dialog chrome, Esc and click-outside — the parts every modal repeats. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.head}>
          <div>
            <div className={s.title}>{title}</div>
            {subtitle && <div className={s.sub}>{subtitle}</div>}
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={s.rule} />

        {children}

        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>
  );
}
