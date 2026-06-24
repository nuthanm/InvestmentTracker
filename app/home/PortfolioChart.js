'use client';

import { useMemo, useRef, useState } from 'react';
import { computeMaturity, computeRecurringMaturity, inrShort } from '@/lib/format';
import { isMarketInvestment } from '@/lib/investments';

// ─── Data helpers ─────────────────────────────────────────────────────────────

const MS_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

/** Projected value of a single non-market investment at date D. */
function valueAtDate(inv, D) {
  const start = inv.start_date ? new Date(inv.start_date) : null;
  if (!start || D < start) return 0;

  const maturity = inv.maturity_date ? new Date(inv.maturity_date) : null;
  if (maturity && D >= maturity) return Number(inv.maturity_value || 0);

  const amount = Number(inv.amount || 0);
  const ratePct = Number(inv.rate_pct || 0);
  const tenureMonths = Number(inv.tenure_months || 0) + Number(inv.tenure_days || 0) / 30;
  const frequency = inv.payment_frequency || 'lump_sum';
  const monthsElapsed = Math.min((D - start) / MS_MONTH, tenureMonths);
  if (monthsElapsed <= 0) return 0;

  if (frequency === 'monthly' || frequency === 'yearly') {
    return computeRecurringMaturity({ amountPerPeriod: amount, ratePct, months: monthsElapsed, paymentFrequency: frequency });
  }
  return computeMaturity({ amount, ratePct, months: monthsElapsed, compounding: inv.compounding || 'quarterly' });
}

/** Amount invested in a single non-market investment at date D. */
function investedAtDate(inv, D) {
  const start = inv.start_date ? new Date(inv.start_date) : null;
  if (!start || D < start) return 0;

  const amount = Number(inv.amount || 0);
  const frequency = inv.payment_frequency || 'lump_sum';
  const tenureMonths = Number(inv.tenure_months || 0);

  if (frequency === 'monthly') {
    const monthsDiff = (D.getFullYear() - start.getFullYear()) * 12 + (D.getMonth() - start.getMonth());
    const due = new Date(start);
    due.setMonth(due.getMonth() + monthsDiff);
    return amount * Math.max(0, Math.min(monthsDiff + (due <= D ? 1 : 0), tenureMonths));
  }
  if (frequency === 'yearly') {
    const years = Math.floor(tenureMonths / 12);
    const yd = D.getFullYear() - start.getFullYear();
    const due = new Date(start);
    due.setFullYear(due.getFullYear() + yd);
    return amount * Math.max(0, Math.min(yd + (due <= D ? 1 : 0), years));
  }
  return amount; // lump_sum
}

const RANGES = [
  { key: '1M', label: '1M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: '3Y', label: '3Y' },
  { key: '5Y', label: '5Y' },
  { key: 'All', label: 'All' },
];

function getRangeWindow(key, investments) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (key === 'All') {
    const starts = investments.map((i) => i.start_date ? new Date(i.start_date) : today);
    const ends = investments.map((i) => i.maturity_date ? new Date(i.maturity_date) : today);
    const from = new Date(Math.min(...starts.map((d) => d.getTime()), today.getTime()));
    const to = new Date(Math.max(...ends.map((d) => d.getTime()), today.getTime()));
    // Ensure at least a 6-month window
    if (to - from < 6 * MS_MONTH) {
      const extended = new Date(to);
      extended.setMonth(extended.getMonth() + 6);
      return { from, to: extended };
    }
    return { from, to };
  }

  const monthsHalf = { '1M': 1, '6M': 3, '1Y': 6, '3Y': 18, '5Y': 30 }[key] || 6;
  const from = new Date(today); from.setMonth(from.getMonth() - monthsHalf);
  const to = new Date(today); to.setMonth(to.getMonth() + monthsHalf);
  return { from, to };
}

