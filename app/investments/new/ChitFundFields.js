'use client';

import { useMemo, useState } from 'react';
import { inr } from '@/lib/format';
import {
  COMMISSION_MODES,
  PRESET_1_5L_AUCTION,
  PRESET_2_5L_DUAL,
  auctionHasOwnerMonth,
  buildAuctionRows,
  compareAllPickMonths,
  emptyCustomMonths,
  steppedSeries,
  summarizeChitPick,
} from '@/lib/chit';
import ChitPickTable, { chitPickSentence } from '@/components/ChitPickTable';

function formatRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

export const EMPTY_AUCTION = {
  commission_mode: 'commission',
  commission_pct: '5',
  commission_basis: 'discount',
  bids: [],
};

/** Build the chit_details draft object from the form's state. */
export function buildChitDraft({
  chitMode, chitValue, prePickAmount, postPickAmount, payouts, customMonths, auction, pickMonth, n,
}) {
  const base = { chit_value: Number(chitValue) || 0, pick_month: Number(pickMonth) || 1 };
  if (chitMode === 'custom') {
    return {
      ...base,
      mode: 'custom',
      months: Array.from({ length: n }, (_, i) => ({
        payment: Number(customMonths[i]?.payment) || 0,
        payout: Number(customMonths[i]?.payout) || 0,
      })),
    };
  }
  if (chitMode === 'auction') {
    return {
      ...base,
      mode: 'auction',
      commission_mode: auction?.commission_mode || 'commission',
      commission_pct: Number(auction?.commission_pct) || 0,
      commission_basis: auction?.commission_basis || 'discount',
      bids: Array.from({ length: n }, (_, i) => Number(auction?.bids?.[i]) || 0),
    };
  }
  return {
    ...base,
    mode: 'dual_rate',
    pre_pick_amount: Number(prePickAmount) || 0,
    post_pick_amount: Number(postPickAmount) || 0,
    payouts: Array.from({ length: n }, (_, i) => Number(payouts[i]) || 0),
  };
}

