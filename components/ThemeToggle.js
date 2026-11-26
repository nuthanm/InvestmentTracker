'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

function readTheme() {
  try {
    const t = window.localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Saves and applies a theme; every mounted toggle hears the change. */
export function applyTheme(value) {
  try { window.localStorage.setItem('theme', value); } catch {}
  document.documentElement.setAttribute('data-theme', value);
  window.dispatchEvent(new CustomEvent('app:theme', { detail: value }));
}

/** Current theme choice (light, dark or system), kept in sync across toggles. */
export function useTheme() {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    setTheme(readTheme());
    const onChange = (e) => setTheme(e.detail || readTheme());
    window.addEventListener('app:theme', onChange);
    return () => window.removeEventListener('app:theme', onChange);
  }, []);
  return [theme, applyTheme];
}

/** Three-way segmented control: Light · Dark · System. */
export function ThemeSegmented({ className = '' }) {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={`theme-seg ${className}`}>
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          onClick={() => setTheme(opt.value)}
          className={`theme-seg-btn${theme === opt.value ? ' is-on' : ''}`}
        >
          <Icon name={opt.icon} size={15} />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Header icon button that opens a small Light / Dark / System menu. */
export default function ThemeToggle({ className = 'shell-icon-btn' }) {
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = THEME_OPTIONS.find((o) => o.value === theme) || THEME_OPTIONS[2];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={className}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
      >
        <Icon name={current.icon} />
      </button>
      {open && (
        <div role="menu" className="theme-menu">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === opt.value}
              onClick={() => { setTheme(opt.value); setOpen(false); }}
              className={`theme-menu-item${theme === opt.value ? ' is-on' : ''}`}
            >
              <Icon name={opt.icon} size={16} />
              <span className="flex-1">{opt.label}</span>
              {theme === opt.value && <Icon name="check" size={15} strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