function buildChartPoints(investments, from, to) {
  const points = [];
  const step = new Date(from);
  step.setDate(1);
  // Monthly data points
  while (step <= to) {
    const D = new Date(step);
    let totalValue = 0;
    let totalInvested = 0;
    for (const inv of investments) {
      if (isMarketInvestment(inv.type_code)) {
        const start = inv.start_date ? new Date(inv.start_date) : null;
        if (start && D >= start) {
          const cb = Number(inv.remaining_cost_basis ?? inv.invested_amount ?? 0);
          totalValue += cb;
          totalInvested += Number(inv.invested_amount ?? 0);
        }
      } else {
        totalValue += valueAtDate(inv, D);
        totalInvested += investedAtDate(inv, D);
      }
    }
    points.push({ date: D, value: totalValue, invested: totalInvested });
    step.setMonth(step.getMonth() + 1);
  }
  return points;
}

function getMaturityEvents(investments, from, to) {
  return investments
    .filter((inv) => !isMarketInvestment(inv.type_code) && inv.maturity_date)
    .map((inv) => ({ date: new Date(inv.maturity_date), amount: Number(inv.maturity_value || 0), label: `${inv.bank} · ${inv.plan_name}` }))
    .filter((ev) => ev.date >= from && ev.date <= to);
}

// ─── SVG chart ────────────────────────────────────────────────────────────────

const L = 58; // left margin (y-axis labels)
const R = 18; // right margin
const T = 12; // top margin
const B = 34; // bottom margin
const VW = 800;
const VH = 220;
const PW = VW - L - R; // plot width  = 724
const PH = VH - T - B; // plot height = 174

function scaleX(date, from, to) {
  const span = to - from || 1;
  return L + ((date - from) / span) * PW;
}

function scaleY(value, maxVal) {
  if (maxVal === 0) return T + PH;
  return T + PH - (value / maxVal) * PH;
}

