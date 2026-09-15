'use client';

import { useEffect, useRef } from 'react';

const CONFETTI_COLORS = ['#EF9F27', '#5DCAA5', '#7F77DD', '#D4537E', '#185FA5', '#0F6E56'];
const celebratedKeys = new Set();

export function burstConfetti(hostEl, originEl, { count = 20, colors = CONFETTI_COLORS } = {}) {
  if (!hostEl || !originEl) return;
  const target = originEl.getBoundingClientRect();
  const host = hostEl.getBoundingClientRect();
  const cx = target.left - host.left + target.width / 2;
  const cy = target.top - host.top + target.height / 2;
  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement('span');
    const isBig = i % 5 === 0;
    dot.className = isBig ? 'spark spark-cracker' : 'spark';
    dot.style.background = colors[i % colors.length];
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    const ang = (Math.PI * 2) * (i / count) + (Math.random() - 0.5) * 0.4;
    const dist = 48 + Math.random() * 56;
    dot.style.setProperty('--tx', `${Math.cos(ang) * dist}px`);
    dot.style.setProperty('--ty', `${Math.sin(ang) * dist - 12}px`);
    hostEl.appendChild(dot);
    setTimeout(() => dot.remove(), 1100);
  }
}

export function useCelebrateOnce(key, enabled) {
  const hostRef = useRef(null);
  const originRef = useRef(null);

  useEffect(() => {
    if (!enabled || !key || !hostRef.current) return;
    const storageKey = `celebrate:${key}`;
    if (celebratedKeys.has(storageKey)) return;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(storageKey)) {
        celebratedKeys.add(storageKey);
        return;
      }
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // sessionStorage can be blocked; in-memory set still prevents repeats this session
    }
    celebratedKeys.add(storageKey);
    burstConfetti(hostRef.current, originRef.current || hostRef.current, { count: 22 });
  }, [enabled, key]);

  return { hostRef, originRef };
}

/** Short tenures (e.g. 12 months) fill the tree quickly; missed payments shrink it. */
export function visualGrowRatio(ratio, deducted) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
  const wilted = deducted ? clamped * 0.58 : clamped;
  return Math.pow(wilted, 0.55);
}

export function WaterBubbles({ count = 5, tone = 'mint' }) {
  const n = Math.max(3, Math.min(8, count));
  return (
    <span className={`water-bubbles water-bubbles-${tone}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="water-bubble"
          style={{
            left: `${10 + i * (80 / n)}%`,
            width: `${5 + (i % 3) * 3}px`,
            height: `${5 + (i % 3) * 3}px`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${3.6 + (i % 4) * 0.55}s`,
          }}
        />
      ))}
    </span>
  );
}

export function TreeGlyph({ ratio = 0, wilted = false, complete = false }) {
  const grow = complete ? 1 : visualGrowRatio(ratio, wilted);
  const mood = complete ? 'complete' : wilted ? 'wilted' : 'growing';
  return (
    <span className={`growth-tree growth-tree-${mood}`} style={{ '--grow': grow }} aria-hidden="true">
      <span className="growth-tree-soil" />
      <span className="growth-tree-wrap">
        <span className="growth-tree-canopy" />
        <span className="growth-tree-trunk" />
      </span>
      {complete ? <span className="growth-clap">👏</span> : null}
    </span>
  );
}

export function GrowthAvatar({
  kind,
  ratio = 0,
  typeShort,
  toneClass,
  celebrate = false,
}) {
  const showTree = kind === 'tree' || kind === 'wilted' || kind === 'complete';
  const showBubbles = kind === 'bubbles' || kind === 'achieved';
  return (
    <div className="growth-avatar">
      {showBubbles ? <WaterBubbles count={kind === 'achieved' ? 4 : 5} tone={kind === 'achieved' ? 'mint' : 'sky'} /> : null}
      {showTree ? (
        <TreeGlyph ratio={ratio} wilted={kind === 'wilted'} complete={kind === 'complete' || celebrate} />
      ) : (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 relative z-[1] ${toneClass}`}>
          {typeShort}
        </div>
      )}
      {showTree ? (
        <span className="growth-type-chip">{typeShort}</span>
      ) : null}
    </div>
  );
}
