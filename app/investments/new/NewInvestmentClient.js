'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, inrPaise, fmtDate, addMonths, computeMaturity, computeRecurringMaturity } from '@/lib/format';
import MetalInvoiceDetails from '@/components/MetalInvoiceDetails';
import { isLiquiditySaving, isMarketInvestment, isMetalInvestment } from '@/lib/investments';
import { emptyCustomMonths, isChitInvestment, normalizeChitDetails, prepareChitForSave } from '@/lib/chit';
import ChitFundFields from './ChitFundFields';
import {
  SCHEME_STATUS_OPTIONS,
  computeMetalPurchasePricing,
  isPrematureWithdrawal,
  schemeNeedsTracking,
  validateSchemeTracking,
} from '@/lib/metal-pricing';
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  documentBadge,
  isAllowedDocumentName,
} from '@/lib/documents';

const TYPES = ['FD', 'RD', 'MF', 'ETF', 'ST', 'GD', 'GOLD', 'SILV', 'PPF', 'CHIT', 'OT'];
const PRESET_TYPES = ['Crypto', 'Real Estate', 'NSC', 'Sukanya Samriddhi', 'Lent to family'];

const TYPE_CHIP_LABEL = { FD: 'FD', RD: 'RD', MF: 'MF', ETF: 'ETF', ST: 'Shares', GD: 'GD', GOLD: 'Gold', SILV: 'Silver', PPF: 'PPF', CHIT: 'Chit', OT: 'Other' };
const TYPE_TOOLTIP = {
  FD: 'Fixed Deposit — guaranteed returns at a fixed interest rate (banks / NBFCs)',
  RD: 'Recurring Deposit — fixed monthly deposits that earn compound interest over a chosen tenure',
  MF: 'Mutual Fund — create a holding and track every buy, SIP, redeem, and dividend',
  ETF: 'ETF — track exchange-traded fund units with repeated buys and redemptions',
  ST: 'Shares — direct equity holdings with multiple buy and sell transactions',
  GD: 'Gold / SGB — physical gold, digital gold, or Sovereign Gold Bonds',
  GOLD: 'Physical Gold — track gold purchases by weight (grams). Record who it was bought for, purchase price per gram, making charges, and set a target weight.',
  SILV: 'Physical Silver — track silver purchases by weight (grams). Record who it was bought for, purchase price per gram, and set a target weight.',
  PPF: 'Public Provident Fund — 15-year government-backed tax-free savings (yearly contributions)',
  CHIT: 'Chit Fund — monthly instalments with a pick month. Compare payout, total paid, profit/loss, and effective interest rate.',
  OT: 'Other — crypto, real estate, NSC, or any custom investment type',
};

const PERIODIC_TYPES = { RD: 'monthly', PPF: 'yearly', CHIT: 'monthly' };

const TENURE_PRESETS = [
  { label: '3 mo', months: 3 },
  { label: '6 mo', months: 6 },
  { label: '12 mo', months: 12 },
  { label: '2 yr', months: 24 },
];
const PPF_TENURE_PRESETS = [
  { label: '15 yr', months: 180 },
  { label: '20 yr', months: 240 },
  { label: '25 yr', months: 300 },
];
const CUSTOM_TENURE_MODE = -1;

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}

function getInitialTenureMode(initialInvestment, typeCode) {
  if (!initialInvestment) return typeCode === 'PPF' ? 180 : 12;
  const presets = typeCode === 'PPF' ? PPF_TENURE_PRESETS : TENURE_PRESETS;
  const matchedPreset = Number(initialInvestment.tenure_days) === 0
    ? presets.find((preset) => preset.months === Number(initialInvestment.tenure_months))
    : null;
  return matchedPreset ? matchedPreset.months : CUSTOM_TENURE_MODE;
}

function getInitialCustomTenure(initialInvestment) {
  if (!initialInvestment) return { years: 0, months: 9, days: 0 };
  return {
    years: Math.floor(Number(initialInvestment.tenure_months || 0) / 12),
    months: Number(initialInvestment.tenure_months || 0) % 12,
    days: Number(initialInvestment.tenure_days || 0),
  };
}

function getInitialChitState(initialInvestment) {
  const tenure = Math.max(1, Math.floor(Number(initialInvestment?.tenure_months) || 12));
  const raw = initialInvestment?.chit_details;
  if (!raw) {
    return {
      mode: 'dual_rate',
      chitValue: '',
      prePickAmount: '',
      postPickAmount: '',
      payouts: Array.from({ length: tenure }, () => ''),
      customMonths: emptyCustomMonths(tenure).map(() => ({ payment: '', payout: '' })),
      pickMonth: 1,
    };
  }
  const details = normalizeChitDetails(raw, tenure);
  return {
    mode: details.mode,
    chitValue: details.chit_value ? String(details.chit_value) : '',
    prePickAmount: details.pre_pick_amount ? String(details.pre_pick_amount) : '',
    postPickAmount: details.post_pick_amount ? String(details.post_pick_amount) : '',
    payouts: Array.from({ length: tenure }, (_, i) => (details.payouts?.[i] ? String(details.payouts[i]) : '')),
    customMonths: Array.from({ length: tenure }, (_, i) => ({
      payment: details.months?.[i]?.payment ? String(details.months[i].payment) : '',
      payout: details.months?.[i]?.payout ? String(details.months[i].payout) : '',
    })),
    pickMonth: details.pick_month || 1,
  };
}

