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

function normalizeTypeToken(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
}

const GOLD_TYPE_CODES = new Set(['GOLD', 'GD', 'SGB']);
const SILVER_TYPE_CODES = new Set(['SILV', 'SILVER', 'SLV']);
const RD_TYPE_CODES = new Set(['RD', 'RECURRINGDEPOSIT']);
const CHIT_TYPE_CODES = new Set(['CHIT', 'CHITFUND']);
const SAVINGS_TYPE_CODES = new Set(['SAVINGS', 'SAVING', 'SAV', 'CASH']);
const FUND_TYPE_CODES = new Set(['MF', 'MUTUALFUND']);
const OTHER_TYPE_CODES = new Set(['OT', 'OTHER']);
const MARKET_TYPE_CODES = new Set(['ETF', 'STOCK', 'ST', 'EQ', 'EQUITY', 'SHARES']);

function compactLabel(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s_\-–—·•./]+/g, '');
}

function labelIsSavingsOrCash(value) {
  const compact = compactLabel(value);
  if (!compact) return false;
  if (SAVINGS_TYPE_CODES.has(compact)) return true;
  return compact.includes('SAVING') || compact.includes('CASH');
}

function labelIsMutualFund(value) {
  const compact = compactLabel(value);
  if (!compact) return false;
  if (FUND_TYPE_CODES.has(compact)) return true;
  return compact.includes('MUTUALFUND');
}

function customHasMarketLabel(normalized, raw) {
  if (MARKET_TYPE_CODES.has(normalized)) return true;
  return normalized.includes('ETF') || normalized.includes('STOCK') || normalized.includes('EQUITY') || /\betf\b|\bstock\b|\bequity\b/.test(raw);
}

/**
 * Gold, silver, RD, chit, savings/cash, mutual fund, and ETF/stock.
 * Type code wins, then the custom type label. An OT/OTHER plan is cash only
 * when its plan name or custom label actually says savings or cash.
 */
