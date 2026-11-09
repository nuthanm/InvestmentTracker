import { inrPaise } from '@/lib/format';
import {
  LIFECYCLE_STATUSES,
  LIFECYCLE_STATUS_OPTIONS,
  isPrematureWithdrawalStatus,
} from '@/lib/investment-lifecycle';

export const SCHEME_STATUSES = LIFECYCLE_STATUSES;

export const SCHEME_STATUS_OPTIONS = LIFECYCLE_STATUS_OPTIONS.filter(
  (option) => option.value !== LIFECYCLE_STATUSES.MATURED,
);

export function isPrematureWithdrawal(schemeStatus) {
  return isPrematureWithdrawalStatus(schemeStatus);
}

export function schemeNeedsTracking(schemeStatus) {
  return schemeStatus === SCHEME_STATUSES.ACTIVE || isPrematureWithdrawal(schemeStatus);
}

export function validateSchemeTracking({ schemeStatus, schemeMonths, schemeMonthlyAmount, schemePaidMonths }) {
  if (!schemeNeedsTracking(schemeStatus)) return null;

  const months = Number(schemeMonths || 0);
  const paid = Number(schemePaidMonths || 0);
  const monthly = Number(schemeMonthlyAmount || 0);

  if (months <= 0) return 'Scheme months must be greater than zero.';
  if (monthly <= 0) return 'Scheme monthly amount must be greater than zero.';
  if (paid < 0 || paid > months) return 'Paid months must be between 0 and total scheme months.';

  if (isPrematureWithdrawal(schemeStatus)) {
    if (paid <= 0) return 'Paid months must be greater than zero for premature withdrawal.';
    if (paid >= months) return 'Premature withdrawal applies only before all scheme months are completed.';
  }

  return null;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function nonNegative(n) {
  return Math.max(Number(n) || 0, 0);
}

function discountOn(preTax, usePercent, pct, value) {
  const base = Math.max(preTax, 0);
  const raw = usePercent ? (base * nonNegative(pct)) / 100 : nonNegative(value);
  return round2(Math.min(Math.max(raw, 0), base));
}

// Stores a gold buy so weight × rate stays the gross, and net amount is what was paid.
// Charges absorb wastage, stone, and discount. A discount larger than wastage + stone + making
// reduces the stored gross instead, because charges cannot be negative.
export function metalBuyLedgerAmounts(pricing) {
  const base = round2(pricing?.baseValue);
  const gst = round2(pricing?.totalGst);
  const extras = round2(
    (Number(pricing?.wastageAmount) || 0)
    + (Number(pricing?.stoneAmount) || 0)
    + (Number(pricing?.payableMakingAmount) || 0)
    - (Number(pricing?.billDiscountAmount) || 0)
  );
  if (extras >= 0) {
    return {
      totalAmount: base,
      charges: extras,
      taxes: gst,
      amountPaid: round2(base + extras + gst),
    };
  }
  const totalAmount = round2(Math.max(base + extras, 0));
  return {
    totalAmount,
    charges: 0,
    taxes: gst,
    amountPaid: round2(totalAmount + gst),
  };
}

export function metalAdjustmentNoteLines({
  useWastagePercent = true,
  wastagePct = 0,
  useDiscountPercent = true,
  discountPct = 0,
  pricing,
}) {
  if (!pricing) return [];
  const lines = [];
  if (pricing.wastageAmount > 0) {
    lines.push(useWastagePercent
      ? `Wastage: ${Number(wastagePct || 0).toFixed(2)}% (${inrPaise(pricing.wastageAmount)})`
      : `Wastage: ${inrPaise(pricing.wastageAmount)}`);
  }
  if (pricing.stoneAmount > 0) {
    lines.push(`Stone: ${inrPaise(pricing.stoneAmount)}`);
  }
  if (pricing.billDiscountAmount > 0) {
    lines.push(useDiscountPercent
      ? `Bill discount: ${Number(discountPct || 0).toFixed(2)}% (${inrPaise(pricing.billDiscountAmount)})`
      : `Bill discount: ${inrPaise(pricing.billDiscountAmount)}`);
  }
  if (lines.length && pricing.invoiceCost > 0) {
    lines.push(`Amount paid: ${inrPaise(pricing.invoiceCost)}`);
  }
  return lines;
}

function moneyFromNote(line) {
  const match = String(line).match(/₹([\d,]+\.\d{2})/);
  return match ? match[1].replace(/,/g, '') : null;
}

export function parseMetalBillNotes(notes) {
  const lines = String(notes || '').split('\n');
  const find = (prefix) => lines.find((line) => line.trim().startsWith(prefix)) || '';
  const adjustment = (prefix) => {
    const line = find(prefix);
    if (!line) return null;
    const pct = line.match(/(\d+(?:\.\d+)?)%/);
    const money = moneyFromNote(line);
    if (pct) return { mode: 'percentage', percent: pct[1], value: money || '0' };
    if (money) return { mode: 'value', percent: '0', value: money };
    return null;
  };
  const payable = find('Pricing:').match(/payable making\s+\d+(?:\.\d+)?%\s+\(₹([\d,]+\.\d{2})\)/);
  const stoneLine = find('Stone:');
  const stoneMoney = moneyFromNote(stoneLine);
  return {
    wastage: adjustment('Wastage:'),
    stone: stoneMoney,
    discount: adjustment('Bill discount:'),
    payableMaking: payable ? payable[1].replace(/,/g, '') : null,
  };
}

function resolveSchemePayNowAmount({
  schemeStatus,
  accumulatedGrams,
  gramsDifference,
  payableAfterSchemeCredit,
  closureDelta,
  schemeTotal,
  generalTotal,
  paidAmount,
  hasPurchaseQuote,
}) {
  if (isPrematureWithdrawal(schemeStatus)) {
    return hasPurchaseQuote ? Math.max(generalTotal - paidAmount, 0) : 0;
  }

  if (accumulatedGrams > 0 && gramsDifference > 0) {
    return payableAfterSchemeCredit;
  }

  if (schemeStatus === SCHEME_STATUSES.ACTIVE) {
    return Math.max(closureDelta, 0);
  }

  return schemeTotal;
}

export function computeMetalPurchasePricing({
  units = 0,
  price = 0,
  purchaseMode = 'general',
  schemeStatus = SCHEME_STATUSES.CLOSED,
  schemeActualMakingPct = 0,
  schemeGivenMakingPct = 0,
  schemeBenefitAmount = 0,
  schemeMonths = 0,
  schemeMonthlyAmount = 0,
  schemePaidMonths = 0,
  schemeAccumulatedGrams = 0,
  schemePurchasedGrams = 0,
  makingChargePct = 0,
  useMakingPercent = true,
  actualMakingValue = 0,
  payableMakingValue = 0,
  useGstSplit = true,
  gstInputMode = 'percentage',
  sgstPct = 0,
  cgstPct = 0,
  sgstValue = 0,
  cgstValue = 0,
  gstTotalValue = 0,
  prematurePenaltyPct = 0,
  useWastagePercent = true,
  wastagePct = 0,
  wastageValue = 0,
  stoneValue = 0,
  useDiscountPercent = true,
  discountPct = 0,
  discountValue = 0,
}) {
  const baseValue = round2(units * price);
  const manualBenefit = purchaseMode === 'scheme' ? round2(schemeBenefitAmount) : 0;
  const directPurchase = purchaseMode !== 'scheme';

  const actualMakingPctInput = purchaseMode === 'scheme'
    ? Number(schemeActualMakingPct || 0)
    : Number(makingChargePct || 0);
  const schemeMakingPctInput = purchaseMode === 'scheme'
    ? Number(schemeGivenMakingPct || 0)
    : Number(makingChargePct || 0);

  const actualMakingAmount = round2(useMakingPercent
    ? (baseValue * actualMakingPctInput) / 100
    : actualMakingValue);
  // A direct purchase has one making charge. Scheme purchases can pay a lower making charge.
  const payableMakingAmount = directPurchase
    ? actualMakingAmount
    : round2(useMakingPercent
      ? (baseValue * schemeMakingPctInput) / 100
      : payableMakingValue);
  const actualMakingPct = baseValue > 0 ? (actualMakingAmount / baseValue) * 100 : 0;
  const schemeMakingPct = baseValue > 0 ? (payableMakingAmount / baseValue) * 100 : 0;
  const makingDiscountPct = Math.max(actualMakingPct - schemeMakingPct, 0);
  const makingDiscountAmount = round2(Math.max(actualMakingAmount - payableMakingAmount, 0));

  const wastageAmount = round2(useWastagePercent
    ? (baseValue * nonNegative(wastagePct)) / 100
    : nonNegative(wastageValue));
  const wastagePctDerived = baseValue > 0 ? (wastageAmount / baseValue) * 100 : 0;
  const wastageGrams = Number(price) > 0 ? wastageAmount / Number(price) : 0;
  const stoneAmount = round2(nonNegative(stoneValue));

  const preTaxPayable = round2(baseValue + wastageAmount + payableMakingAmount + stoneAmount);
  const billDiscountAmount = discountOn(preTaxPayable, useDiscountPercent, discountPct, discountValue);
  const billDiscountPct = preTaxPayable > 0 ? (billDiscountAmount / preTaxPayable) * 100 : 0;
  const taxableValue = round2(Math.max(preTaxPayable - billDiscountAmount, 0));
  const sgstPctNum = Number(sgstPct || 0);
  const cgstPctNum = Number(cgstPct || 0);
  const sgstFromPct = round2((taxableValue * sgstPctNum) / 100);
  const cgstFromPct = round2((taxableValue * cgstPctNum) / 100);
  const sgstFromValue = round2(sgstValue);
  const cgstFromValue = round2(cgstValue);

  const sgstAmount = useGstSplit
    ? (gstInputMode === 'value' ? sgstFromValue : sgstFromPct)
    : 0;
  const cgstAmount = useGstSplit
    ? (gstInputMode === 'value' ? cgstFromValue : cgstFromPct)
    : 0;
  const totalGst = useGstSplit ? round2(sgstAmount + cgstAmount) : round2(gstTotalValue);
  const derivedSgstPct = taxableValue > 0 ? (sgstAmount / taxableValue) * 100 : 0;
  const derivedCgstPct = taxableValue > 0 ? (cgstAmount / taxableValue) * 100 : 0;
  const totalGstPct = useGstSplit
    ? (derivedSgstPct + derivedCgstPct)
    : (taxableValue > 0 ? (totalGst / taxableValue) * 100 : 0);

  const schemeTotal = round2(Math.max(taxableValue + totalGst - manualBenefit, 0));
  const invoiceCost = round2(taxableValue + totalGst);

  const generalMakingAmount = actualMakingAmount;
  const generalPreTax = round2(baseValue + wastageAmount + generalMakingAmount + stoneAmount);
  const generalDiscountAmount = discountOn(generalPreTax, useDiscountPercent, discountPct, discountValue);
  const generalDiscountPct = generalPreTax > 0 ? (generalDiscountAmount / generalPreTax) * 100 : 0;
  const generalTaxableValue = round2(Math.max(generalPreTax - generalDiscountAmount, 0));
  const generalGstFromPercent = round2(
    round2((generalTaxableValue * sgstPctNum) / 100) + round2((generalTaxableValue * cgstPctNum) / 100)
  );
  const generalGstAmount = generalTaxableValue === taxableValue
    ? totalGst
    : (useGstSplit && gstInputMode !== 'value'
      ? generalGstFromPercent
      : (taxableValue > 0 ? round2(totalGst * (generalTaxableValue / taxableValue)) : totalGst));
  const generalTotal = round2(generalTaxableValue + generalGstAmount);

  const totalSchemeMonths = Number(schemeMonths || 0);
  const monthlyScheme = Number(schemeMonthlyAmount || 0);
  const paidMonths = Number(schemePaidMonths || 0);
  const paidAmount = paidMonths * monthlyScheme;
  const expectedSchemeAmount = totalSchemeMonths * monthlyScheme;
  const remainingSchemeAmount = Math.max(expectedSchemeAmount - paidAmount, 0);
  const closureDelta = schemeTotal - paidAmount;
  const accumulatedGrams = Number(schemeAccumulatedGrams || 0);
  const purchasedGrams = Number(schemePurchasedGrams || units || 0);
  const gramsDifference = purchasedGrams - accumulatedGrams;
  const gramsBonusPct = accumulatedGrams > 0 ? (gramsDifference / accumulatedGrams) * 100 : 0;
  const schemePerGramPayable = purchasedGrams > 0 ? (schemeTotal / purchasedGrams) : 0;
  const extraGramPayableAmount = gramsDifference > 0 ? gramsDifference * schemePerGramPayable : 0;
  const schemeAccumulatedValue = accumulatedGrams > 0 ? accumulatedGrams * price : 0;
  const payableAfterSchemeCredit = Math.max(schemeTotal - schemeAccumulatedValue, 0);
  const hasPurchaseQuote = units > 0 && price > 0;
  const premature = isPrematureWithdrawal(schemeStatus);
  const penaltyPct = Number(prematurePenaltyPct || 0);
  const prematurePenaltyAmount = premature ? paidAmount * (penaltyPct / 100) : 0;
  const prematureCashRefund = premature ? Math.max(paidAmount - prematurePenaltyAmount, 0) : 0;
  const prematureBenefitForfeited = premature ? Math.max(generalTotal - schemeTotal, 0) : 0;
  const prematureGeneralSettlement = premature && hasPurchaseQuote
    ? Math.max(generalTotal - paidAmount, 0)
    : 0;

  const schemePayNowAmount = resolveSchemePayNowAmount({
    schemeStatus,
    accumulatedGrams,
    gramsDifference,
    payableAfterSchemeCredit,
    closureDelta,
    schemeTotal,
    generalTotal,
    paidAmount,
    hasPurchaseQuote,
  });
  const customerPayNowAmount = purchaseMode === 'scheme' ? schemePayNowAmount : generalTotal;

  return {
    units,
    price,
    baseValue,
    actualMakingPct,
    schemeMakingPct,
    actualMakingAmount,
    payableMakingAmount,
    makingDiscountPct,
    makingDiscountAmount,
    wastageAmount,
    wastagePct: wastagePctDerived,
    wastageGrams,
    wastageFromPercent: !!useWastagePercent,
    stoneAmount,
    billDiscountAmount,
    billDiscountPct,
    discountFromPercent: !!useDiscountPercent,
    generalDiscountAmount,
    generalDiscountPct,
    manualBenefit,
    totalDiscountAmount: makingDiscountAmount + manualBenefit,
    taxableValue,
    invoiceCost,
    sgstAmount,
    cgstAmount,
    derivedSgstPct,
    derivedCgstPct,
    totalGst,
    totalGstPct,
    generalMakingAmount,
    generalGstAmount,
    generalTotal,
    schemeTotal,
    comparisonDifference: generalTotal - schemeTotal,
    totalSchemeMonths,
    monthlyScheme,
    paidMonths,
    paidAmount,
    expectedSchemeAmount,
    remainingSchemeAmount,
    closureDelta,
    accumulatedGrams,
    purchasedGrams,
    gramsDifference,
    gramsBonusPct,
    schemePerGramPayable,
    extraGramPayableAmount,
    schemeAccumulatedValue,
    payableAfterSchemeCredit,
    schemePayNowAmount,
    customerPayNowAmount,
    isPrematureWithdrawal: premature,
    prematurePenaltyPct: penaltyPct,
    prematurePenaltyAmount,
    prematureCashRefund,
    prematureBenefitForfeited,
    prematureGeneralSettlement,
    hasPurchaseQuote,
  };
}
