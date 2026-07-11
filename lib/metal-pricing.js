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
}) {
  const baseValue = units * price;
  const manualBenefit = purchaseMode === 'scheme' ? Number(schemeBenefitAmount || 0) : 0;

  const actualMakingPctInput = purchaseMode === 'scheme'
    ? Number(schemeActualMakingPct || 0)
    : Number(makingChargePct || 0);
  const schemeMakingPctInput = purchaseMode === 'scheme'
    ? Number(schemeGivenMakingPct || 0)
    : Number(makingChargePct || 0);

  const actualMakingAmount = useMakingPercent
    ? (baseValue * actualMakingPctInput) / 100
    : Number(actualMakingValue || 0);
  const payableMakingAmount = useMakingPercent
    ? (baseValue * schemeMakingPctInput) / 100
    : Number(payableMakingValue || 0);
  const actualMakingPct = baseValue > 0 ? (actualMakingAmount / baseValue) * 100 : 0;
  const schemeMakingPct = baseValue > 0 ? (payableMakingAmount / baseValue) * 100 : 0;
  const makingDiscountPct = Math.max(actualMakingPct - schemeMakingPct, 0);
  const makingDiscountAmount = Math.max(actualMakingAmount - payableMakingAmount, 0);

  const taxableValue = baseValue + payableMakingAmount;
  const sgstPctNum = Number(sgstPct || 0);
  const cgstPctNum = Number(cgstPct || 0);
  const sgstFromPct = (taxableValue * sgstPctNum) / 100;
  const cgstFromPct = (taxableValue * cgstPctNum) / 100;
  const sgstFromValue = Number(sgstValue || 0);
  const cgstFromValue = Number(cgstValue || 0);

  const sgstAmount = useGstSplit
    ? (gstInputMode === 'value' ? sgstFromValue : sgstFromPct)
    : 0;
  const cgstAmount = useGstSplit
    ? (gstInputMode === 'value' ? cgstFromValue : cgstFromPct)
    : 0;
  const totalGst = useGstSplit ? (sgstAmount + cgstAmount) : Number(gstTotalValue || 0);
  const derivedSgstPct = taxableValue > 0 ? (sgstAmount / taxableValue) * 100 : 0;
  const derivedCgstPct = taxableValue > 0 ? (cgstAmount / taxableValue) * 100 : 0;
  const totalGstPct = useGstSplit
    ? (derivedSgstPct + derivedCgstPct)
    : (taxableValue > 0 ? (totalGst / taxableValue) * 100 : 0);

  const schemeTotal = Math.max(baseValue + payableMakingAmount + totalGst - manualBenefit, 0);

  const generalMakingAmount = actualMakingAmount;
  const generalTaxableValue = baseValue + generalMakingAmount;
  const generalGstAmount = (generalTaxableValue * totalGstPct) / 100;
  const generalTotal = generalTaxableValue + generalGstAmount;

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
    manualBenefit,
    totalDiscountAmount: makingDiscountAmount + manualBenefit,
    taxableValue,
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
