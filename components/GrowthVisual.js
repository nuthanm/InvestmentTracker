'use client';

import { useEffect, useId, useRef } from 'react';

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

const GOLD_TYPE_CODES = new Set(['GOLD', 'GD', 'SGB']);
const SILVER_TYPE_CODES = new Set(['SILV', 'SILVER', 'SLV']);
const RD_TYPE_CODES = new Set(['RD', 'RECURRINGDEPOSIT']);

/** Gold (physical or SGB), silver, and recurring deposit — including label variants. */
export function investmentThumbKind(typeCode, customType = '') {
  const code = String(typeCode || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  const extra = String(customType || '').trim().toLowerCase();
  if (SILVER_TYPE_CODES.has(code)) return 'silver';
  if (GOLD_TYPE_CODES.has(code)) return 'gold';
  if (RD_TYPE_CODES.has(code)) return 'rd';
  if (/\bsilver\b/.test(extra)) return 'silver';
  if (/\bgold\b/.test(extra) || /sovereign gold/.test(extra)) return 'gold';
  if (/\brd\b/.test(extra) || /recurring deposit/.test(extra)) return 'rd';
  return null;
}

function buildWavePath({ width = 1440, half = 90, base = 24, amp = 12, troughFirst = false, close = true } = {}) {
  let d = `M0 ${base}`;
  let crest = !troughFirst;
  for (let x = 0; x < width; x += half) {
    const end = x + half;
    d += ` Q ${x + half / 2} ${crest ? base - amp : base + amp} ${end} ${base}`;
    crest = !crest;
  }
  return close ? `${d} V 48 H 0 Z` : d;
}

const WAVE_BACK = buildWavePath({ amp: 8, base: 28 });
const WAVE_FRONT = buildWavePath({ amp: 13, base: 26, troughFirst: true });
const WAVE_CREST = buildWavePath({ amp: 13, base: 26, troughFirst: true, close: false });

/**
 * Water depth tracks the goal percentage already shown on the tile.
 * 0% keeps a thin surface line; 100% fills the tile.
 */
export function GoalWaterFill({ pct = 0 }) {
  const fill = Math.max(0, Math.min(100, Number(pct) || 0));
  const full = fill >= 100;
  const height = full ? '100%' : `max(16px, ${fill}%)`;
  const surface = !full && fill < 8;
  return (
    <div className="goal-water-clip" data-water={fill} aria-hidden="true">
      <div
        className={`goal-water-body${surface ? ' is-surface' : ''}${full ? ' is-full' : ''}`}
        style={{ height }}
      >
        <div className="goal-water-fill">
          <span className="goal-water-caustic" />
          <span className="goal-water-shimmer" />
          <span className="goal-water-bubble" style={{ left: '16%', width: 6, height: 6, animationDelay: '0.2s' }} />
          <span className="goal-water-bubble" style={{ left: '46%', width: 4, height: 4, animationDelay: '1.4s', animationDuration: '5.4s' }} />
          <span className="goal-water-bubble" style={{ left: '74%', width: 5, height: 5, animationDelay: '0.8s', animationDuration: '4.6s' }} />
        </div>
        <svg className="goal-water-wave goal-water-wave-back" viewBox="0 0 1440 48" preserveAspectRatio="none">
          <path d={WAVE_BACK} fill="rgba(255,255,255,0.45)" />
        </svg>
        <svg className="goal-water-wave" viewBox="0 0 1440 48" preserveAspectRatio="none">
          <path d={WAVE_FRONT} fill="rgba(186, 230, 248, 0.94)" />
          <path d={WAVE_CREST} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2.5" />
        </svg>
      </div>
    </div>
  );
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

export function CoinGlyph({ metal = 'gold' }) {
  const uid = useId().replace(/:/g, '');
  const gold = metal === 'gold';
  const faceId = `coin-face-${uid}`;
  const rimId = `coin-rim-${uid}`;
  return (
    <span className={`metal-coin metal-coin-${gold ? 'gold' : 'silver'}`} aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <defs>
          <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gold ? '#FFF3C4' : '#F7FBFF'} />
            <stop offset="48%" stopColor={gold ? '#E0B03A' : '#C5CED6'} />
            <stop offset="100%" stopColor={gold ? '#8C6414' : '#66727E'} />
          </linearGradient>
          <radialGradient id={faceId} cx="34%" cy="30%" r="72%">
            <stop offset="0%" stopColor={gold ? '#FFF8DC' : '#FFFFFF'} />
            <stop offset="46%" stopColor={gold ? '#F0C453' : '#E2E8EE'} />
            <stop offset="100%" stopColor={gold ? '#C49216' : '#9AA6B2'} />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="16.2" fill={`url(#${rimId})`} />
        <circle cx="18" cy="18" r="15.15" fill="none" stroke={gold ? '#F8E7A8' : '#EEF3F7'} strokeWidth="0.6" strokeDasharray="0.9 1.35" />
        <circle cx="18" cy="18" r="13.15" fill={`url(#${faceId})`} />
        <circle cx="18" cy="18" r="11.15" fill="none" stroke={gold ? 'rgba(120,78,12,0.45)' : 'rgba(70,84,96,0.4)'} strokeWidth="0.55" />
        <ellipse cx="12.2" cy="11.2" rx="4.6" ry="2.5" fill="rgba(255,255,255,0.55)" />
        <text
          x="18"
          y="22.2"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
          fill={gold ? '#6A4510' : '#3C4A56'}
        >
          {gold ? 'Au' : 'Ag'}
        </text>
      </svg>
      <span className="metal-coin-shine" />
    </span>
  );
}

function Foliage({ x, y, rot = -20, scale = 1, className = 'rd-leaf rd-leaf-a' }) {
  return (
    <path
      className={className}
      d="M0 0.7C1.7-1.35 4.2-0.85 5.05 1.15C3.25 2.35 1.2 2.05 0 1.05C-0.28 0.9-0.1 0.75 0 0.7Z"
      transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}
    />
  );
}

