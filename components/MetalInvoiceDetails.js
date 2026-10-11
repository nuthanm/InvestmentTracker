'use client';

import { inrPaise } from '@/lib/format';

function Row({ label, value, valueClassName = '' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className={`font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function MetalInvoiceDetails({ pricing, purchaseMode = 'general', metalName = 'gold' }) {
  if (!pricing) {
    return <p className="text-[11px] text-ink-mute">Enter weight and price to see the bill.</p>;
  }

  const directPurchase = purchaseMode !== 'scheme';
  const grams = Number(pricing.units || 0);
  const investedAmount = Math.round((pricing.baseValue + pricing.payableMakingAmount + pricing.totalGst) * 100) / 100;
  const payable = pricing.customerPayNowAmount || 0;

  return (
    <div className="space-y-2">
      <p className="text-[11px] tracking-wider text-ink-mute uppercase">Invoice calculation</p>

      {directPurchase ? (
        <>
          <Row label="Metal value (grams × rate)" value={inrPaise(pricing.baseValue)} />
          <Row label="Making charges" value={inrPaise(pricing.generalMakingAmount)} />
          {pricing.sgstAmount > 0 || pricing.cgstAmount > 0 ? (
            <>
              <Row label={`SGST ${pricing.derivedSgstPct.toFixed(2)}%`} value={inrPaise(pricing.sgstAmount)} />
              <Row label={`CGST ${pricing.derivedCgstPct.toFixed(2)}%`} value={inrPaise(pricing.cgstAmount)} />
            </>
          ) : null}
          <Row label="GST total" value={inrPaise(pricing.totalGst)} />
          <div className="flex justify-between gap-3 pt-1 border-t border-edge">
            <span className="text-ink-soft">Amount payable</span>
            <span className="font-medium text-honey-600">{inrPaise(pricing.generalTotal)}</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-1">With scheme</p>
          <Row label="Metal value (grams × rate)" value={inrPaise(pricing.baseValue)} />
          <Row label="Making charges you pay" value={inrPaise(pricing.payableMakingAmount)} />
          <Row label="Scheme discount" value={`- ${inrPaise(pricing.totalDiscountAmount)}`} valueClassName="text-mint-600" />
          <Row label="GST amount" value={inrPaise(pricing.totalGst)} />
          <div className="flex justify-between gap-3 pt-1 border-t border-edge">
            <span className="text-ink-soft">Total invoice value (with scheme)</span>
            <span className="font-medium text-mint-600">{inrPaise(pricing.schemeTotal)}</span>
          </div>

          <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-2 border-t border-dashed border-edge">Without scheme</p>
          <Row label="Metal value (grams × rate)" value={inrPaise(pricing.baseValue)} />
          <Row label="Making charges" value={inrPaise(pricing.generalMakingAmount)} />
          <Row label="GST amount" value={inrPaise(pricing.generalGstAmount)} />
          <div className="flex justify-between gap-3 pt-1 border-t border-edge">
            <span className="text-ink-soft">Total invoice value (without scheme)</span>
            <span className="font-medium">{inrPaise(pricing.generalTotal)}</span>
          </div>

          <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-2 border-t border-dashed border-edge">Scheme grams split</p>
          <Row label="Scheme accumulated grams" value={`${pricing.accumulatedGrams.toFixed(3)} g`} />
          <Row label="Purchased grams" value={`${pricing.purchasedGrams.toFixed(3)} g`} />
          <Row
            label="Extra grams"
            value={`${pricing.gramsDifference >= 0 ? '+' : ''}${pricing.gramsDifference.toFixed(3)} g`}
            valueClassName={pricing.gramsDifference >= 0 ? 'text-mint-600' : 'text-danger'}
          />
          <Row label="Scheme accumulated value" value={inrPaise(pricing.schemeAccumulatedValue)} />
          <Row label="Payable for extra grams" value={inrPaise(pricing.extraGramPayableAmount)} valueClassName="text-honey-600" />
          <Row label="Balance after scheme credit" value={inrPaise(pricing.payableAfterSchemeCredit)} valueClassName="text-honey-600" />

          {pricing.isPrematureWithdrawal && (
            <>
              <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-2 border-t border-dashed border-edge">Premature withdrawal</p>
              <Row label="Amount paid into scheme" value={inrPaise(pricing.paidAmount)} />
              <Row label={`Withdrawal penalty (${pricing.prematurePenaltyPct.toFixed(2)}%)`} value={`- ${inrPaise(pricing.prematurePenaltyAmount)}`} valueClassName="text-danger" />
              <Row label="Estimated cash refund" value={inrPaise(pricing.prematureCashRefund)} valueClassName="text-mint-600" />
              <Row label="Scheme benefit forfeited" value={inrPaise(pricing.prematureBenefitForfeited)} valueClassName="text-danger" />
              {pricing.hasPurchaseQuote && (
                <Row label="Gold settlement at general rates" value={inrPaise(pricing.prematureGeneralSettlement)} valueClassName="text-honey-600" />
              )}
            </>
          )}

          <div className="flex justify-between gap-3 pt-2 border-t border-edge">
            <span className="text-ink-soft">Amount payable now</span>
            <span className="font-medium text-honey-600">{inrPaise(payable)}</span>
          </div>
        </>
      )}

      <p className="text-[11px] text-ink-mute pt-2 border-t border-dashed border-edge">
        Saving adds {grams.toFixed(3)} g to your {metalName} accumulation goal and {inrPaise(investedAmount)} to the linked goal&apos;s invested amount.
      </p>
    </div>
  );
}
