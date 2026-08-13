import type { ReactNode } from 'react';
import type { Material } from '../types.ts';
import s from './ui.module.css';

export type Screen = 'dashboard' | 'toolbox' | 'materials';

const NAV: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'toolbox', label: 'Toolbox' },
  { id: 'materials', label: 'Materials' },
];

export function LeftRail({
  active,
  onNavigate,
  children,
  bottom,
}: {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  children?: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div className={s.rail}>
      <div className={s.brand}>
        <span className={s.brandMark}>
          <span />
        </span>
        <span className={s.brandName}>
          Nozzle
          <span className={s.brandSub}>workshop</span>
        </span>
      </div>
      {NAV.map((item) => (
        <button
          key={item.id}
          className={`${s.navItem} ${active === item.id ? s.navActive : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span />
          {item.label}
        </button>
      ))}
      {children}
      {bottom && <div className={s.railBottom}>{bottom}</div>}
    </div>
  );
}

export function Illustration({ label = 'ILLUSTRATION' }: { label?: string }) {
  return <div className={s.illustration}>{label}</div>;
}

export function ShelfList({ materials }: { materials: Material[] }) {
  return (
    <div className={s.shelf}>
      {materials.map((m) => (
        <div key={m.name} className={s.shelfRow}>
          <span className={s.shelfName}>{m.name}</span>
          <span
            className={`${s.shelfStock} ${m.stock === 'running low' ? s.shelfLow : ''} ${
              m.stock === 'none' ? s.shelfNone : ''
            }`}
          >
            {m.stock === 'none' ? '—' : m.stock}
          </span>
        </div>
      ))}
    </div>
  );
}

export { s as ui };
