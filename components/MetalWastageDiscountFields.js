'use client';

import { inrPaise } from '@/lib/format';

function ModeField({
  label,
  mode,
  onMode,
  percentValue,
  onPercent,
  rupeeValue,
  onRupee,
  help,
  computed,
}) {
  const isPercent = mode !== 'value';
  return (
    <div>
      <label className="block text-xs text-ink-soft mb-1.5">{label}</label>
      <select value={isPercent ? 'percentage' : 'value'} onChange={(e) => onMode(e.target.value)} className="field-input">
        <option value="percentage">Percentage</option>
        <option value="value">Actual value (₹)</option>
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        value={isPercent ? percentValue : rupeeValue}
        onChange={(e) => (isPercent ? onPercent(e.target.value) : onRupee(e.target.value))}
        className="field-input mt-2"
        placeholder={isPercent ? '0' : '0.00'}
      />
      <p className="text-[11px] text-ink-mute mt-1">
        {help}
        {computed ? ` ${computed}` : ''}
      </p>
    </div>
  );
}

export default function MetalWastageDiscountFields({
  wastageMode,
  onWastageMode,
  wastagePct,
  onWastagePct,
  wastageValue,
  onWastageValue,
  stoneValue,
  onStoneValue,
  discountMode,
  onDiscountMode,
  discountPct,
  onDiscountPct,
  discountValue,
  onDiscountValue,
  pricing,
}) {
  const wastageComputed = pricing && pricing.wastageAmount > 0
    ? `Adds ${inrPaise(pricing.wastageAmount)}${pricing.wastageGrams > 0 ? ` (${pricing.wastageGrams.toFixed(3)} g)` : ''}.`
    : '';
  const stoneComputed = pricing && pricing.stoneAmount > 0
    ? `Adds ${inrPaise(pricing.stoneAmount)} to the bill.`
    : '';
  const discountComputed = pricing && pricing.billDiscountAmount > 0
    ? `Takes off ${inrPaise(pricing.billDiscountAmount)} before GST.`
    : '';

  return (
    <>
      <ModeField
        label="Wastage"
        mode={wastageMode}
        onMode={onWastageMode}
        percentValue={wastagePct}
        onPercent={onWastagePct}
        rupeeValue={wastageValue}
        onRupee={onWastageValue}
        help={wastageMode === 'value'
          ? 'Rupee wastage printed on the bill.'
          : 'Percent of the gold value, the same as a percent of the weight.'}
        computed={wastageComputed}
      />
      <div>
        <label className="block text-xs text-ink-soft mb-1.5">Stone (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={stoneValue}
          onChange={(e) => onStoneValue(e.target.value)}
          className="field-input"
          placeholder="0.00"
        />
        <p className="text-[11px] text-ink-mute mt-1">
          Diamond or gemstone amount printed on the bill.
          {stoneComputed ? ` ${stoneComputed}` : ''}
        </p>
      </div>
      <ModeField
        label="Discount"
        mode={discountMode}
        onMode={onDiscountMode}
        percentValue={discountPct}
        onPercent={onDiscountPct}
        rupeeValue={discountValue}
        onRupee={onDiscountValue}
        help={discountMode === 'value'
          ? 'Rupee discount on the bill, taken off before GST.'
          : 'Percent of gold value, wastage, stone, and making charges, before GST.'}
        computed={discountComputed}
      />
    </>
  );
}