function AutoFill({ label, startPlaceholder, stepPlaceholder, onFill }) {
  const [start, setStart] = useState('');
  const [step, setStep] = useState('');
  return (
    <div className="rounded-xl border border-dashed border-edge p-3 mb-2">
      <p className="text-[12px] text-ink-soft mb-2">{label}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[11px] text-ink-mute mb-1">Month 1 (₹)</label>
          <input type="number" min="0" step="1" value={start} onChange={(e) => setStart(e.target.value)} className="field-input py-1.5 text-sm" placeholder={startPlaceholder} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[11px] text-ink-mute mb-1">Goes up each month by (₹)</label>
          <input type="number" min="0" step="1" value={step} onChange={(e) => setStep(e.target.value)} className="field-input py-1.5 text-sm" placeholder={stepPlaceholder} />
        </div>
        <button
          type="button"
          disabled={!(Number(start) > 0)}
          onClick={() => onFill(Number(start), Number(step) || 0)}
          className="text-[12px] px-3 py-2 rounded-full bg-paper-card border border-edge hover:border-plum-600 disabled:opacity-50"
        >
          Fill all months
        </button>
      </div>
      <p className="text-[11px] text-ink-mute mt-1.5">You can still change any month after filling.</p>
    </div>
  );
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
  auction,
  setAuction,
  pickMonth,
  setPickMonth,
}) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));

  const details = useMemo(
    () => buildChitDraft({ chitMode, chitValue, prePickAmount, postPickAmount, payouts, customMonths, auction, pickMonth, n }),
    [chitMode, chitValue, prePickAmount, postPickAmount, payouts, customMonths, auction, pickMonth, n]
  );

  const selected = useMemo(() => summarizeChitPick(details, n, Number(pickMonth) || 1), [details, n, pickMonth]);
  const comparison = useMemo(() => compareAllPickMonths(details, n), [details, n]);
  const auctionRows = useMemo(() => (chitMode === 'auction' ? buildAuctionRows(details, n) : []), [chitMode, details, n]);
  const ownerMonth = auctionHasOwnerMonth(details);

  const applyDualPreset = () => {
    setChitMode('dual_rate');
    setChitValue(String(PRESET_2_5L_DUAL.chit_value));
    setPrePickAmount(String(PRESET_2_5L_DUAL.pre_pick_amount));
    setPostPickAmount(String(PRESET_2_5L_DUAL.post_pick_amount));
    setPayouts(PRESET_2_5L_DUAL.payouts.map(String));
    setPickMonth(6);
    setCustomMonths(emptyCustomMonths(12));
  };

  const applyAuctionPreset = () => {
    setChitMode('auction');
    setChitValue(String(PRESET_1_5L_AUCTION.chit_value));
    setAuction({
      commission_mode: PRESET_1_5L_AUCTION.commission_mode,
      commission_pct: String(PRESET_1_5L_AUCTION.commission_pct),
      commission_basis: PRESET_1_5L_AUCTION.commission_basis,
      bids: PRESET_1_5L_AUCTION.bids.map(String),
    });
    setPickMonth(1);
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

  const updateAuction = (patch) => setAuction({ ...auction, ...patch });
  const updateBid = (index, value) => {
    const next = Array.from({ length: n }, (_, i) => auction?.bids?.[i] ?? '');
    next[index] = value;
    updateAuction({ bids: next });
  };

  const setCommissionMode = (value) => {
    updateAuction({ commission_mode: value });
    if ((value === 'owner' || value === 'owner_commission') && Number(pickMonth) === 1) setPickMonth(Math.min(2, n));
  };

  const profit = Number(selected.profit_loss || 0);
  const profitTone = profit > 0 ? 'text-mint-600' : profit < 0 ? 'text-danger' : 'text-ink';
  const rateLabel = selected.rate_kind === 'loan' ? 'Loan rate (cost of borrowing)' : 'Savings rate (return)';
  const commissionInfo = COMMISSION_MODES.find((m) => m.value === (auction?.commission_mode || 'commission'));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-plum-600/20 bg-plum-50/60 p-3.5 text-sm">
        <p className="font-medium text-plum-600">Chit fund schedule</p>
        <p className="text-[12px] text-ink-soft mt-1">
          Pick the type that matches your chit, enter the month-wise amounts, then use the table to see the loss or gain
          and the rate for every pick month.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={applyDualPreset} className="text-[12px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-plum-600">
            Fill 2.5L fixed example
          </button>
          <button type="button" onClick={applyAuctionPreset} className="text-[12px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-plum-600">
            Fill 1.5L auction example
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-ink-soft mb-2">Chit type</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setChitMode('dual_rate')} className={`chip ${chitMode === 'dual_rate' ? 'on' : ''}`}>Fixed (before / after pick)</button>
          <button type="button" onClick={() => setChitMode('auction')} className={`chip ${chitMode === 'auction' ? 'on' : ''}`}>Auction with dividend</button>
          <button type="button" onClick={() => setChitMode('custom')} className={`chip ${chitMode === 'custom' ? 'on' : ''}`}>Custom monthly amounts</button>
        </div>
        <p className="text-[12px] text-ink-mute mt-1.5">
          {chitMode === 'dual_rate' && 'You pay one amount until you take the chit and a higher amount after that.'}
          {chitMode === 'auction' && 'Each month the winner takes less than the chit value. The difference, less the owner\'s commission, is shared as a dividend, so everyone pays less that month.'}
          {chitMode === 'custom' && 'Type what you pay and what you would get for every month.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-soft mb-1.5">Chit value (₹)<span className="text-danger ml-0.5">*</span></label>
          <input type="number" min="0" step="1" value={chitValue} onChange={(e) => setChitValue(e.target.value)} className="field-input" placeholder={chitMode === 'auction' ? '150000' : '250000'} />
          {chitMode === 'auction' && Number(chitValue) > 0 && (
            <p className="text-[12px] text-ink-mute mt-1">Full instalment {inr(Number(chitValue) / n)} /mo before dividend.</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-ink-soft mb-1.5">Month you take it<span className="text-danger ml-0.5">*</span></label>
          <select value={pickMonth} onChange={(e) => setPickMonth(Number(e.target.value))} className="field-input">
            {Array.from({ length: n }, (_, i) => (
              <option key={i + 1} value={i + 1} disabled={ownerMonth && i === 0}>
                Month {i + 1}{ownerMonth && i === 0 ? ' (owner)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chitMode === 'dual_rate' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Every month until you take it (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" min="0" step="1" value={prePickAmount} onChange={(e) => setPrePickAmount(e.target.value)} className="field-input" placeholder="10000" />
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Every month after you take it (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" min="0" step="1" value={postPickAmount} onChange={(e) => setPostPickAmount(e.target.value)} className="field-input" placeholder="11000" />
              <p className="text-[12px] text-ink-mute mt-1">Starts from the month after you take it.</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-soft mb-2">What you get if you take it that month<span className="text-danger ml-0.5">*</span></p>
            <AutoFill
              label="Quick fill: the amount usually starts lower and goes up a fixed step each month."
              startPlaceholder="97000"
              stepPlaceholder="3000"
              onFill={(start, step) => setPayouts(steppedSeries(n, start, step).map(String))}
            />
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
      )}

      {chitMode === 'auction' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <p className="text-xs text-ink-soft mb-2">Owner&apos;s share</p>
              <div className="flex flex-wrap gap-2">
                {COMMISSION_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setCommissionMode(m.value)}
                    className={`chip ${(auction?.commission_mode || 'commission') === m.value ? 'on' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {commissionInfo && <p className="text-[12px] text-ink-mute mt-1.5">{commissionInfo.hint}</p>}
            </div>
            {auction?.commission_mode !== 'owner' && (
              <>
                <div>
                  <label className="block text-xs text-ink-soft mb-1.5">Commission (%)</label>
                  <input type="number" min="0" max="100" step="0.1" value={auction?.commission_pct ?? ''} onChange={(e) => updateAuction({ commission_pct: e.target.value })} className="field-input" placeholder="5" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-ink-soft mb-1.5">Commission is taken on</label>
                  <select value={auction?.commission_basis || 'discount'} onChange={(e) => updateAuction({ commission_basis: e.target.value })} className="field-input">
                    <option value="discount">The discount (e.g. 5% of ₹30,000 = ₹1,500)</option>
                    <option value="chit_value">The full chit value (e.g. 5% of ₹1,50,000 = ₹7,500)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div>
            <p className="text-xs text-ink-soft mb-2">Amount the winner takes each month<span className="text-danger ml-0.5">*</span></p>
            <AutoFill
              label={`Quick fill: the first auction amount and how much it rises each month (capped at the chit value)${ownerMonth ? '. Month 1 stays with the owner.' : '.'}`}
              startPlaceholder="120000"
              stepPlaceholder="2500"
              onFill={(start, step) => {
                const series = steppedSeries(ownerMonth ? n - 1 : n, start, step, Number(chitValue) || undefined).map(String);
                updateAuction({ bids: ownerMonth ? [String(Number(chitValue) || ''), ...series] : series });
              }}
            />
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead className="sticky top-0 bg-paper-card">
                  <tr className="border-b border-edge text-ink-mute">
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium">Winner takes</th>
                    <th className="px-3 py-2 font-medium text-right">Discount</th>
                    <th className="px-3 py-2 font-medium text-right">Commission</th>
                    <th className="px-3 py-2 font-medium text-right">Dividend each</th>
                    <th className="px-3 py-2 font-medium text-right">You pay</th>
                  </tr>
                </thead>
                <tbody>
                  {auctionRows.map((row, i) => (
                    <tr key={row.month} className="border-t border-edge">
                      <td className="px-3 py-1.5 text-ink-mute">{row.month}</td>
                      <td className="px-3 py-1.5">
                        {row.owner_month ? (
                          <span className="text-ink-soft">{inr(row.payout)} <span className="text-ink-mute">(owner)</span></span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={auction?.bids?.[i] ?? ''}
                            onChange={(e) => updateBid(i, e.target.value)}
                            className="field-input py-1 text-sm w-32"
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">{inr(row.discount)}</td>
                      <td className="px-3 py-1.5 text-right">{inr(row.commission)}</td>
                      <td className="px-3 py-1.5 text-right text-mint-700">{inr(row.dividend)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{inr(row.payment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {chitMode === 'custom' && (
        <div>
          <p className="text-xs text-ink-soft mb-2">Month-wise payment and payout<span className="text-danger ml-0.5">*</span></p>
          <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
            <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 px-3.5 py-2 text-[12px] text-ink-mute border-b border-edge">
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
        <p className="text-[12px] tracking-wider text-ink-mute uppercase">If you take it in month {selected.pick_month}</p>
        <div className="flex justify-between"><span className="text-ink-soft">Total you pay</span><span className="font-medium">{inr(selected.total_paid)}</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">You get</span><span className="font-medium">{inr(selected.prize)}</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">Gain / loss</span><span className={`font-medium ${profitTone}`}>{profit >= 0 ? '+' : ''}{inr(profit)}</span></div>
        <div className="flex justify-between pt-1.5 mt-1.5 border-t border-edge"><span className="text-ink-soft">{rateLabel}</span><span className="font-medium text-plum-600">{formatRate(selected.annual_rate_pct)} p.a.</span></div>
        <div className="flex justify-between"><span className="text-ink-soft">Per month</span><span className="font-medium">{formatRate(selected.monthly_rate_pct)}</span></div>
        <p className="text-[12px] text-ink-soft pt-1">{chitPickSentence(selected)}</p>
      </div>

      <div>
        <p className="text-[12px] tracking-wider text-ink-mute uppercase mb-2">Savings or loan?</p>
        <ChitPickTable rows={comparison} selectedMonth={pickMonth} onSelect={setPickMonth} />
      </div>
    </div>
  );
}