function dateInputValue(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

export default function NewInvestmentClient({
  user,
  goals,
  mode = 'create',
  initialInvestment = null,
  initialDocuments = [],
}) {
  const router = useRouter();
  const isEditing = mode === 'edit';
  const initialCustomTenure = getInitialCustomTenure(initialInvestment);
  const initialChit = getInitialChitState(initialInvestment);
  const [startDateInput, setStartDateInput] = useState(
    dateInputValue(initialInvestment?.start_date) || new Date().toISOString().slice(0, 10)
  );
  const startDate = useMemo(() => new Date(startDateInput), [startDateInput]);

  const [typeCode, setTypeCode] = useState(initialInvestment?.type_code || 'FD');
  const [customType, setCustomType] = useState(initialInvestment?.custom_type || '');
  const [bank, setBank] = useState(initialInvestment?.bank || '');
  const [planName, setPlanName] = useState(initialInvestment?.plan_name || '');
  const [tenureMode, setTenureMode] = useState(getInitialTenureMode(initialInvestment, initialInvestment?.type_code || 'FD'));
  const [customY, setCustomY] = useState(initialCustomTenure.years);
  const [customM, setCustomM] = useState(initialCustomTenure.months);
  const [customD, setCustomD] = useState(initialCustomTenure.days);
  const [amount, setAmount] = useState(initialInvestment ? String(initialInvestment.amount) : '');
  const [ratePct, setRatePct] = useState(initialInvestment ? String(initialInvestment.rate_pct) : '');
  const [compounding, setCompounding] = useState(initialInvestment?.compounding || 'quarterly');
  const [paymentFrequency, setPaymentFrequency] = useState(initialInvestment?.payment_frequency || PERIODIC_TYPES[initialInvestment?.type_code] || 'lump_sum');
  const [goalId, setGoalId] = useState(initialInvestment?.goal_id || goals[0]?.id || '');
  const [nominee, setNominee] = useState(initialInvestment?.nominee || '');
  const [accountHolder, setAccountHolder] = useState(initialInvestment?.account_holder || 'Self');
  const [autoRenew, setAutoRenew] = useState(initialInvestment ? !!initialInvestment.auto_renew : true);
  const [forLiquidity, setForLiquidity] = useState(isLiquiditySaving(initialInvestment));
  const [docs, setDocs] = useState(initialDocuments.map((doc) => ({ ...doc, size_bytes: Number(doc.size_bytes || 0), page_count: Number(doc.page_count || 1) })));
  const [chitMode, setChitMode] = useState(initialChit.mode);
  const [chitValue, setChitValue] = useState(initialChit.chitValue);
  const [prePickAmount, setPrePickAmount] = useState(initialChit.prePickAmount);
  const [postPickAmount, setPostPickAmount] = useState(initialChit.postPickAmount);
  const [chitPayouts, setChitPayouts] = useState(initialChit.payouts);
  const [chitCustomMonths, setChitCustomMonths] = useState(initialChit.customMonths);
  const [chitPickMonth, setChitPickMonth] = useState(initialChit.pickMonth);
  const [initialUnits, setInitialUnits] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [initialCharges, setInitialCharges] = useState('0');
  const [initialTaxes, setInitialTaxes] = useState('0');
  const [makingChargePct, setMakingChargePct] = useState('0');
  const [useMakingPercent, setUseMakingPercent] = useState(true);
  const [actualMakingValue, setActualMakingValue] = useState('0');
  const [payableMakingValue, setPayableMakingValue] = useState('0');
  const [gstInputMode, setGstInputMode] = useState('percentage');
  const [useGstSplit, setUseGstSplit] = useState(true);
  const [sgstPct, setSgstPct] = useState('1.5');
  const [cgstPct, setCgstPct] = useState('1.5');
  const [sgstValue, setSgstValue] = useState('0');
  const [cgstValue, setCgstValue] = useState('0');
  const [gstTotalValue, setGstTotalValue] = useState('0');
  const [autoCalcCharges, setAutoCalcCharges] = useState(true);
  const [acquisitionFlow, setAcquisitionFlow] = useState('purchase_now');
  const [purchaseMode, setPurchaseMode] = useState('general');
  const [schemeActualMakingPct, setSchemeActualMakingPct] = useState('12');
  const [schemeGivenMakingPct, setSchemeGivenMakingPct] = useState('8');
  const [schemeBenefitAmount, setSchemeBenefitAmount] = useState('0');
  const [schemeStatus, setSchemeStatus] = useState('closed');
  const [schemeMonths, setSchemeMonths] = useState('11');
  const [schemeMonthlyAmount, setSchemeMonthlyAmount] = useState('0');
  const [schemePaidMonths, setSchemePaidMonths] = useState('0');
  const [schemeAccumulatedGrams, setSchemeAccumulatedGrams] = useState('');
  const [schemePurchasedGrams, setSchemePurchasedGrams] = useState('');
  const [prematurePenaltyPct, setPrematurePenaltyPct] = useState('0');
  const [initialNotes, setInitialNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);

  const isMarketType = isMarketInvestment(typeCode);
  const isMetalType = isMetalInvestment(typeCode);
  const isChitType = isChitInvestment(typeCode);
  const isTransactionType = isMarketType || isMetalType;
  const schemeReadyForPurchase = Number(schemeMonths || 0) > 0 && Number(schemePaidMonths || 0) >= Number(schemeMonths || 0);
  const schemeAllowsPurchaseEntry = acquisitionFlow === 'purchase_now' || schemeReadyForPurchase || isPrematureWithdrawal(schemeStatus);

  useEffect(() => {
    if (isMetalType && (acquisitionFlow === 'scheme_monthly' || isPrematureWithdrawal(schemeStatus))) {
      setPurchaseMode('scheme');
    }
  }, [acquisitionFlow, isMetalType, schemeStatus]);

  const handleTypeChange = (t) => {
    setTypeCode(t);
    setPaymentFrequency(PERIODIC_TYPES[t] || 'lump_sum');
    if (t === 'PPF') setTenureMode(180);
    else if (t === 'CHIT') setTenureMode(12);
    else if (tenureMode === 180 || tenureMode === 240 || tenureMode === 300) setTenureMode(12);
  };

  const effectiveFrequency = PERIODIC_TYPES[typeCode] || paymentFrequency;
  const tenurePresets = typeCode === 'PPF' ? PPF_TENURE_PRESETS : TENURE_PRESETS;

  const totalMonths = useMemo(() => {
    if (tenureMode === CUSTOM_TENURE_MODE) return Number(customY) * 12 + Number(customM) + Number(customD) / 30;
    return Number(tenureMode);
  }, [tenureMode, customY, customM, customD]);

  const chitTenureMonths = Math.max(1, Math.floor(totalMonths) || 12);

  useEffect(() => {
    if (!isChitType) return;
    setChitPayouts((prev) => Array.from({ length: chitTenureMonths }, (_, i) => prev[i] ?? ''));
    setChitCustomMonths((prev) => Array.from({ length: chitTenureMonths }, (_, i) => prev[i] || { payment: '', payout: '' }));
    setChitPickMonth((prev) => Math.min(chitTenureMonths, Math.max(1, Number(prev) || 1)));
  }, [isChitType, chitTenureMonths]);

  const calc = useMemo(() => {
    if (isMarketType || isChitType) return null;
    const a = Number(amount) || 0;
    const r = Number(ratePct) || 0;
    if (!a || !r || !totalMonths) return null;

    let matVal;
    let totalInvested;
    if (effectiveFrequency === 'monthly') {
      matVal = computeRecurringMaturity({ amountPerPeriod: a, ratePct: r, months: totalMonths, paymentFrequency: 'monthly' });
      totalInvested = a * Math.floor(totalMonths);
    } else if (effectiveFrequency === 'yearly') {
      matVal = computeRecurringMaturity({ amountPerPeriod: a, ratePct: r, months: totalMonths, paymentFrequency: 'yearly' });
      totalInvested = a * Math.floor(totalMonths / 12);
    } else {
      matVal = computeMaturity({ amount: a, ratePct: r, months: totalMonths, compounding });
      totalInvested = a;
    }

    return {
      matVal,
      interest: matVal - totalInvested,
      totalInvested,
      monthlyInt: (a * r) / 100 / 12,
      monthlyPct: r / 12,
      matDate: addMonths(startDate, totalMonths),
    };
  }, [amount, ratePct, totalMonths, compounding, effectiveFrequency, startDate, isMarketType, isChitType]);

  const marketPreview = useMemo(() => {
    if (!isTransactionType) return null;
    const units = Number(initialUnits || 0);
    const price = Number(initialPrice || 0);
    const charges = Number(initialCharges || 0);
    const taxes = Number(initialTaxes || 0);
    const gross = units * price;
    const total = gross + charges + taxes;
    return { units, price, charges, taxes, gross, total };
  }, [initialCharges, initialPrice, initialTaxes, initialUnits, isTransactionType]);

  const metalPricing = useMemo(() => {
    if (!isMetalType) return null;

    return computeMetalPurchasePricing({
      units: Number(initialUnits || 0),
      price: Number(initialPrice || 0),
      purchaseMode,
      schemeStatus,
      schemeActualMakingPct,
      schemeGivenMakingPct,
      schemeBenefitAmount,
      schemeMonths,
      schemeMonthlyAmount,
      schemePaidMonths,
      schemeAccumulatedGrams,
      schemePurchasedGrams,
      makingChargePct,
      useMakingPercent,
      actualMakingValue,
      payableMakingValue,
      useGstSplit,
      gstInputMode,
      sgstPct,
      cgstPct,
      sgstValue,
      cgstValue,
      gstTotalValue,
      prematurePenaltyPct,
    });
  }, [
    actualMakingValue,
    cgstPct,
    cgstValue,
    gstInputMode,
    gstTotalValue,
    initialPrice,
    initialUnits,
    isMetalType,
    makingChargePct,
    payableMakingValue,
    prematurePenaltyPct,
    purchaseMode,
    sgstPct,
    sgstValue,
    schemeActualMakingPct,
    schemeAccumulatedGrams,
    schemeBenefitAmount,
    schemeGivenMakingPct,
    schemeMonths,
    schemeMonthlyAmount,
    schemePurchasedGrams,
    schemePaidMonths,
    schemeStatus,
    useGstSplit,
    useMakingPercent,
  ]);

  useEffect(() => {
    if (!isMetalType || !autoCalcCharges || !metalPricing) return;

    setInitialCharges(metalPricing.payableMakingAmount.toFixed(2));
    setInitialTaxes(metalPricing.totalGst.toFixed(2));
    if (useGstSplit) setGstTotalValue(metalPricing.totalGst.toFixed(2));
  }, [autoCalcCharges, isMetalType, metalPricing, purchaseMode, useGstSplit]);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const errors = [];
    const nextDocs = [];
    for (const file of files) {
      if (!isAllowedDocumentName(file.name)) {
        errors.push(`${file.name} is not supported. Use PDF, PNG, JPG, DOCX, XLSX, or CSV.`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        errors.push(`${file.name} is too large (max 5 MB).`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        nextDocs.push({ filename: file.name, size_bytes: file.size, data_url: dataUrl, page_count: 1 });
      } catch {
        errors.push(`Could not read ${file.name}.`);
      }
    }
    if (nextDocs.length) setDocs((current) => [...current, ...nextDocs]);
    setError(errors.join(' '));
  };

  const onUpload = async (e) => {
    await addFiles(e.target.files);
    e.target.value = '';
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    await addFiles(e.dataTransfer?.files);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const removeDoc = (idx) => setDocs((d) => d.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (typeCode === 'OT' && !customType.trim()) { setError('Name your custom investment type.'); return; }
    if (!bank.trim()) { setError('Bank or platform is required.'); return; }
    if (!planName.trim()) { setError('Plan name is required.'); return; }
    if (!goalId) { setError('Link this investment to a goal. Create one first if you have none.'); return; }
    if (!nominee.trim()) { setError('Nominee is required.'); return; }

    let initialTransaction = null;
    if (isTransactionType) {
      if (isMetalType && acquisitionFlow === 'scheme_monthly') {
        const schemeTrackingError = validateSchemeTracking({
          schemeStatus,
          schemeMonths,
          schemeMonthlyAmount,
          schemePaidMonths,
        });
        if (schemeTrackingError) { setError(schemeTrackingError); return; }
        if (isPrematureWithdrawal(schemeStatus) && Number(prematurePenaltyPct || 0) < 0) {
          setError('Premature withdrawal penalty % cannot be negative.');
          return;
        }
      }

      const deferPurchaseForScheme = isMetalType && acquisitionFlow === 'scheme_monthly' && !schemeReadyForPurchase && !isPrematureWithdrawal(schemeStatus);
      const hasAnyInitialInput = !deferPurchaseForScheme && ([initialUnits, initialPrice, initialNotes].some((value) => String(value || '').trim() !== '')
        || Number(initialCharges || 0) > 0
        || Number(initialTaxes || 0) > 0);
      if (hasAnyInitialInput) {
        const units = Number(initialUnits || 0);
        const price = Number(initialPrice || 0);
        const charges = isMetalType && metalPricing ? metalPricing.payableMakingAmount : Number(initialCharges || 0);
        const taxes = isMetalType && metalPricing ? metalPricing.totalGst : Number(initialTaxes || 0);
        if (isMetalType) {
          if (useMakingPercent) {
            if (Number(makingChargePct || 0) < 0) { setError('Making charge % cannot be negative.'); return; }
          } else if (Number(actualMakingValue || 0) < 0 || Number(payableMakingValue || 0) < 0) {
            setError('Making charge values cannot be negative.');
            return;
          }

          if (useGstSplit) {
            if (gstInputMode === 'percentage' && (Number(sgstPct || 0) < 0 || Number(cgstPct || 0) < 0)) {
              setError('SGST/CGST % cannot be negative.');
              return;
            }
            if (gstInputMode === 'value' && (Number(sgstValue || 0) < 0 || Number(cgstValue || 0) < 0)) {
              setError('SGST/CGST values cannot be negative.');
              return;
            }
          } else if (Number(gstTotalValue || 0) < 0) {
            setError('GST total cannot be negative.');
            return;
          }
        }
        if (isMetalType && purchaseMode === 'scheme') {
          if (Number(schemeActualMakingPct || 0) < 0 || Number(schemeGivenMakingPct || 0) < 0) {
            setError('Scheme making charge % values cannot be negative.');
            return;
          }
          if (Number(schemeBenefitAmount || 0) < 0) {
            setError('Scheme benefit amount cannot be negative.');
            return;
          }
          if (Number(schemeAccumulatedGrams || 0) < 0 || Number(schemePurchasedGrams || 0) < 0) {
            setError('Scheme accumulated/purchased grams cannot be negative.');
            return;
          }
          const schemeTrackingError = validateSchemeTracking({
            schemeStatus,
            schemeMonths,
            schemeMonthlyAmount,
            schemePaidMonths,
          });
          if (schemeTrackingError) { setError(schemeTrackingError); return; }
          if (isPrematureWithdrawal(schemeStatus) && Number(prematurePenaltyPct || 0) < 0) {
            setError('Premature withdrawal penalty % cannot be negative.');
            return;
          }
        }
        if (units <= 0) { setError(isMetalType ? 'Weight (grams) must be greater than zero.' : 'Initial buy units must be greater than zero.'); return; }
        if (price <= 0) { setError(isMetalType ? 'Purchase price per gram must be greater than zero.' : 'Initial buy price must be greater than zero.'); return; }
        if (charges < 0 || taxes < 0) { setError('Charges cannot be negative.'); return; }

        const notesLines = [];
        if (initialNotes.trim()) notesLines.push(initialNotes.trim());
        if (isMetalType) {
          if (metalPricing) {
            notesLines.push(
              `Pricing: actual making ${metalPricing.actualMakingPct.toFixed(2)}% (${inrPaise(metalPricing.actualMakingAmount)}), payable making ${metalPricing.schemeMakingPct.toFixed(2)}% (${inrPaise(metalPricing.payableMakingAmount)})`
            );
            notesLines.push(
              `Discount: making ${metalPricing.makingDiscountPct.toFixed(2)}% (${inrPaise(metalPricing.makingDiscountAmount)}), scheme benefit ${inrPaise(metalPricing.manualBenefit)}, total discount ${inrPaise(metalPricing.totalDiscountAmount)}`
            );
            notesLines.push(
              `GST: SGST ${metalPricing.derivedSgstPct.toFixed(2)}% (${inrPaise(metalPricing.sgstAmount)}), CGST ${metalPricing.derivedCgstPct.toFixed(2)}% (${inrPaise(metalPricing.cgstAmount)}), total ${metalPricing.totalGstPct.toFixed(2)}% (${inrPaise(metalPricing.totalGst)})`
            );
            notesLines.push(
              `Bill compare: general ${inrPaise(metalPricing.generalTotal)} vs current ${inrPaise(metalPricing.schemeTotal)} (${metalPricing.comparisonDifference >= 0 ? 'saving' : 'loss'} ${inr(Math.abs(metalPricing.comparisonDifference))})`
            );
          }
          if (purchaseMode === 'scheme' && metalPricing) {
            notesLines.push(
              `Scheme making input: actual ${Number(schemeActualMakingPct || 0).toFixed(2)}%, offered ${Number(schemeGivenMakingPct || 0).toFixed(2)}%`
            );
            if (schemeNeedsTracking(schemeStatus)) {
              notesLines.push(
                `Scheme tracking: ${Number(schemePaidMonths || 0)}/${Number(schemeMonths || 0)} months, monthly ${inr(Number(schemeMonthlyAmount || 0))}, paid ${inrPaise(metalPricing.paidAmount)}, remaining ${inrPaise(metalPricing.remainingSchemeAmount)}`
              );
            }
            if (metalPricing.isPrematureWithdrawal) {
              notesLines.push(
                `Premature withdrawal: penalty ${Number(prematurePenaltyPct || 0).toFixed(2)}% (${inrPaise(metalPricing.prematurePenaltyAmount)}), cash refund ${inrPaise(metalPricing.prematureCashRefund)}, benefit forfeited ${inrPaise(metalPricing.prematureBenefitForfeited)}`
              );
              if (metalPricing.hasPurchaseQuote) {
                notesLines.push(
                  `Premature gold settlement at general rates: ${inrPaise(metalPricing.prematureGeneralSettlement)} payable after ${inrPaise(metalPricing.paidAmount)} scheme credit`
                );
              }
            }
            notesLines.push(
              `Scheme grams: accumulated ${metalPricing.accumulatedGrams.toFixed(3)}g, purchased ${metalPricing.purchasedGrams.toFixed(3)}g, difference ${metalPricing.gramsDifference >= 0 ? '+' : ''}${metalPricing.gramsDifference.toFixed(3)}g (${metalPricing.gramsBonusPct >= 0 ? '+' : ''}${metalPricing.gramsBonusPct.toFixed(2)}%)`
            );
            notesLines.push(`Scheme grams payable amount: ${inrPaise(metalPricing.extraGramPayableAmount || 0)}`);
          }
        }

        initialTransaction = {
          transaction_type: 'buy',
          trade_date: startDateInput,
          units,
          price_per_unit: price,
          total_amount: units * price,
          charges,
          taxes,
          notes: notesLines.length ? notesLines.join('\n') : null,
        };
      }
    } else if (isChitType) {
      if (!totalMonths || totalMonths <= 0) { setError('Pick a valid tenure.'); return; }
      const prepared = prepareChitForSave({
        mode: chitMode,
        chit_value: Number(chitValue) || 0,
        pre_pick_amount: Number(prePickAmount) || 0,
        post_pick_amount: Number(postPickAmount) || 0,
        payouts: chitPayouts.map((v) => Number(v) || 0),
        months: chitCustomMonths.map((row) => ({
          payment: Number(row.payment) || 0,
          payout: Number(row.payout) || 0,
        })),
        pick_month: Number(chitPickMonth) || 1,
      }, Math.floor(totalMonths));
      if (prepared.error) { setError(prepared.error); return; }
    } else {
      if (!totalMonths || totalMonths <= 0) { setError('Pick a valid tenure.'); return; }
      if (!amount || Number(amount) <= 0) { setError('Amount must be greater than zero.'); return; }
      if (!ratePct || Number(ratePct) <= 0) { setError('Interest rate is required.'); return; }
    }

    setSaving(true);
    try {
      let body;
      if (isTransactionType) {
        body = {
          type_code: typeCode,
          custom_type: typeCode === 'OT' ? customType.trim() : null,
          bank: bank.trim(),
          plan_name: planName.trim(),
          goal_id: goalId,
          nominee: nominee.trim(),
          account_holder: accountHolder.trim() || 'Self',
          for_liquidity: forLiquidity,
          start_date: startDateInput,
          documents: docs,
          initial_transaction: !isEditing ? initialTransaction : null,
        };
      } else if (isChitType) {
        const prepared = prepareChitForSave({
          mode: chitMode,
          chit_value: Number(chitValue) || 0,
          pre_pick_amount: Number(prePickAmount) || 0,
          post_pick_amount: Number(postPickAmount) || 0,
          payouts: chitPayouts.map((v) => Number(v) || 0),
          months: chitCustomMonths.map((row) => ({
            payment: Number(row.payment) || 0,
            payout: Number(row.payout) || 0,
          })),
          pick_month: Number(chitPickMonth) || 1,
        }, Math.floor(totalMonths));
        body = {
          type_code: 'CHIT',
          custom_type: null,
          bank: bank.trim(),
          plan_name: planName.trim(),
          amount: prepared.amount,
          rate_pct: prepared.rate_pct,
          tenure_months: Math.floor(totalMonths),
          tenure_days: 0,
          compounding: 'simple',
          payment_frequency: 'monthly',
          chit_details: prepared.details,
          goal_id: goalId,
          nominee: nominee.trim(),
          account_holder: accountHolder.trim() || 'Self',
          for_liquidity: forLiquidity,
          auto_renew: false,
          start_date: startDateInput,
          documents: docs,
        };
      } else {
        body = {
            type_code: typeCode,
            custom_type: typeCode === 'OT' ? customType.trim() : null,
            bank: bank.trim(),
            plan_name: planName.trim(),
            amount: Number(amount),
            rate_pct: Number(ratePct),
            tenure_months: Math.floor(totalMonths),
            tenure_days: Math.round((totalMonths - Math.floor(totalMonths)) * 30),
            compounding,
            payment_frequency: effectiveFrequency,
            goal_id: goalId,
            nominee: nominee.trim(),
            account_holder: accountHolder.trim() || 'Self',
            for_liquidity: forLiquidity,
            auto_renew: autoRenew,
            start_date: startDateInput,
            documents: docs,
          };
      }

      const res = await fetch(isEditing ? `/api/investments/${initialInvestment.id}` : '/api/investments', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      router.push(isEditing ? `/investments/${initialInvestment.id}` : '/investments');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const amountLabel = effectiveFrequency === 'monthly' ? 'Monthly contribution (₹)' : effectiveFrequency === 'yearly' ? 'Yearly contribution (₹)' : 'Amount (₹)';
  const amountPlaceholder = effectiveFrequency === 'monthly' ? '5000' : effectiveFrequency === 'yearly' ? '150000' : '300000';

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-2xl mx-auto w-full">
        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Cancel</button>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-1">{isEditing ? 'Edit investment' : 'Add investment'}</h1>
        <p className="text-sm text-ink-soft mb-6">{isEditing ? 'Update the details below.' : 'All fields are required unless marked optional.'}</p>

        <form onSubmit={submit} className="space-y-5">
          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Type<span className="text-danger ml-0.5">*</span></p>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <div key={t} className="relative group">
                  <button type="button" onClick={() => handleTypeChange(t)} className={`chip w-full ${typeCode === t ? 'on' : ''}`}>
                    {TYPE_CHIP_LABEL[t]}
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-ink px-3 py-2 text-[11px] leading-snug text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-20 shadow-lg">
                    {TYPE_TOOLTIP[t]}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
                  </div>
                </div>
              ))}
            </div>
            {typeCode === 'OT' && (
              <div className="mt-3 p-3 bg-paper-tint rounded-xl">
                <label className="block text-xs text-ink-soft mb-1.5">Type name<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder="e.g. Crypto, NSC..." value={customType} onChange={(e) => setCustomType(e.target.value)} className="field-input" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_TYPES.map((p) => (
                    <button key={p} type="button" onClick={() => setCustomType(p)} className="text-[11px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-mint-600">{p}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Purpose</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForLiquidity(false)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${!forLiquidity ? 'border-mint-600 bg-mint-50' : 'border-edge bg-paper-card hover:border-mint-600'}`}
              >
                <p className="text-sm font-medium">Investment</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Money held to grow.</p>
              </button>
              <button
                type="button"
                onClick={() => setForLiquidity(true)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${forLiquidity ? 'border-sky-600 bg-sky-50' : 'border-edge bg-paper-card hover:border-sky-600'}`}
              >
                <p className="text-sm font-medium">Saving for liquidity</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Cash you keep available. Shown apart from growth holdings.</p>
              </button>
            </div>
          </section>

          {(typeCode === 'RD' || typeCode === 'PPF') && (
            <div className="flex items-start gap-2.5 p-3 bg-paper-tint rounded-xl text-sm">
              <span className="text-lg leading-none mt-0.5">{typeCode === 'RD' ? '🔁' : '📅'}</span>
              <div>
                <p className="font-medium">{typeCode === 'RD' ? 'Monthly contributions' : 'Yearly contributions'}</p>
                <p className="text-[11px] text-ink-soft mt-0.5">
                  {typeCode === 'RD'
                    ? 'Enter your fixed monthly deposit amount. Maturity is calculated using compound interest on each instalment.'
                    : 'Enter your yearly deposit amount (max ₹1.5 L/yr). Maturity uses the PPF annuity formula.'}
                </p>
              </div>
            </div>
          )}

          {isMarketType && (
            <div className="rounded-xl border border-edge bg-paper-tint p-3.5 text-sm">
              <p className="font-medium">Transaction-based holding</p>
              <p className="text-[11px] text-ink-soft mt-1">
                {isEditing
                  ? 'Update holding details here. Use the detail page to add buys, redemptions, dividends, and other transactions.'
                  : 'Create the holding once, then keep adding buys, SIPs, redemptions, and dividends from the detail page.'}
              </p>
            </div>
          )}

          {isMetalType && (
            <div className="rounded-xl border border-honey-600/30 bg-honey-50 p-3.5 text-sm">
              <p className="font-medium text-honey-700">{typeCode === 'GOLD' ? '🥇 Physical Gold accumulation' : '🥈 Physical Silver accumulation'}</p>
              <p className="text-[11px] text-honey-700/80 mt-1">
                Track each purchase by weight (grams). Record who it was bought for, purchase price per gram, and making charges / GST.
                {isEditing ? ' Use the detail page to add more purchases.' : ' You can add more purchases from the detail page.'}
              </p>
            </div>
          )}

          {isChitType && (
            <div className="rounded-xl border border-plum-600/20 bg-plum-50 p-3.5 text-sm">
              <p className="font-medium text-plum-600">Chit fund</p>
              <p className="text-[11px] text-ink-soft mt-1">
                Track dual-rate or custom monthly instalments, choose your pick month, and see profit/loss plus effective interest before you save.
              </p>
            </div>
          )}

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Plan details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Store / jeweller / source' : (isChitType ? 'Organizer / company' : 'Bank / platform')}<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder={isMetalType ? 'e.g. Tanishq, Malabar, Family' : (isChitType ? 'e.g. Local chit, ABC Finance…' : 'HDFC Bank, Groww, Zerodha…')} value={bank} onChange={(e) => setBank(e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Item description' : 'Plan name'}<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder={isMetalType ? (typeCode === 'GOLD' ? '22K Gold Bangle, Gold Coin 10g…' : 'Silver Bar 100g, Silver Anklets…') : (isMarketType ? 'Nifty ETF / SIP folio / Company name' : typeCode === 'RD' ? 'Monthly RD - 2Y' : typeCode === 'PPF' ? 'PPF Account 2024' : typeCode === 'CHIT' ? '2.5L Chit - 12 months' : 'Senior FD - 5Y')} value={planName} onChange={(e) => setPlanName(e.target.value)} className="field-input" />
              </div>
            </div>
          </section>

          {!isTransactionType && (
            <section>
              <label className="block text-xs text-ink-soft mb-2">Tenure<span className="text-danger ml-0.5">*</span></label>
              <div className="flex flex-wrap gap-2">
                {tenurePresets.map((p) => (
                  <button key={p.months} type="button" onClick={() => setTenureMode(p.months)} className={`chip ${tenureMode === p.months ? 'on' : ''}`}>{p.label}</button>
                ))}
                <button type="button" onClick={() => setTenureMode(CUSTOM_TENURE_MODE)} className={`chip ${tenureMode === CUSTOM_TENURE_MODE ? 'on' : ''}`}>Custom</button>
              </div>
              {tenureMode === CUSTOM_TENURE_MODE && (
                <div className="grid grid-cols-3 gap-2 mt-3 max-w-sm">
                  <div>
                    <label className="block text-[11px] text-ink-mute mb-1">Years</label>
                    <input type="number" min="0" value={customY} onChange={(e) => setCustomY(e.target.value)} className="field-input" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-mute mb-1">Months</label>
                    <input type="number" min="0" max="11" value={customM} onChange={(e) => setCustomM(e.target.value)} className="field-input" />
                  </div>
                  {effectiveFrequency === 'lump_sum' && (
                    <div>
                      <label className="block text-[11px] text-ink-mute mb-1">Days</label>
                      <input type="number" min="0" max="30" value={customD} onChange={(e) => setCustomD(e.target.value)} className="field-input" />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Date of purchase' : (isMarketType ? 'Holding start / first trade date' : 'Start / debit date')}<span className="text-danger ml-0.5">*</span></label>
              <input type="date" value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} className="field-input" />
              <p className="text-[11px] text-ink-mute mt-1">{isMetalType ? 'Date of the first purchase (add more later).' : (isMarketType ? 'Used as the opening date for this holding and the default date for the first buy.' : 'For monthly/yearly plans, this date sets the recurring debit day anchor.')}</p>
            </div>
          </section>

          {isTransactionType ? (
            <section className="space-y-3">
              <div>
                <p className="text-[11px] tracking-wider text-ink-mute uppercase">{isMetalType ? 'Initial purchase now' : 'Initial buy now'} <span className="text-[10px] normal-case ml-1">optional</span></p>
                <p className="text-[11px] text-ink-mute mt-1">You can leave this empty and save. Add transactions later from the investment detail page.</p>
              </div>
              {isEditing ? (
                <div className="rounded-xl border border-edge bg-paper-tint p-3 text-[12px] text-ink-soft">{isMetalType ? 'Use the investment detail page to add another purchase or record a sale.' : 'Use the investment detail page to add another buy, redeem units, or record dividends.'}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isMetalType && (
                    <div className="md:col-span-2 rounded-xl border border-edge bg-paper px-3 py-2.5 text-sm">
                      <p className="text-xs text-ink-soft mb-2">How are you adding this?</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setAcquisitionFlow('purchase_now')} className={`chip ${acquisitionFlow === 'purchase_now' ? 'on' : ''}`}>Purchased now</button>
                        <button type="button" onClick={() => setAcquisitionFlow('scheme_monthly')} className={`chip ${acquisitionFlow === 'scheme_monthly' ? 'on' : ''}`}>Scheme - pay monthly</button>
                      </div>

                      {acquisitionFlow === 'scheme_monthly' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                          <div>
                            <label className="block text-xs text-ink-soft mb-1">Scheme months</label>
                            <input type="number" min="1" step="1" value={schemeMonths} onChange={(e) => setSchemeMonths(e.target.value)} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1">Monthly payment (₹)</label>
                            <input type="number" min="0" step="0.01" value={schemeMonthlyAmount} onChange={(e) => setSchemeMonthlyAmount(e.target.value)} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1">Months paid</label>
                            <input type="number" min="0" step="1" value={schemePaidMonths} onChange={(e) => setSchemePaidMonths(e.target.value)} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1">Scheme status</label>
                            <select value={schemeStatus} onChange={(e) => setSchemeStatus(e.target.value)} className="field-input">
                              {SCHEME_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          {isPrematureWithdrawal(schemeStatus) && (
                            <div>
                              <label className="block text-xs text-ink-soft mb-1">Withdrawal penalty (%)</label>
                              <input type="number" min="0" step="0.01" value={prematurePenaltyPct} onChange={(e) => setPrematurePenaltyPct(e.target.value)} className="field-input" placeholder="0" />
                            </div>
                          )}
                        </div>
                      )}

                      {acquisitionFlow === 'scheme_monthly' && !schemeAllowsPurchaseEntry && (
                        <p className="text-[11px] text-honey-700 mt-2">Purchase entry will be logged only after scheme months are completed. For early exit, set scheme status to Premature withdrawal in the purchase section below.</p>
                      )}
                    </div>
                  )}

                  {(!isMetalType || schemeAllowsPurchaseEntry) && (
                    <>
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Weight (grams)' : 'Units'}</label>
                        <input type="number" step={isMetalType ? '0.001' : '0.000001'} placeholder={isMetalType ? '10.000' : '12.500000'} value={initialUnits} onChange={(e) => setInitialUnits(e.target.value)} className="field-input" />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Price per gram (₹)' : 'Price / NAV per unit (₹)'}</label>
                        <input type="number" step="0.01" placeholder={isMetalType ? (typeCode === 'GOLD' ? '7200.00' : '95.00') : '112.35'} value={initialPrice} onChange={(e) => setInitialPrice(e.target.value)} className="field-input" />
                      </div>
                    </>
                  )}

                  {isMetalType && schemeAllowsPurchaseEntry && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-ink-soft mb-1.5">Purchase method</label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setPurchaseMode('general')} className={`chip ${purchaseMode === 'general' ? 'on' : ''}`}>General purchase</button>
                          <button type="button" onClick={() => setPurchaseMode('scheme')} className={`chip ${purchaseMode === 'scheme' ? 'on' : ''}`}>Scheme purchase</button>
                        </div>
                      </div>

                      <div className={purchaseMode === 'general' ? 'md:col-span-2' : ''}>
                        <label className="block text-xs text-ink-soft mb-1.5">Making charges</label>
                        <select
                          value={useMakingPercent ? 'percentage' : 'value'}
                          onChange={(e) => {
                            const nextIsPercent = e.target.value === 'percentage';
                            if (!nextIsPercent && metalPricing) {
                              setActualMakingValue((prev) => (Number(prev) > 0 ? prev : metalPricing.actualMakingAmount.toFixed(2)));
                              setPayableMakingValue((prev) => (Number(prev) > 0 ? prev : metalPricing.payableMakingAmount.toFixed(2)));
                            }
                            setUseMakingPercent(nextIsPercent);
                            setAutoCalcCharges(true);
                          }}
                          className="field-input"
                        >
                          <option value="percentage">Percent of metal value</option>
                          <option value="value">Rupee amount on the bill</option>
                        </select>
                        <p className="text-[11px] text-ink-mute mt-1">
                          {purchaseMode === 'general'
                            ? 'Direct purchase, with no scheme discount. GST is calculated on metal value plus making charges.'
                            : 'Use a percent when the bill shows a rate, or the rupee amount printed on the bill. Scheme purchases can compare the normal charge with the lower scheme charge.'}
                        </p>
                      </div>
                      {purchaseMode === 'general' ? (
                        useMakingPercent ? (
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Making charge (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={makingChargePct}
                              onChange={(e) => { setMakingChargePct(e.target.value); setAutoCalcCharges(true); }}
                              className="field-input"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Making charges (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={actualMakingValue}
                              onChange={(e) => {
                                setActualMakingValue(e.target.value);
                                setPayableMakingValue(e.target.value);
                                setAutoCalcCharges(true);
                              }}
                              className="field-input"
                            />
                          </div>
                        )
                      ) : useMakingPercent ? (
                        <>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Normal making charge (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={schemeActualMakingPct}
                              onChange={(e) => { setSchemeActualMakingPct(e.target.value); setAutoCalcCharges(true); }}
                              className="field-input"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Scheme making charge (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={schemeGivenMakingPct}
                              onChange={(e) => {
                                setSchemeGivenMakingPct(e.target.value);
                                setMakingChargePct(e.target.value);
                                setAutoCalcCharges(true);
                              }}
                              className="field-input"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Normal making charge (₹)</label>
                            <input type="number" step="0.01" value={actualMakingValue} onChange={(e) => { setActualMakingValue(e.target.value); setAutoCalcCharges(true); }} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Making charge you pay (₹)</label>
                            <input type="number" step="0.01" value={payableMakingValue} onChange={(e) => { setPayableMakingValue(e.target.value); setAutoCalcCharges(true); }} className="field-input" />
                          </div>
                        </>
                      )}



                      <div className="md:col-span-2 rounded-xl border border-edge bg-paper px-3 py-2.5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-ink-soft mb-1">GST style</label>
                            <select value={useGstSplit ? 'split' : 'total'} onChange={(e) => { setUseGstSplit(e.target.value === 'split'); setAutoCalcCharges(true); }} className="field-input">
                              <option value="split">SGST + CGST split</option>
                              <option value="total">Single GST total</option>
                            </select>
                          </div>
                          {useGstSplit ? (
                            <div>
                              <label className="block text-xs text-ink-soft mb-1">GST input mode</label>
                              <select value={gstInputMode} onChange={(e) => { setGstInputMode(e.target.value); setAutoCalcCharges(true); }} className="field-input">
                                <option value="percentage">Enter %</option>
                                <option value="value">Enter ₹ values</option>
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs text-ink-soft mb-1">GST total value (₹)</label>
                              <input type="number" step="0.01" value={gstTotalValue} onChange={(e) => { setGstTotalValue(e.target.value); setAutoCalcCharges(true); }} className="field-input" />
                            </div>
                          )}
                        </div>
                        {useGstSplit && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="block text-xs text-ink-soft mb-1">SGST {gstInputMode === 'percentage' ? '(%)' : '(₹)'}</label>
                              <input type="number" step="0.01" value={gstInputMode === 'percentage' ? sgstPct : sgstValue} onChange={(e) => {
                                if (gstInputMode === 'percentage') setSgstPct(e.target.value);
                                else setSgstValue(e.target.value);
                                setAutoCalcCharges(true);
                              }} className="field-input" />
                            </div>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1">CGST {gstInputMode === 'percentage' ? '(%)' : '(₹)'}</label>
                              <input type="number" step="0.01" value={gstInputMode === 'percentage' ? cgstPct : cgstValue} onChange={(e) => {
                                if (gstInputMode === 'percentage') setCgstPct(e.target.value);
                                else setCgstValue(e.target.value);
                                setAutoCalcCharges(true);
                              }} className="field-input" />
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-[11px] text-ink-mute">
                          {metalPricing
                            ? `GST on metal + making: SGST ${metalPricing.derivedSgstPct.toFixed(2)}% (${inrPaise(metalPricing.sgstAmount)}), CGST ${metalPricing.derivedCgstPct.toFixed(2)}% (${inrPaise(metalPricing.cgstAmount)}), Total ${metalPricing.totalGstPct.toFixed(2)}% (${inrPaise(metalPricing.totalGst)})`
                            : 'Enter weight and price to view GST conversion.'}
                        </div>
                      </div>

                      {purchaseMode === 'scheme' && (
                        <>
                          <div className="md:col-span-2 rounded-xl border border-honey-600/30 bg-honey-50 px-3 py-2.5 text-sm">
                            <p className="font-medium text-honey-700">Scheme details</p>
                            <p className="text-[11px] text-honey-700/80 mt-1">Compare normal making charge with scheme-offered making charge to see savings or loss.</p>
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Actual making charge (%)</label>
                            <input type="number" step="0.01" value={schemeActualMakingPct} onChange={(e) => setSchemeActualMakingPct(e.target.value)} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Scheme making charge (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={schemeGivenMakingPct}
                              onChange={(e) => {
                                setSchemeGivenMakingPct(e.target.value);
                                setMakingChargePct(e.target.value);
                                setAutoCalcCharges(true);
                              }}
                              className="field-input"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Extra scheme benefit (₹)</label>
                            <input type="number" step="0.01" value={schemeBenefitAmount} onChange={(e) => setSchemeBenefitAmount(e.target.value)} className="field-input" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Scheme accumulated grams</label>
                            <input type="number" step="0.001" value={schemeAccumulatedGrams} onChange={(e) => setSchemeAccumulatedGrams(e.target.value)} className="field-input" placeholder="2.499" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Purchased grams</label>
                            <input type="number" step="0.001" value={schemePurchasedGrams} onChange={(e) => setSchemePurchasedGrams(e.target.value)} className="field-input" placeholder="2.582" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-soft mb-1.5">Scheme status</label>
                            <select value={schemeStatus} onChange={(e) => setSchemeStatus(e.target.value)} className="field-input">
                              {SCHEME_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          {schemeNeedsTracking(schemeStatus) && (
                            <>
                              <div>
                                <label className="block text-xs text-ink-soft mb-1.5">Scheme months</label>
                                <input type="number" min="1" step="1" value={schemeMonths} onChange={(e) => setSchemeMonths(e.target.value)} className="field-input" />
                              </div>
                              <div>
                                <label className="block text-xs text-ink-soft mb-1.5">Monthly payment (₹)</label>
                                <input type="number" min="0" step="0.01" value={schemeMonthlyAmount} onChange={(e) => setSchemeMonthlyAmount(e.target.value)} className="field-input" />
                              </div>
                              <div>
                                <label className="block text-xs text-ink-soft mb-1.5">Months paid</label>
                                <input type="number" min="0" step="1" value={schemePaidMonths} onChange={(e) => setSchemePaidMonths(e.target.value)} className="field-input" />
                              </div>
                              {isPrematureWithdrawal(schemeStatus) && (
                                <div>
                                  <label className="block text-xs text-ink-soft mb-1.5">Withdrawal penalty (%)</label>
                                  <input type="number" min="0" step="0.01" value={prematurePenaltyPct} onChange={(e) => setPrematurePenaltyPct(e.target.value)} className="field-input" placeholder="0" />
                                </div>
                              )}
                            </>
                          )}


                        </>
                      )}

                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">Making charge amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={useMakingPercent ? (metalPricing ? metalPricing.payableMakingAmount.toFixed(2) : '0.00') : actualMakingValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            setInitialCharges(value);
                            setUseMakingPercent(false);
                            setActualMakingValue(value);
                            setPayableMakingValue(value);
                            setAutoCalcCharges(true);
                          }}
                          className="field-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">GST total (SGST + CGST) (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={useGstSplit ? (metalPricing ? metalPricing.totalGst.toFixed(2) : '0.00') : gstTotalValue}
                          onChange={(e) => {
                            setInitialTaxes(e.target.value);
                            setGstTotalValue(e.target.value);
                            setUseGstSplit(false);
                            setAutoCalcCharges(true);
                          }}
                          className="field-input"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setUseGstSplit(true);
                            setGstInputMode('percentage');
                            setSgstPct((prev) => (Number(prev) > 0 ? prev : '1.5'));
                            setCgstPct((prev) => (Number(prev) > 0 ? prev : '1.5'));
                            setAutoCalcCharges(true);
                          }}
                          className="mt-1 text-[11px] text-sky-700 hover:underline"
                        >
                          Use auto-calculated values
                        </button>
                      </div>
                    </>
                  )}

                  {!isMetalType && (
                    <>
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">Charges (₹)</label>
                        <input type="number" step="0.01" value={initialCharges} onChange={(e) => setInitialCharges(e.target.value)} className="field-input" />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">Taxes (₹)</label>
                        <input type="number" step="0.01" value={initialTaxes} onChange={(e) => setInitialTaxes(e.target.value)} className="field-input" />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-xs text-ink-soft mb-1.5">Notes <span className="text-[10px] text-ink-mute">optional</span></label>
                    <textarea rows="3" value={initialNotes} onChange={(e) => setInitialNotes(e.target.value)} className="field-input" placeholder={isMetalType ? 'e.g. Wedding gift, hallmark BIS 916…' : 'SIP instalment, broker note, folio reference…'} />
                  </div>
                  <div className="md:col-span-2 bg-paper-tint rounded-xl border border-edge px-3 py-2.5 text-sm">
                    {!isMetalType ? (
                      <>
                        <div className="flex justify-between"><span className="text-ink-soft">Purchase value</span><span className="font-medium">{inr(marketPreview?.gross || 0)}</span></div>
                        <div className="flex justify-between mt-1"><span className="text-ink-soft">Total cost incl. charges</span><span className="font-medium text-mint-600">{inr(marketPreview?.total || 0)}</span></div>
                      </>
                    ) : (
                      <MetalInvoiceDetails
                        pricing={metalPricing}
                        purchaseMode={purchaseMode}
                        metalName={typeCode === 'SILV' ? 'silver' : 'gold'}
                      />
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : isChitType ? (
            <ChitFundFields
              tenureMonths={chitTenureMonths}
              chitMode={chitMode}
              setChitMode={setChitMode}
              chitValue={chitValue}
              setChitValue={setChitValue}
              prePickAmount={prePickAmount}
              setPrePickAmount={setPrePickAmount}
              postPickAmount={postPickAmount}
              setPostPickAmount={setPostPickAmount}
              payouts={chitPayouts}
              setPayouts={setChitPayouts}
              customMonths={chitCustomMonths}
              setCustomMonths={setChitCustomMonths}
              pickMonth={chitPickMonth}
              setPickMonth={setChitPickMonth}
            />
          ) : (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-soft mb-1.5">{amountLabel}<span className="text-danger ml-0.5">*</span></label>
                  <input type="number" inputMode="numeric" placeholder={amountPlaceholder} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" />
                </div>
                <div>
                  <label className="block text-xs text-ink-soft mb-1.5">Interest rate (% p.a.)<span className="text-danger ml-0.5">*</span></label>
                  <input type="number" step="0.05" placeholder={typeCode === 'PPF' ? '7.10' : '7.25'} value={ratePct} onChange={(e) => setRatePct(e.target.value)} className="field-input" />
                  {calc && effectiveFrequency === 'lump_sum' && (
                    <div className="mt-2 px-2.5 py-2 bg-paper-tint rounded-lg text-xs">
                      <div className="flex justify-between"><span className="text-ink-soft">Monthly rate</span><span className="font-medium text-mint-600">{calc.monthlyPct.toFixed(3)}%</span></div>
                      <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-edge"><span className="text-ink-soft">Monthly interest</span><span className="font-medium text-mint-600">{inr(calc.monthlyInt)}</span></div>
                    </div>
                  )}
                </div>
              </section>

              {effectiveFrequency === 'lump_sum' && (
                <section>
                  <label className="block text-xs text-ink-soft mb-1.5">Compounding</label>
                  <select value={compounding} onChange={(e) => setCompounding(e.target.value)} className="field-input max-w-xs">
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="half">Half-yearly</option>
                    <option value="yearly">Yearly</option>
                    <option value="simple">Simple interest</option>
                  </select>
                </section>
              )}

              {calc && (
                <div className="bg-paper-tint rounded-xl p-3.5 space-y-1.5 text-sm">
                  {effectiveFrequency !== 'lump_sum' && (
                    <div className="flex justify-between"><span className="text-ink-soft">Total invested</span><span className="font-medium">{inr(calc.totalInvested)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-ink-soft">Maturity date</span><span className="font-medium">{fmtDate(calc.matDate)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Total interest</span><span className="font-medium text-mint-600">+ {inr(calc.interest)}</span></div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-edge"><span className="text-ink-soft">Maturity value</span><span className="text-lg font-medium text-mint-600">{inr(calc.matVal)}</span></div>
                </div>
              )}
            </>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Goal<span className="text-danger ml-0.5">*</span></label>
              {goals.length === 0 ? (
                <Link href="/goals/new" className="block field-input text-sky-600 text-sm">+ Create your first goal</Link>
              ) : (
                <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="field-input">
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Nominee<span className="text-danger ml-0.5">*</span></label>
              <input type="text" placeholder="Full name" value={nominee} onChange={(e) => setNominee(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Account holder</label>
              <input type="text" placeholder="Self, Wife, Father…" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="field-input" />
              <p className="text-[11px] text-ink-mute mt-1">Whose account / name this investment is in</p>
            </div>
          </section>

          {!isTransactionType && !isChitType && (
            <section>
              <div className="flex items-center justify-between p-3 bg-paper-tint rounded-xl">
                <div>
                  <div className="text-sm font-medium">Auto-renew on maturity</div>
                  <div className="text-[11px] text-ink-soft mt-0.5">Reminder fires 30 days before</div>
                </div>
                <button type="button" onClick={() => setAutoRenew(!autoRenew)} className={`w-9 h-5 rounded-full relative transition ${autoRenew ? 'bg-mint-600' : 'bg-ink-mute'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoRenew ? 'right-0.5' : 'left-0.5'}`}></span>
                </button>
              </div>
            </section>
          )}

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Document <span className="text-[10px] text-ink-mute normal-case ml-1">optional</span></p>
            <div
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openFilePicker();
                }
              }}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`block border border-dashed rounded-xl p-5 text-center cursor-pointer transition ${dragOver ? 'border-mint-600 bg-mint-50' : 'border-edge hover:bg-paper-tint'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={onUpload}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="text-sm font-medium">{dragOver ? 'Drop to upload' : 'Drag and drop, or tap to browse'}</div>
              <div className="text-[11px] text-ink-soft mt-1">PDF, PNG, JPG, DOCX, XLSX, or CSV · up to 5 MB each</div>
            </div>
            {docs.map((d, i) => {
              const badge = documentBadge(d.filename);
              return (
                <div key={i} className="flex items-center gap-2.5 p-2.5 bg-paper-tint rounded-lg mt-2">
                  <div className={`w-8 h-9 rounded text-[10px] font-medium flex items-center justify-center flex-shrink-0 ${badge.className}`}>{badge.label}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{d.filename}</p>
                    <p className="text-[11px] text-ink-mute">{(d.size_bytes / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={() => removeDoc(i)} className="text-ink-mute hover:text-danger px-2">×</button>
                </div>
              );
            })}
          </section>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2.5 pt-3 border-t border-edge">
            <button type="button" onClick={() => router.back()} className="btn-ghost py-2.5 px-5 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 rounded-lg text-sm font-medium">
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save investment'}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
