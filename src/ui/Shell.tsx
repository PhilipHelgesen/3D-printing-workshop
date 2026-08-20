import type { ReactNode } from 'react';
import type { Screen } from '../types.ts';
import { supabase } from '../supabase.ts';
import s from './ui.module.css';

const NAV: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'toolbox', label: 'Toolbox' },
];

/** 24×24, stroke=currentColor so it inherits the nav row's active/inactive color. */
const NAV_ICON: Record<Screen, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </svg>
  ),
  toolbox: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 9V6.5a4 4 0 0 1 8 0V9" />
      <rect x="3" y="9" width="18" height="10.5" rx="2" />
      <path d="M3 14h18" />
    </svg>
  ),
};

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
    <nav className={s.rail}>
      <div className={s.brand}>
        <span className={s.brandMark}>
          <span />
        </span>
        <span className={s.brandName}>
          Philip´s
          <span className={s.brandSub}>workshop</span>
        </span>
      </div>
      {NAV.map((item) => (
        <button
          key={item.id}
          className={`${s.navItem} ${active === item.id ? s.navActive : ''}`}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span className={s.navIcon}>{NAV_ICON[item.id]}</span>
          {item.label}
        </button>
      ))}
      {children}
      <div className={s.railBottom}>
        {bottom}
        {/* Lives here rather than being threaded through all three screens as a
            prop — every screen renders the rail, none of them care about auth. */}
        <button className={s.signOut} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export function Illustration({ label = 'ILLUSTRATION' }: { label?: string }) {
  return <div className={s.illustration}>{label}</div>;
}
