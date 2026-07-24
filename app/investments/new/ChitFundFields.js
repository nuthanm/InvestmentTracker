'use client';

import { useMemo } from 'react';
import { inr } from '@/lib/format';
import {
  PRESET_2_5L_DUAL,
  compareAllPickMonths,
  emptyCustomMonths,
  summarizeChitPick,
} from '@/lib/chit';

function formatRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

export default function ChitFundFields({
  tenureMonths,
  chitMode,
  setChitMode,
  chitValue,
  setChitValue,
  prePickAmount,
  setPrePickAmount,
  postPickAmount,
  setPostPickAmount,
  payouts,
  setPayouts,
  customMonths,
  setCustomMonths,
  pickMonth,
  setPickMonth,
}) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));

  const details = useMemo(() => {
    if (chitMode === 'custom') {
      return {
        mode: 'custom',
        chit_value: Number(chitValue) || 0,
        pick_month: Number(pickMonth) || 1,
        months: Array.from({ length: n }, (_, i) => ({
          payment: Number(customMonths[i]?.payment) || 0,
          payout: Number(customMonths[i]?.payout) || 0,
        })),
      };
    }
    return {
      mode: 'dual_rate',
      chit_value: Number(chitValue) || 0,
      pre_pick_amount: Number(prePickAmount) || 0,
      post_pick_amount: Number(postPickAmount) || 0,
      pick_month: Number(pickMonth) || 1,
      payouts: Array.from({ length: n }, (_, i) => Number(payouts[i]) || 0),
    };
  }, [chitMode, chitValue, prePickAmount, postPickAmount, payouts, customMonths, pickMonth, n]);

  const selected = useMemo(() => summarizeChitPick(details, n, Number(pickMonth) || 1), [details, n, pickMonth]);
  const comparison = useMemo(() => compareAllPickMonths(details, n), [details, n]);

  const applyPreset = () => {
    setChitMode('dual_rate');
    setChitValue(String(PRESET_2_5L_DUAL.chit_value));
    setPrePickAmount(String(PRESET_2_5L_DUAL.pre_pick_amount));
    setPostPickAmount(String(PRESET_2_5L_DUAL.post_pick_amount));
    setPayouts(PRESET_2_5L_DUAL.payouts.map(String));
    setPickMonth(6);
    setCustomMonths(emptyCustomMonths(12));
  };

  const ensurePayoutLength = (list) => Array.from({ length: n }, (_, i) => list[i] ?? '');
  const ensureCustomLength = (list) => Array.from({ length: n }, (_, i) => list[i] || { payment: '', payout: '' });

  const updatePayout = (index, value) => {
    const next = ensurePayoutLength(payouts);
    next[index] = value;
    setPayouts(next);
  };

  const updateCustom = (index, field, value) => {
    const next = ensureCustomLength(customMonths);
    next[index] = { ...next[index], [field]: value };
    setCustomMonths(next);
  };

  const profit = Number(selected.profit_loss || 0);
  const profitTone = profit > 0 ? 'text-mint-600' : profit < 0 ? 'text-danger' : 'text-ink';
  const firstCashflow = Number(selected.cashflows?.[0] || 0);
  const rateLabel = firstCashflow > 0 ? 'Effective borrowing rate' : 'Effective return rate';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-plum-600/20 bg-plum-50/60 p-3.5 text-sm">
        <p className="font-medium text-plum-600">Chit fund schedule</p>
        <p className="text-[11px] text-ink-soft mt-1">
          Enter instalments and month-wise payouts. Pre-pick amount applies through the month you take the chit;
          the higher amount starts the following month. Use the table to compare rates before you pick.
        </p>
        <button type="button" onClick={applyPreset} className="mt-2 text-[11px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-plum-600">
          Fill 2.5L dual-rate example
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-soft mb-1.5">Chit value (₹)<span className="text-danger ml-0.5">*</span></label>
          <input type="number" min="0" step="1" value={chitValue} onChange={(e) => setChitValue(e.target.value)} className="field-input" placeholder="250000" />
        </div>
        <div>
          <label className="block text-xs text-ink-soft mb-1.5">Pick month<span className="text-danger ml-0.5">*</span></label>
          <select value={pickMonth} onChange={(e) => setPickMonth(Number(e.target.value))} className="field-input">
            {Array.from({ length: n }, (_, i) => (
              <option key={i + 1} value={i + 1}>Month {i + 1}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs text-ink-soft mb-2">Payment schedule type</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setChitMode('dual_rate')} className={`chip ${chitMode === 'dual_rate' ? 'on' : ''}`}>Dual rate (before / after pick)</button>
          <button type="button" onClick={() => setChitMode('custom')} className={`chip ${chitMode === 'custom' ? 'on' : ''}`}>Custom monthly amounts</button>
        </div>
      </div>

      {chitMode === 'dual_rate' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Every month before pick (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" min="0" step="1" value={prePickAmount} onChange={(e) => setPrePickAmount(e.target.value)} className="field-input" placeholder="20835" />
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Every month after pick (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" min="0" step="1" value={postPickAmount} onChange={(e) => setPostPickAmount(e.target.value)} className="field-input" placeholder="23335" />
              <p className="text-[11px] text-ink-mute mt-1">Starts from the month after you pick.</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-soft mb-2">Payout if you pick that month<span className="text-danger ml-0.5">*</span></p>
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className={`flex items-center gap-3 px-3.5 py-2 ${i > 0 ? 'border-t border-edge' : ''}`}>
                  <span className="text-xs text-ink-mute w-16 flex-shrink-0">Month {i + 1}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={payouts[i] ?? ''}
                    onChange={(e) => updatePayout(i, e.target.value)}
                    className="field-input py-1.5 text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div>
          <p className="text-xs text-ink-soft mb-2">Month-wise payment and payout<span className="text-danger ml-0.5">*</span></p>
          <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
            <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 px-3.5 py-2 text-[11px] text-ink-mute border-b border-edge">
              <span>Month</span>
              <span>You pay</span>
              <span>You receive</span>
            </div>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className={`grid grid-cols-[4rem_1fr_1fr] gap-2 px-3.5 py-2 items-center ${i > 0 ? 'border-t border-edge' : ''}`}>
                <span className="text-xs text-ink-mute">{i + 1}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customMonths[i]?.payment ?? ''}
                  onChange={(e) => updateCustom(i, 'payment', e.target.value)}
                  className="field-input py-1.5 text-sm"
                  placeholder="0"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customMonths[i]?.payout ?? ''}
                  onChange={(e) => updateCustom(i, 'payout', e.target.value)}
                  className="field-input py-1.5 text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-paper-tint rounded-xl p-3.5 space-y-1.5 text-sm">
        <p className="text-[11px] tracking-wider text-ink-mute uppercase">If you pick month {selected.pick_month}</p>
        <div className="flex justify-between"><span className="text-ink-soft">Total you pay</span><span className="font-medium">{inr(selected.total_paid)}</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">Prize received</span><span className="font-medium">{inr(selected.prize)}</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">Profit / loss</span><span className={`font-medium ${profitTone}`}>{profit >= 0 ? '+' : ''}{inr(profit)}</span></div>
        <div className="flex justify-between pt-1.5 mt-1.5 border-t border-edge"><span className="text-ink-soft">{rateLabel}</span><span className="font-medium text-plum-600">{formatRate(selected.monthly_rate_pct)} /mo</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">Annualized</span><span className="font-medium">{formatRate(selected.annual_rate_pct)}</span></div>
        <p className="text-[11px] text-ink-mute pt-1">Early pick ≈ borrowing (you receive cash first). Late pick ≈ saving (you get the prize at the end).</p>
      </div>

      <div>
        <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Pick-month simulator</p>
        <p className="text-[11px] text-ink-soft mb-2">Tap a row to choose that pick month.</p>
        <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[520px]">
            <thead>
              <tr className="border-b border-edge text-ink-mute">
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium text-right">Payout</th>
                <th className="px-3 py-2 font-medium text-right">Total paid</th>
                <th className="px-3 py-2 font-medium text-right">P/L</th>
                <th className="px-3 py-2 font-medium text-right">Monthly %</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => {
                const selectedRow = row.pick_month === Number(pickMonth);
                const pl = Number(row.profit_loss || 0);
                return (
                  <tr
                    key={row.pick_month}
                    onClick={() => setPickMonth(row.pick_month)}
                    className={`cursor-pointer border-t border-edge ${selectedRow ? 'bg-plum-50' : 'hover:bg-paper-tint'}`}
                  >
                    <td className="px-3 py-2 font-medium">{row.pick_month}</td>
                    <td className="px-3 py-2 text-right">{inr(row.prize)}</td>
                    <td className="px-3 py-2 text-right">{inr(row.total_paid)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${pl > 0 ? 'text-mint-600' : pl < 0 ? 'text-danger' : ''}`}>
                      {pl >= 0 ? '+' : ''}{inr(pl)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatRate(row.monthly_rate_pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