/** Trunk, branches, and leaves. A progress ratio stages the canopy; otherwise the tree grows in a loop. */
export function RealTreeGlyph({ wilted = false, ratio = null, complete = false }) {
  const loop = ratio == null && !complete && !wilted;
  const grow = complete ? 1 : visualGrowRatio(ratio ?? 0, wilted);
  const seedOpacity = grow < 0.08 ? 1 : Math.max(0, 1 - (grow - 0.08) * 6);
  const sproutOpacity = grow < 0.1 ? 0 : grow < 0.3 ? 1 : Math.max(0, 1 - (grow - 0.3) * 5);
  const treeOpacity = grow < 0.28 ? 0 : Math.min(1, (grow - 0.28) * 4);
  const treeScale = Math.max(0.42, Math.min(1, 0.42 + ((grow - 0.34) / 0.66) * 0.58));
  return (
    <span className={`rd-tree${wilted ? ' rd-tree-wilted' : ''}${loop ? ' rd-tree-loop' : ' rd-tree-staged'}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" className="rd-tree-svg">
        <ellipse className="rd-soil" cx="18" cy="33.1" rx="11" ry="1.7" />
        <g className="rd-stage rd-stage-seed" style={loop ? undefined : { opacity: seedOpacity }}>
          <ellipse className="rd-seed" cx="18" cy="31.5" rx="2.15" ry="1.45" />
          <ellipse className="rd-seed-shine" cx="17.3" cy="31" rx="0.7" ry="0.38" />
        </g>
        <g className="rd-stage rd-stage-sprout" style={loop ? undefined : { opacity: sproutOpacity }}>
          <path className="rd-sprout-stem" d="M18 32.4 C18.1 29 17.7 26.2 18 23.2" />
          <Foliage x="11.2" y="23.2" rot={-36} scale="0.85" className="rd-sprout-leaf" />
          <Foliage x="18.6" y="22.4" rot={28} scale="0.82" className="rd-sprout-leaf rd-sprout-leaf-b" />
        </g>
        <g
          className="rd-stage rd-stage-tree"
          style={loop ? undefined : { opacity: treeOpacity, transform: `scale(${treeOpacity ? treeScale : 0.42})` }}
        >
          <path className="rd-trunk" d="M16.15 33.2 C15.7 28.2 15.35 24 16.7 18.4 C17.35 22.2 17.5 27.4 18 33.2 Z" />
          <path className="rd-trunk-light" d="M18 33.2 C18.35 27.2 18.7 23 19.35 18.8 C20.5 23.4 20.55 28 19.55 33.2 Z" />
          <path className="rd-branch" d="M17.2 24.4 C13.6 22.8 10.4 19.4 8.3 15.6" />
          <path className="rd-branch" d="M18.7 22.2 C22.6 20.2 26.2 16.8 28.3 13.2" />
          <path className="rd-branch" d="M17.5 20.2 C15 16.2 14.5 12 16.5 8.2" />
          <path className="rd-branch rd-branch-thin" d="M18.5 19.2 C21.6 15.4 23 11.6 21.4 8" />
          <path className="rd-branch rd-branch-thin" d="M17.3 22.8 C13.6 20.6 11 17 10.2 13.6" />
          <g className="rd-leaves">
            <Foliage x="5.2" y="13.2" rot={-32} scale="0.95" className="rd-leaf rd-leaf-a" />
            <Foliage x="8.8" y="10.2" rot={12} scale="0.82" className="rd-leaf rd-leaf-b" />
            <Foliage x="12.4" y="6.6" rot={-18} scale="0.92" className="rd-leaf rd-leaf-c" />
            <Foliage x="16.2" y="4.6" rot={8} scale="0.88" className="rd-leaf rd-leaf-a" />
            <Foliage x="19.6" y="7.4" rot={24} scale="0.84" className="rd-leaf rd-leaf-b" />
            <Foliage x="24.2" y="10.6" rot={-14} scale="0.9" className="rd-leaf rd-leaf-c" />
            <Foliage x="21.2" y="13.4" rot={20} scale="0.72" className="rd-leaf rd-leaf-b" />
            <Foliage x="9.4" y="14.6" rot={-24} scale="0.74" className="rd-leaf rd-leaf-a" />
            <Foliage x="15.2" y="9.6" rot={16} scale="0.7" className="rd-leaf rd-leaf-c" />
          </g>
        </g>
      </svg>
    </span>
  );
}

export function TypeThumbnail({
  typeCode,
  customType,
  wilted = false,
  ratio = null,
  complete = false,
}) {
  const thumb = investmentThumbKind(typeCode, customType);
  if (thumb === 'gold' || thumb === 'silver') {
    return (
      <span className="type-thumb">
        <CoinGlyph metal={thumb} />
      </span>
    );
  }
  if (thumb === 'rd') {
    return (
      <span className="type-thumb">
        <RealTreeGlyph wilted={wilted} ratio={ratio} complete={complete} />
      </span>
    );
  }
  return null;
}

export function GrowthAvatar({
  kind,
  ratio = null,
  typeShort,
  typeCode,
  customType,
  toneClass,
  celebrate = false,
}) {
  const thumb = investmentThumbKind(typeCode, customType);
  const showTree = kind === 'tree' || kind === 'wilted' || kind === 'complete';
  const showBubbles = kind === 'bubbles' || kind === 'achieved';
  const treeRatio = Number(ratio) || 0;
  if (thumb === 'gold' || thumb === 'silver' || thumb === 'rd') {
    return (
      <div className="growth-avatar">
        <TypeThumbnail
          typeCode={typeCode}
          customType={customType}
          wilted={kind === 'wilted'}
          ratio={ratio}
          complete={kind === 'complete' || celebrate}
        />
        {thumb === 'rd' && (kind === 'complete' || celebrate) ? <span className="growth-clap">👏</span> : null}
        {thumb === 'rd' ? <span className="growth-type-chip">{typeShort}</span> : null}
      </div>
    );
  }
  return (
    <div className="growth-avatar">
      {showBubbles ? <WaterBubbles count={kind === 'achieved' ? 4 : 5} tone={kind === 'achieved' ? 'mint' : 'sky'} /> : null}
      {showTree ? (
        <TreeGlyph ratio={treeRatio} wilted={kind === 'wilted'} complete={kind === 'complete' || celebrate} />
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
