'use client';

import { inr } from '@/lib/format';
import { chitPickInsights } from '@/lib/chit';

function pct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

/**
 * "Savings or loan?" illustration: for every pick month, what you get,
 * how much extra you pay (or gain), and the rate p.a. as a loan or savings.
 * Rows are clickable when onSelect is given.
 */
export default function ChitPickTable({ rows, selectedMonth, actualMonth, onSelect }) {
  const { first_profit_month: firstProfit, best_month: best } = chitPickInsights(rows);

  const caption = [
    firstProfit ? `Profit from month ${firstProfit}` : 'You pay extra in every month',
    best ? `month ${best} best` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <p className="text-[12px] text-ink-soft mb-2">
        {caption}{onSelect ? '. Tap a month to see that pick.' : ''}
      </p>
      <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[460px]">
          <thead>
            <tr className="border-b border-edge text-ink-mute">
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="px-3 py-2 font-medium text-right">You get</th>
              <th className="px-3 py-2 font-medium text-right">Extra you pay (+) / gain (−)</th>
              <th className="px-3 py-2 font-medium text-right">Rate p.a.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extra = -Number(row.profit_loss || 0);
              const loan = extra > 0;
              const isSelected = row.pick_month === Number(selectedMonth);
              const isBest = row.pick_month === best;
              const tone = row.owner_month ? 'text-ink-mute' : loan ? 'text-danger' : 'text-mint-700';
              let bg = '';
              if (isBest) bg = 'bg-honey-50';
              else if (!loan && !row.owner_month) bg = 'bg-mint-50';
              const ring = isSelected ? 'outline outline-2 -outline-offset-2 outline-plum-600' : '';
              const clickable = onSelect && !row.owner_month;
              return (
                <tr
                  key={row.pick_month}
                  onClick={clickable ? () => onSelect(row.pick_month) : undefined}
                  className={`border-t border-edge ${bg} ${ring} ${clickable ? 'cursor-pointer hover:brightness-95' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {row.pick_month}
                    {row.pick_month === Number(actualMonth) && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-plum-600">yours</span>
                    )}
                    {isBest && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-honey-700">best</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{inr(row.prize)}</td>
                  {row.owner_month ? (
                    <td colSpan={2} className="px-3 py-2 text-right text-ink-mute">Owner&apos;s chit</td>
                  ) : (
                    <>
                      <td className={`px-3 py-2 text-right font-medium ${tone}`}>
                        {extra > 0 ? '+' : extra < 0 ? '−' : ''}{inr(Math.abs(extra))}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${tone}`}>
                        {pct(row.annual_rate_pct)} {row.annual_rate_pct == null ? '' : row.rate_kind === 'loan' ? 'loan' : 'savings'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One-line plain explanation of a single pick. */
export function chitPickSentence(summary, { actual = false } = {}) {
  if (!summary) return '';
  const extra = -Number(summary.profit_loss || 0);
  const who = actual ? 'You took' : 'If you take';
  const rate = summary.annual_rate_pct == null ? '' : ` at about ${Number(summary.annual_rate_pct).toFixed(1)}% p.a.`;
  if (extra > 0) {
    const kind = summary.rate_kind === 'loan' ? `a loan${rate}` : `savings that lose money${rate}`;
    return `${who} month ${summary.pick_month}: you get ${inr(summary.prize)} and pay ${inr(extra)} extra in total. That is ${kind}.`;
  }
  if (extra < 0) {
    return `${who} month ${summary.pick_month}: you get ${inr(summary.prize)}, ${inr(-extra)} more than you pay in. That is savings${rate}.`;
  }
  return `${who} month ${summary.pick_month}: you get back exactly what you pay in.`;
}