export function investmentThumbKind(typeCode, customType = '', planName = '') {
  const code = normalizeTypeToken(typeCode);
  const extraNorm = normalizeTypeToken(customType);
  const extra = String(customType || '').trim().toLowerCase();
  if (SILVER_TYPE_CODES.has(code)) return 'silver';
  if (GOLD_TYPE_CODES.has(code)) return 'gold';
  if (RD_TYPE_CODES.has(code)) return 'rd';
  if (CHIT_TYPE_CODES.has(code)) return 'chit';
  if (SAVINGS_TYPE_CODES.has(code) || labelIsSavingsOrCash(typeCode)) return 'savings';
  if (FUND_TYPE_CODES.has(code) || labelIsMutualFund(typeCode)) return 'fund';
  if (MARKET_TYPE_CODES.has(code)) return 'market';
  if (customHasMarketLabel(extraNorm, extra)) return 'market';
  if (SILVER_TYPE_CODES.has(extraNorm) || /\bsilver\b/.test(extra)) return 'silver';
  if (GOLD_TYPE_CODES.has(extraNorm) || /\bgold\b/.test(extra) || /sovereign gold/.test(extra)) return 'gold';
  if (RD_TYPE_CODES.has(extraNorm) || /\brd\b/.test(extra) || /recurring deposit/.test(extra)) return 'rd';
  if (CHIT_TYPE_CODES.has(extraNorm) || /\bchit\b/.test(extra) || /chit fund/.test(extra)) return 'chit';
  if (labelIsMutualFund(customType)) return 'fund';
  if (labelIsSavingsOrCash(customType)) return 'savings';
  if (OTHER_TYPE_CODES.has(code) && labelIsSavingsOrCash(planName)) return 'savings';
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
 * Water depth is exactly the progress percentage of the tile height.
 * 0% renders nothing. 1% is a 1% layer. 100% fills the tile.
 */
export function GoalWaterFill({ pct = 0 }) {
  const fill = Math.max(0, Math.min(100, Number(pct) || 0));
  if (fill <= 0) return null;
  const full = fill >= 100;
  return (
    <div className="goal-water-clip" data-water={fill} aria-hidden="true">
      <div
        className={`goal-water-body${full ? ' is-full' : ''}`}
        style={{ height: `${fill}%` }}
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

/** Notes and a coin that tick forward, like cash being counted. */
export function CashGlyph() {
  return (
    <span className="cash-count" aria-hidden="true">
      <svg viewBox="0 0 36 36" className="cash-count-svg">
        <g className="cash-note cash-note-back">
          <rect x="5.5" y="15.5" width="20" height="12" rx="2" />
          <circle cx="15.5" cy="21.5" r="2.4" />
        </g>
        <g className="cash-note cash-note-mid">
          <rect x="7.2" y="12.2" width="20" height="12" rx="2" />
          <circle cx="17.2" cy="18.2" r="2.4" />
        </g>
        <g className="cash-note cash-note-front">
          <rect x="9" y="8.5" width="20" height="12.5" rx="2" />
          <circle cx="19" cy="14.7" r="2.7" />
          <text x="19" y="16.15" textAnchor="middle" fontSize="4.2" fontWeight="700" fontFamily="Georgia, serif">₹</text>
        </g>
        <g className="cash-coin">
          <circle cx="27.2" cy="26.2" r="5.1" />
          <circle cx="27.2" cy="26.2" r="3.5" />
          <text x="27.2" y="27.7" textAnchor="middle" fontSize="4.4" fontWeight="700" fontFamily="Georgia, serif">₹</text>
        </g>
      </svg>
    </span>
  );
}

/** Candles and a trend line that redraw, as a small market mark. */
export function MarketGlyph() {
  return (
    <span className="market-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" className="market-mark-svg">
        <line className="market-axis" x1="4" y1="30" x2="33" y2="30" />
        <g className="market-candle market-candle-a">
          <line x1="9" y1="22" x2="9" y2="8" />
          <rect x="6.6" y="12" width="4.8" height="8" rx="0.6" />
        </g>
        <g className="market-candle market-candle-b market-candle-down">
          <line x1="17" y1="24" x2="17" y2="11" />
          <rect x="14.6" y="14" width="4.8" height="7" rx="0.6" />
        </g>
        <g className="market-candle market-candle-c">
          <line x1="25" y1="20" x2="25" y2="6" />
          <rect x="22.6" y="8" width="4.8" height="9" rx="0.6" />
        </g>
        <polyline className="market-trend" points="5,23 11,16 17,19 25,9 32,6" />
      </svg>
    </span>
  );
}

/** A fund pie that pulses, with bars that rise beside it. */
export function FundGlyph() {
  return (
    <span className="fund-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" className="fund-mark-svg">
        <g className="fund-pie">
          <path className="fund-slice fund-slice-a" d="M12 18 L12 10.6 A7.4 7.4 0 0 1 15.7 24.41 Z" />
          <path className="fund-slice fund-slice-b" d="M12 18 L15.7 24.41 A7.4 7.4 0 0 1 4.6 18 Z" />
          <path className="fund-slice fund-slice-c" d="M12 18 L4.6 18 A7.4 7.4 0 0 1 12 10.6 Z" />
          <circle cx="12" cy="18" r="3.1" className="fund-pie-hole" />
        </g>
        <g className="fund-bars">
          <rect className="fund-bar fund-bar-a" x="22.2" y="22" width="3.3" height="8" rx="0.8" />
          <rect className="fund-bar fund-bar-b" x="26.4" y="16.5" width="3.3" height="13.5" rx="0.8" />
          <rect className="fund-bar fund-bar-c" x="30.6" y="11" width="3.3" height="19" rx="0.8" />
        </g>
      </svg>
    </span>
  );
}

export function TypeThumbnail({
  typeCode,
  customType,
  planName = '',
  wilted = false,
  ratio = null,
  complete = false,
}) {
  const thumb = investmentThumbKind(typeCode, customType, planName);
  if (thumb === 'gold' || thumb === 'silver') {
    return (
      <span className="type-thumb">
        <CoinGlyph metal={thumb} />
      </span>
    );
  }
  if (thumb === 'rd' || thumb === 'chit') {
    return (
      <span className="type-thumb">
        <RealTreeGlyph wilted={wilted} ratio={ratio} complete={complete} />
      </span>
    );
  }
  if (thumb === 'savings') {
    return (
      <span className="type-thumb">
        <CashGlyph />
      </span>
    );
  }
  if (thumb === 'fund') {
    return (
      <span className="type-thumb">
        <FundGlyph />
      </span>
    );
  }
  if (thumb === 'market') {
    return (
      <span className="type-thumb">
        <MarketGlyph />
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
  planName = '',
  toneClass,
  celebrate = false,
}) {
  const thumb = investmentThumbKind(typeCode, customType, planName);
  const showTree = kind === 'tree' || kind === 'wilted' || kind === 'complete';
  const showBubbles = kind === 'bubbles' || kind === 'achieved';
  const treeRatio = Number(ratio) || 0;
  if (thumb === 'gold' || thumb === 'silver' || thumb === 'rd' || thumb === 'chit' || thumb === 'savings' || thumb === 'fund' || thumb === 'market') {
    const treeThumb = thumb === 'rd' || thumb === 'chit';
    return (
      <div className="growth-avatar">
        <TypeThumbnail
          typeCode={typeCode}
          customType={customType}
          planName={planName}
          wilted={kind === 'wilted'}
          ratio={ratio}
          complete={kind === 'complete' || celebrate}
        />
        {treeThumb && (kind === 'complete' || celebrate) ? <span className="growth-clap">👏</span> : null}
        {treeThumb ? <span className="growth-type-chip">{typeShort}</span> : null}
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
