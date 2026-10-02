import { useEffect, useRef, type ReactNode } from 'react';
import s from './modal.module.css';

/** Backdrop, dialog chrome, Esc and click-outside — the parts every modal repeats. */
export function Modal({
  title,
  wide = false,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  wide?: boolean;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => opener.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
        .filter((control) => control.offsetParent !== null);
      const first = controls[0];
      const last = controls.at(-1);
      if (!dialog.current?.contains(document.activeElement)) {
        e.preventDefault();
        first?.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div
        ref={dialog}
        className={`${s.dialog} ${wide ? s.wide : ''}`}
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