function polyPoints(pts, field, from, to, maxVal) {
  return pts.map((p) => `${scaleX(p.date, from, to).toFixed(1)},${scaleY(p[field], maxVal).toFixed(1)}`).join(' ');
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function xLabels(from, to) {
  const labels = [];
  const span = to - from;
  const months = span / MS_MONTH;
  // Choose label interval
  const interval = months <= 3 ? 1 : months <= 12 ? 2 : months <= 36 ? 6 : 12;
  const cur = new Date(from);
  cur.setDate(1);
  while (cur <= to) {
    const d = new Date(cur);
    const x = scaleX(d, from, to);
    if (x >= L && x <= L + PW) {
      const lbl = interval >= 12 ? `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${SHORT_MONTHS[d.getMonth()]}${interval === 1 ? '' : ` '${String(d.getFullYear()).slice(2)}`}`;
      labels.push({ x, label: lbl });
    }
    cur.setMonth(cur.getMonth() + interval);
  }
  return labels;
}

function yLabels(maxVal) {
  if (maxVal === 0) return [];
  const labels = [];
  for (let i = 0; i <= 4; i++) {
    const v = (maxVal * i) / 4;
    labels.push({ y: scaleY(v, maxVal), label: inrShort(v) });
  }
  return labels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortfolioChart({ investments = [], goalAmount = null, goalDate = null }) {
  const [range, setRange] = useState('All');
  const [hoverX, setHoverX] = useState(null);
  const svgRef = useRef(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const { from, to } = useMemo(() => getRangeWindow(range, investments), [range, investments]);

  const points = useMemo(() => buildChartPoints(investments, from, to), [investments, from, to]);

  const maturityEvents = useMemo(() => getMaturityEvents(investments, from, to), [investments, from, to]);

  const maxVal = useMemo(() => {
    const dataMax = Math.max(...points.map((p) => p.value), 0);
    return dataMax * 1.15 || 1;
  }, [points]);

  const todayX = scaleX(today, from, to);
  // Clamp goal line to the top of the chart area so it always renders even when
  // the goal amount exceeds the data-driven y-axis maximum.
  const goalLineY = goalAmount ? Math.max(T, scaleY(goalAmount, maxVal)) : null;
  const goalDateX = goalDate ? scaleX(new Date(goalDate), from, to) : null;

  // Hover: find nearest point
  const hoverPoint = useMemo(() => {
    if (hoverX === null || !points.length) return null;
    // Convert SVG hoverX to data date
    const frac = (hoverX - L) / PW;
    const ts = from.getTime() + frac * (to - from);
    let best = null;
    let bestDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.date.getTime() - ts);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }, [hoverX, points, from, to]);

  const hoverPtX = hoverPoint ? scaleX(hoverPoint.date, from, to) : null;

  function onMouseMove(e) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * VW;
    if (svgX < L || svgX > L + PW) { setHoverX(null); return; }
    setHoverX(svgX);
  }

  const xl = useMemo(() => xLabels(from, to), [from, to]);
  const yl = useMemo(() => yLabels(maxVal), [maxVal]);

  if (!investments.length) return null;

  // Format date nicely for tooltip
  function fmtTooltipDate(d) {
    return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  const hoverMaturity = hoverPoint
    ? maturityEvents.filter((ev) => Math.abs(ev.date.getTime() - hoverPoint.date.getTime()) < 25 * 24 * 60 * 60 * 1000)
    : [];

  return (
    <div className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-medium">Portfolio Projection</h2>
        <div className="flex gap-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition ${range === r.key ? 'bg-ink text-paper font-medium' : 'text-ink-mute hover:text-ink hover:bg-paper-tint'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative" onMouseLeave={() => setHoverX(null)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full h-auto select-none"
          onMouseMove={onMouseMove}
        >
          {/* Grid lines */}
          {yl.map((g, i) => (
            <line key={i} x1={L} y1={g.y.toFixed(1)} x2={L + PW} y2={g.y.toFixed(1)}
              stroke="#E2DDCB" strokeWidth="1" strokeDasharray={i === 0 ? '' : '3,3'} />
          ))}

          {/* Y-axis labels */}
          {yl.map((g, i) => (
            <text key={i} x={L - 5} y={g.y + 4} textAnchor="end" fontSize="9" fill="#7A867F">{g.label}</text>
          ))}

          {/* X-axis labels */}
          {xl.map((g, i) => (
            <text key={i} x={g.x} y={T + PH + 20} textAnchor="middle" fontSize="9" fill="#7A867F">{g.label}</text>
          ))}

          {/* Goal amount dashed line */}
          {goalLineY !== null && goalLineY <= T + PH && (
            <>
              <line x1={L} y1={goalLineY.toFixed(1)} x2={L + PW} y2={goalLineY.toFixed(1)}
                stroke="#3C3489" strokeWidth="1.5" strokeDasharray="6,4" />
              <text x={L + PW - 4} y={goalLineY - 4} textAnchor="end" fontSize="9" fill="#3C3489" fontWeight="500">
                Goal {inrShort(goalAmount)}
              </text>
            </>
          )}

          {/* Goal date vertical marker */}
          {goalDateX !== null && goalDateX >= L && goalDateX <= L + PW && (
            <line x1={goalDateX.toFixed(1)} y1={T} x2={goalDateX.toFixed(1)} y2={T + PH}
              stroke="#3C3489" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          )}

          {/* Invested area (light blue fill) */}
          {points.length > 1 && (
            <polyline
              points={`${L},${(T + PH).toFixed(1)} ${polyPoints(points, 'invested', from, to, maxVal)} ${scaleX(points[points.length - 1].date, from, to).toFixed(1)},${(T + PH).toFixed(1)}`}
              fill="#E6F1FB" stroke="none"
            />
          )}

          {/* Invested line (blue) */}
          {points.length > 1 && (
            <polyline points={polyPoints(points, 'invested', from, to, maxVal)}
              fill="none" stroke="#185FA5" strokeWidth="1.5" strokeLinejoin="round" />
          )}

          {/* Value area (light green fill) */}
          {points.length > 1 && (
            <polyline
              points={`${L},${(T + PH).toFixed(1)} ${polyPoints(points, 'value', from, to, maxVal)} ${scaleX(points[points.length - 1].date, from, to).toFixed(1)},${(T + PH).toFixed(1)}`}
              fill="#E1F5EE" stroke="none" opacity="0.6"
            />
          )}

          {/* Value line (green) */}
          {points.length > 1 && (
            <polyline points={polyPoints(points, 'value', from, to, maxVal)}
              fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinejoin="round" />
          )}

          {/* Today marker */}
          {todayX >= L && todayX <= L + PW && (
            <>
              <line x1={todayX.toFixed(1)} y1={T} x2={todayX.toFixed(1)} y2={T + PH}
                stroke="#A8B0AB" strokeWidth="1" strokeDasharray="4,3" />
              <text x={todayX + 3} y={T + 10} fontSize="8" fill="#7A867F">Today</text>
            </>
          )}

          {/* Maturity event dots */}
          {maturityEvents.map((ev, i) => {
            const ex = scaleX(ev.date, from, to);
            if (ex < L || ex > L + PW) return null;
            const totalValAtMaturity = points.reduce((best, p) => {
              return Math.abs(p.date.getTime() - ev.date.getTime()) < Math.abs(best.date.getTime() - ev.date.getTime()) ? p : best;
            }, points[0] || { date: ev.date, value: 0 });
            const ey = scaleY(totalValAtMaturity.value, maxVal);
            return (
              <circle key={i} cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="4"
                fill="#0F6E56" stroke="white" strokeWidth="1.5" className="cursor-pointer" />
            );
          })}

          {/* Hover crosshair */}
          {hoverPtX !== null && (
            <line x1={hoverPtX.toFixed(1)} y1={T} x2={hoverPtX.toFixed(1)} y2={T + PH}
              stroke="#0E1714" strokeWidth="1" strokeDasharray="3,2" opacity="0.3" />
          )}

          {/* Hover dots */}
          {hoverPoint && hoverPtX !== null && (
            <>
              <circle cx={hoverPtX.toFixed(1)} cy={scaleY(hoverPoint.invested, maxVal).toFixed(1)} r="4"
                fill="white" stroke="#185FA5" strokeWidth="2" />
              <circle cx={hoverPtX.toFixed(1)} cy={scaleY(hoverPoint.value, maxVal).toFixed(1)} r="4"
                fill="white" stroke="#0F6E56" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverPoint && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-ink text-paper text-[11px] rounded-lg px-3 py-2 shadow-lg min-w-[160px] z-10">
            <p className="font-medium mb-1 text-center">{fmtTooltipDate(hoverPoint.date)}</p>
            <div className="flex justify-between gap-4">
              <span className="text-[10px] text-ink-mute">Invested</span>
              <span className="font-medium text-sky-50">{inrShort(hoverPoint.invested)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[10px] text-ink-mute">Projected</span>
              <span className="font-medium text-mint-50">{inrShort(hoverPoint.value)}</span>
            </div>
            {hoverPoint.value > 0 && hoverPoint.invested > 0 && (
              <div className="flex justify-between gap-4 border-t border-edge mt-1 pt-1">
                <span className="text-[10px] text-ink-mute">Return</span>
                <span className="font-medium text-mint-50">
                  +{(((hoverPoint.value - hoverPoint.invested) / hoverPoint.invested) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {hoverMaturity.length > 0 && (
              <div className="border-t border-edge mt-1.5 pt-1.5">
                {hoverMaturity.map((ev, i) => (
                  <p key={i} className="text-[10px] text-mint-50">
                    ● {ev.label} matured {inrShort(ev.amount)}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2 pl-1">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span className="w-3 h-0.5 bg-sky-600 inline-block rounded" /> Invested
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span className="w-3 h-0.5 bg-mint-600 inline-block rounded" /> Projected Value
        </span>
        {goalAmount && (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="inline-block w-5" style={{ borderTop: '2px dashed #3C3489' }} /> Goal
          </span>
        )}
        {maturityEvents.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="w-2 h-2 rounded-full bg-mint-600 inline-block" /> Maturity
          </span>
        )}
      </div>
    </div>
  );
}
