'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, labelFor, frequencyLabel } from '@/lib/format';
import {
  MARKET_TRANSACTION_TYPES,
  METAL_TRANSACTION_TYPES,
  computeTransactionNetAmount,
  getTransactionTypeLabel,
  isMarketInvestment,
  isMetalInvestment,
} from '@/lib/investments';

function buildSchedule(investment) {
  const freq = investment.payment_frequency;
  if (freq !== 'monthly' && freq !== 'yearly') return [];

  const start = new Date(investment.start_date);
  const tenureMonths = Number(investment.tenure_months);
  const amount = Number(investment.amount);
  const schedule = [];

  if (freq === 'monthly') {
    for (let m = 0; m < tenureMonths; m++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + m);
      const label = due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      schedule.push({ period_label: label, due_date: due.toISOString().slice(0, 10), amount });
    }
  } else {
    const years = Math.floor(tenureMonths / 12);
    for (let y = 0; y < years; y++) {
      const due = new Date(start);
      due.setFullYear(due.getFullYear() + y);
      const startYr = due.getFullYear();
      const label = `${startYr}-${String(startYr + 1).slice(2)}`;
      schedule.push({ period_label: label, due_date: due.toISOString().slice(0, 10), amount });
    }
  }
  return schedule;
}

function daysUntilMaturity(maturityDate) {
  if (!maturityDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mat = new Date(maturityDate);
  mat.setHours(0, 0, 0, 0);
  return Math.round((mat - today) / (1000 * 60 * 60 * 24));
}

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

export default function DetailClient({
  user,
  investment: i,
  documents,
  marketTransactions = [],
  marketSummary = null,
  marketWarning = '',
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [paymentRecords, setPaymentRecords] = useState({});
  const [togglingPeriod, setTogglingPeriod] = useState(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsWritable, setPaymentsWritable] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');
  const [manualPaidDate, setManualPaidDate] = useState({});

  const marketType = isMarketInvestment(i.type_code);
  const metalType = isMetalInvestment(i.type_code);
  const isTransactionType = marketType || metalType;
  const [transactions, setTransactions] = useState(marketTransactions.map((tx) => ({ ...tx, net_amount: computeTransactionNetAmount(tx) })));
  const [summary, setSummary] = useState(marketSummary);
  const [transactionError, setTransactionError] = useState(marketWarning);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [txForm, setTxForm] = useState({
    transaction_type: 'buy',
    trade_date: new Date().toISOString().slice(0, 10),
    units: '',
    price_per_unit: '',
    cash_amount: '',
    charges: '0',
    taxes: '0',
    notes: '',
  });
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

  const freq = i.payment_frequency || 'lump_sum';
  const isRecurring = !isTransactionType && (freq === 'monthly' || freq === 'yearly');

  const onDelete = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/investments/${i.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      router.push('/investments');
      router.refresh();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!isRecurring) return;
    setPaymentsError('');
    fetch(`/api/investments/${i.id}/payments`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load payment history.');
        return d;
      })
      .then((d) => {
        const map = {};
        (d.records || []).forEach((r) => { map[r.period_label] = r; });
        setPaymentRecords(map);
        setPaymentsWritable(d.writable !== false);
        if (d.warning) setPaymentsError(d.warning);
      })
      .catch((err) => setPaymentsError(err.message || 'Could not load payment history.'))
      .finally(() => setPaymentsLoaded(true));
  }, [i.id, isRecurring]);

  const togglePayment = async (slot) => {
    setPaymentsError('');
    setTogglingPeriod(slot.period_label);
    const current = paymentRecords[slot.period_label];
    const newPaid = !(current?.paid);
    const selectedDate = manualPaidDate[slot.period_label] || slot.due_date;
    try {
      const res = await fetch(`/api/investments/${i.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slot, paid: newPaid, paid_at: newPaid ? selectedDate : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update payment record.');
      setPaymentRecords((prev) => ({ ...prev, [slot.period_label]: data.record }));
    } catch (err) {
      setPaymentsError(err.message || 'Could not update payment record.');
    } finally {
      setTogglingPeriod(null);
    }
  };

  const submitTransaction = async (e) => {
    e.preventDefault();
    setTransactionError('');
    setSavingTransaction(true);

    const type = txForm.transaction_type;
    const units = Number(txForm.units || 0);
    const price = Number(txForm.price_per_unit || 0);
    const charges = Number(txForm.charges || 0);
    const taxes = Number(txForm.taxes || 0);
    const cashAmount = Number(txForm.cash_amount || 0);

    try {
      const metalBuyTransaction = metalType && type === 'buy';

      if (metalBuyTransaction) {
        if (useMakingPercent) {
          if (Number(makingChargePct || 0) < 0) throw new Error('Making charge % cannot be negative.');
        } else {
          if (Number(actualMakingValue || 0) < 0 || Number(payableMakingValue || 0) < 0) {
            throw new Error('Making charge values cannot be negative.');
          }
        }

        if (useGstSplit) {
          if (gstInputMode === 'percentage' && (Number(sgstPct || 0) < 0 || Number(cgstPct || 0) < 0)) {
            throw new Error('SGST/CGST % cannot be negative.');
          }
          if (gstInputMode === 'value' && (Number(sgstValue || 0) < 0 || Number(cgstValue || 0) < 0)) {
            throw new Error('SGST/CGST values cannot be negative.');
          }
        } else if (Number(gstTotalValue || 0) < 0) {
          throw new Error('GST total cannot be negative.');
        }

        if (purchaseMode === 'scheme') {
          if (Number(schemeActualMakingPct || 0) < 0 || Number(schemeGivenMakingPct || 0) < 0) {
            throw new Error('Scheme making charge % values cannot be negative.');
          }
          if (Number(schemeBenefitAmount || 0) < 0) {
            throw new Error('Scheme benefit amount cannot be negative.');
          }
          if (Number(schemeAccumulatedGrams || 0) < 0 || Number(schemePurchasedGrams || 0) < 0) {
            throw new Error('Scheme accumulated/purchased grams cannot be negative.');
          }
          if (schemeStatus === 'active') {
            const months = Number(schemeMonths || 0);
            const paid = Number(schemePaidMonths || 0);
            const monthly = Number(schemeMonthlyAmount || 0);
            if (months <= 0) throw new Error('Scheme months must be greater than zero.');
            if (monthly <= 0) throw new Error('Scheme monthly amount must be greater than zero.');
            if (paid < 0 || paid > months) throw new Error('Paid months must be between 0 and total scheme months.');
          }
        }
      }

      const notesLines = [];
      if (txForm.notes.trim()) notesLines.push(txForm.notes.trim());
      if (metalBuyTransaction) {
        if (metalPricing) {
          notesLines.push(
            `Pricing: actual making ${metalPricing.actualMakingPct.toFixed(2)}% (${inr(metalPricing.actualMakingAmount)}), payable making ${metalPricing.schemeMakingPct.toFixed(2)}% (${inr(metalPricing.payableMakingAmount)})`
          );
          notesLines.push(
            `Discount: making ${metalPricing.makingDiscountPct.toFixed(2)}% (${inr(metalPricing.makingDiscountAmount)}), scheme benefit ${inr(metalPricing.manualBenefit)}, total discount ${inr(metalPricing.totalDiscountAmount)}`
          );
          notesLines.push(
            `GST: SGST ${metalPricing.derivedSgstPct.toFixed(2)}% (${inr(metalPricing.sgstAmount)}), CGST ${metalPricing.derivedCgstPct.toFixed(2)}% (${inr(metalPricing.cgstAmount)}), total ${metalPricing.totalGstPct.toFixed(2)}% (${inr(metalPricing.totalGst)})`
          );
          notesLines.push(
            `Bill compare: general ${inr(metalPricing.generalTotal)} vs current ${inr(metalPricing.schemeTotal)} (${metalPricing.comparisonDifference >= 0 ? 'saving' : 'loss'} ${inr(Math.abs(metalPricing.comparisonDifference))})`
          );
        }
        if (purchaseMode === 'scheme' && metalPricing) {
          notesLines.push(
            `Scheme making input: actual ${Number(schemeActualMakingPct || 0).toFixed(2)}%, offered ${Number(schemeGivenMakingPct || 0).toFixed(2)}%`
          );
          if (schemeStatus === 'active') {
            notesLines.push(
              `Scheme tracking: ${Number(schemePaidMonths || 0)}/${Number(schemeMonths || 0)} months, monthly ${inr(Number(schemeMonthlyAmount || 0))}, paid ${inr(metalPricing.paidAmount)}, remaining ${inr(metalPricing.remainingSchemeAmount)}`
            );
          }
          notesLines.push(
            `Scheme grams: accumulated ${metalPricing.accumulatedGrams.toFixed(3)}g, purchased ${metalPricing.purchasedGrams.toFixed(3)}g, difference ${metalPricing.gramsDifference >= 0 ? '+' : ''}${metalPricing.gramsDifference.toFixed(3)}g (${metalPricing.gramsBonusPct >= 0 ? '+' : ''}${metalPricing.gramsBonusPct.toFixed(2)}%)`
          );
          notesLines.push(`Scheme grams payable amount: ${inr(metalPricing.extraGramPayableAmount || 0)}`);
        }
      }

      const payload = {
        transaction_type: type,
        trade_date: txForm.trade_date,
        units: ['dividend'].includes(type) ? 0 : units,
        price_per_unit: ['dividend', 'bonus', 'split'].includes(type) ? 0 : price,
        total_amount: type === 'dividend' ? cashAmount : units * price,
        charges,
        taxes,
        notes: notesLines.length ? notesLines.join('\n') : null,
      };

      const res = await fetch(`/api/investments/${i.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save transaction.');
      setTransactions((prev) => ([{ ...data.record, net_amount: data.record.net_amount ?? computeTransactionNetAmount(data.record) }, ...prev]
        .sort((a, b) => `${b.trade_date}|${b.created_at || b.id}`.localeCompare(`${a.trade_date}|${a.created_at || a.id}`))));
      setSummary(data.summary);
      setTxForm({ transaction_type: 'buy', trade_date: new Date().toISOString().slice(0, 10), units: '', price_per_unit: '', cash_amount: '', charges: '0', taxes: '0', notes: '' });
      setAutoCalcCharges(true);
      if (metalType) {
        setUseMakingPercent(true);
        setActualMakingValue('0');
        setPayableMakingValue('0');
        setGstInputMode('percentage');
        setUseGstSplit(true);
        setSgstPct('1.5');
        setCgstPct('1.5');
        setSgstValue('0');
        setCgstValue('0');
        setGstTotalValue('0');
        setSchemeAccumulatedGrams('');
        setSchemePurchasedGrams('');
      }
    } catch (err) {
      setTransactionError(err.message || 'Could not save transaction.');
    } finally {
      setSavingTransaction(false);
    }
  };

  const monthlyInt = (Number(i.amount) * Number(i.rate_pct)) / 100 / 12;
  const monthlyPct = (Number(i.rate_pct) / 12).toFixed(3);

  let totalInvested = Number(i.amount);
  if (freq === 'monthly' && i.tenure_months) totalInvested = Number(i.amount) * Number(i.tenure_months);
  else if (freq === 'yearly' && i.tenure_months) totalInvested = Number(i.amount) * Math.floor(Number(i.tenure_months) / 12);

  const amountLabel = freq === 'monthly' ? 'Monthly contribution' : freq === 'yearly' ? 'Yearly contribution' : 'Amount';
  const freqSuffix = freq === 'monthly' ? '/mo' : freq === 'yearly' ? '/yr' : '';

  const daysLeft = daysUntilMaturity(i.maturity_date);
  const maturityMatured = daysLeft !== null && daysLeft <= 0;
  const maturityUrgent = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
  const maturityWarning = daysLeft !== null && daysLeft > 30 && daysLeft <= 90;

  const schedule = isRecurring ? buildSchedule(i) : [];
  const paidCount = schedule.filter((s) => paymentRecords[s.period_label]?.paid).length;
  const totalPaid = paidCount * Number(i.amount);
  const expectedPaid = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedule.filter((s) => new Date(s.due_date) <= today).length;
  })();

  const selectedType = txForm.transaction_type;
  const showUnitsAndPrice = !['dividend', 'bonus', 'split'].includes(selectedType);
  const showCashAmount = selectedType === 'dividend';
  const showUnitOnly = ['bonus', 'split'].includes(selectedType);
  const metalBuyType = metalType && selectedType === 'buy';

  const metalPricing = useMemo(() => {
    if (!metalBuyType) return null;

    const units = Number(txForm.units || 0);
    const price = Number(txForm.price_per_unit || 0);
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
    const schemePayNowAmount = (accumulatedGrams > 0 && gramsDifference > 0)
      ? payableAfterSchemeCredit
      : (schemeStatus === 'active' ? Math.max(closureDelta, 0) : schemeTotal);
    const customerPayNowAmount = purchaseMode === 'scheme' ? schemePayNowAmount : generalTotal;

    return {
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
      expectedSchemeAmount,
      paidAmount,
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
    };
  }, [
    cgstPct,
    cgstValue,
    gstInputMode,
    makingChargePct,
    metalBuyType,
    purchaseMode,
    sgstPct,
    sgstValue,
    gstTotalValue,
    useGstSplit,
    useMakingPercent,
    actualMakingValue,
    payableMakingValue,
    schemeActualMakingPct,
    schemeAccumulatedGrams,
    schemeBenefitAmount,
    schemeGivenMakingPct,
    schemeMonths,
    schemeMonthlyAmount,
    schemePurchasedGrams,
    schemePaidMonths,
    schemeStatus,
    txForm.price_per_unit,
    txForm.units,
  ]);

  useEffect(() => {
    if (!metalBuyType || !autoCalcCharges || !metalPricing) return;

    setTxForm((prev) => ({
      ...prev,
      charges: metalPricing.payableMakingAmount.toFixed(2),
      taxes: metalPricing.totalGst.toFixed(2),
    }));
    setActualMakingValue(metalPricing.actualMakingAmount.toFixed(2));
    setPayableMakingValue(metalPricing.payableMakingAmount.toFixed(2));
    setGstTotalValue(metalPricing.totalGst.toFixed(2));
  }, [autoCalcCharges, metalBuyType, metalPricing, purchaseMode]);

  const currentSummary = summary || {
    total_units: 0,
    invested_amount: 0,
    redeemed_amount: 0,
    dividend_amount: 0,
    realized_gain_loss: 0,
    remaining_cost_basis: 0,
    average_buy_price: 0,
    current_value: 0,
    is_closed: false,
  };

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full">
        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Back</button>

        {!marketType && (maturityMatured || maturityUrgent || maturityWarning) && (
          <div className={`flex items-start gap-3 rounded-xl p-3.5 mb-4 ${maturityMatured ? 'bg-mint-50 border border-mint-600/30' : maturityUrgent ? 'bg-danger-soft border border-danger/30' : 'bg-honey-50 border border-honey-600/30'}`}>
            <span className="text-xl leading-none">{maturityMatured ? '✅' : maturityUrgent ? '🔔' : '📅'}</span>
            <div>
              <p className={`text-sm font-medium ${maturityMatured ? 'text-mint-700' : maturityUrgent ? 'text-danger' : 'text-honey-600'}`}>
                {maturityMatured ? (daysLeft === 0 ? 'Matures today' : `Matured ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`) : maturityUrgent ? `Matures in ${daysLeft} day${daysLeft === 1 ? '' : 's'}!` : `Matures in ${daysLeft} days`}
              </p>
              <p className="text-[11px] text-ink-soft mt-0.5">
                {maturityMatured ? 'This investment reached maturity. You can mark closure or plan reinvestment.' : maturityUrgent ? 'This investment is about to mature. Plan your next steps — renew, withdraw, or reinvest.' : 'This investment is maturing soon. Consider your renewal or withdrawal options.'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-paper-tint rounded-2xl p-5 mb-5">
          <p className="text-[11px] tracking-wider text-ink-mute uppercase">{labelFor(i)}</p>
          {marketType ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(currentSummary.remaining_cost_basis || 0)}</p>
              <p className="text-sm text-ink-soft mt-1">{formatUnits(currentSummary.total_units)} units held{currentSummary.is_closed && ' · position closed'}</p>
              <p className="text-sm text-ink-soft mt-1">Invested <span className="font-medium text-ink">{inr(currentSummary.invested_amount || 0)}</span> · Redeemed <span className="font-medium text-ink">{inr(currentSummary.redeemed_amount || 0)}</span></p>
            </>
          ) : metalType ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{formatUnits(currentSummary.total_units)} g</p>
              <p className="text-sm text-ink-soft mt-1">Total cost basis <span className="font-medium text-ink">{inr(currentSummary.remaining_cost_basis || 0)}</span></p>
              <p className="text-sm text-ink-soft mt-1">Avg purchase price <span className="font-medium text-honey-600">{inr(currentSummary.average_buy_price || 0)} / g</span></p>
            </>
          ) : isRecurring ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(i.amount)}<span className="text-base text-ink-soft font-normal">{freqSuffix}</span></p>
              {paymentsLoaded ? (
                <>
                  <p className="text-sm text-ink-soft mt-1">
                    Invested so far: <span className="font-medium text-ink">{inr(totalPaid)}</span>
                    <span className="text-ink-mute"> / {inr(totalInvested)}</span>
                  </p>
                  <p className="text-sm text-ink-soft mt-0.5">
                    <span className="font-medium text-ink">{paidCount}</span>
                    <span className="text-ink-mute">/{schedule.length} {freq === 'yearly' ? 'years' : 'months'} paid</span>
                    {schedule.length - paidCount > 0 && (
                      <span className="text-ink-mute"> · {schedule.length - paidCount} remaining</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-soft mt-1">Total invested: <span className="font-medium text-ink">{inr(totalInvested)}</span></p>
              )}
              <p className="text-sm text-ink-soft mt-1">Matures to <span className="text-mint-600 font-medium">{inr(i.maturity_value || totalInvested)}</span>{i.maturity_date && <> on {fmtDate(i.maturity_date)}</>}</p>
            </>
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(i.amount)}</p>
              <p className="text-sm text-ink-soft mt-2">Matures to <span className="text-mint-600 font-medium">{inr(i.maturity_value || i.amount)}</span>{i.maturity_date && <> on {fmtDate(i.maturity_date)}</>}</p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 mb-5">
          <Row label={metalType ? 'Store / source' : 'Bank / platform'} value={i.bank} />
          <Row label={metalType ? 'Item description' : 'Plan'} value={i.plan_name} />
          {!isTransactionType && <Row label={amountLabel} value={`${inr(i.amount)}${freqSuffix}`} />}
          {!isTransactionType && isRecurring && (
            <Row
              label="Total invested"
              value={paymentsLoaded
                ? <><span>{inr(totalPaid)}</span><span className="text-ink-soft font-normal"> / {inr(totalInvested)}</span></>
                : inr(totalInvested)
              }
            />
          )}
          {!isTransactionType && <Row label="Rate" value={`${i.rate_pct}% p.a. (≈ ${monthlyPct}%/mo)`} />}
          {!isTransactionType && !isRecurring && <Row label="Monthly interest" value={<span className="text-mint-600">{inr(monthlyInt)}</span>} />}
          {!isTransactionType && <Row label="Payment frequency" value={frequencyLabel(freq)} />}
          {!isTransactionType && <Row label="Tenure" value={`${i.tenure_months} months${i.tenure_days ? ` ${i.tenure_days} days` : ''}`} />}
          {marketType && <Row label="Units held" value={formatUnits(currentSummary.total_units)} />}
          {marketType && <Row label="Average buy price" value={inr(currentSummary.average_buy_price || 0)} />}
          {marketType && <Row label="Invested amount" value={inr(currentSummary.invested_amount || 0)} />}
          {marketType && <Row label="Redeemed amount" value={inr(currentSummary.redeemed_amount || 0)} />}
          {marketType && <Row label="Realized gain / loss" value={<span className={Number(currentSummary.realized_gain_loss || 0) >= 0 ? 'text-mint-600' : 'text-danger'}>{inr(currentSummary.realized_gain_loss || 0)}</span>} />}
          {marketType && <Row label="Remaining cost basis" value={inr(currentSummary.remaining_cost_basis || 0)} />}
          {metalType && <Row label="Weight held" value={`${formatUnits(currentSummary.total_units)} g`} />}
          {metalType && <Row label="Avg purchase price" value={`${inr(currentSummary.average_buy_price || 0)} / g`} />}
          {metalType && <Row label="Total cost (incl. charges)" value={inr(currentSummary.remaining_cost_basis || 0)} />}
          <Row label="Started" value={fmtDate(i.start_date)} />
          <Row label="Goal" value={i.goal_name ? <Link href="/goals" className="text-sky-600">{i.goal_name} →</Link> : '—'} />
          <Row label="Nominee" value={i.nominee} />
          <Row label="Account holder" value={i.account_holder || 'Self'} />
          {!isTransactionType && <Row label="Auto-renew" value={i.auto_renew ? <span className="text-mint-600">on · reminder 30d before</span> : 'off'} />}
          {isTransactionType && !metalType && <Row label="Position" value={currentSummary.is_closed ? 'Closed' : 'Active'} />}
        </div>

        {isTransactionType && (
          <section className="mb-5 space-y-4">
            {marketType && (
              <div>
                <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Transaction summary</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <SummaryCard label="Units held" value={formatUnits(currentSummary.total_units)} />
                  <SummaryCard label="Avg cost" value={inr(currentSummary.average_buy_price || 0)} />
                  <SummaryCard label="Realized P/L" value={inr(currentSummary.realized_gain_loss || 0)} tone={Number(currentSummary.realized_gain_loss || 0) >= 0 ? 'text-mint-600' : 'text-danger'} />
                  <SummaryCard label="Invested" value={inr(currentSummary.invested_amount || 0)} />
                  <SummaryCard label="Redeemed" value={inr(currentSummary.redeemed_amount || 0)} />
                  <SummaryCard label="Dividends" value={inr(currentSummary.dividend_amount || 0)} />
                </div>
              </div>
            )}
            {metalType && (
              <div>
                <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Metal summary</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <SummaryCard label="Weight held" value={`${formatUnits(currentSummary.total_units)} g`} />
                  <SummaryCard label="Avg price / g" value={inr(currentSummary.average_buy_price || 0)} />
                  <SummaryCard label="Total cost" value={inr(currentSummary.remaining_cost_basis || 0)} />
                </div>
              </div>
            )}

            <div className="bg-paper-card border border-edge rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{metalType ? 'Add purchase / sale' : 'Add transaction'}</p>
                <span className="text-[11px] text-ink-soft">{metalType ? 'Purchase, sell' : 'Buy, redeem, switch, dividend'}</span>
              </div>
              {transactionError && <p className="text-[11px] text-danger mb-3">{transactionError}</p>}
              {metalType && (
                <div className="mb-3 rounded-xl border border-honey-600/25 bg-honey-50 px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-honey-700 font-medium">Accumulated so far: {formatUnits(currentSummary.total_units)} g</span>
                    <span className="text-honey-700">Cost basis: {inr(currentSummary.remaining_cost_basis || 0)}</span>
                  </div>
                </div>
              )}
              <form onSubmit={submitTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-soft mb-1.5">Transaction type</label>
                  <select value={txForm.transaction_type} onChange={(e) => setTxForm((prev) => ({ ...prev, transaction_type: e.target.value }))} className="field-input">
                    {(metalType ? METAL_TRANSACTION_TYPES : MARKET_TRANSACTION_TYPES).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-soft mb-1.5">{metalType ? 'Date of purchase' : 'Trade date'}</label>
                  <input type="date" value={txForm.trade_date} onChange={(e) => setTxForm((prev) => ({ ...prev, trade_date: e.target.value }))} className="field-input" />
                </div>
                {(showUnitsAndPrice || showUnitOnly) && (
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">{metalType ? 'Weight (grams)' : 'Units'}</label>
                    <input type="number" step={metalType ? '0.001' : '0.000001'} value={txForm.units} onChange={(e) => setTxForm((prev) => ({ ...prev, units: e.target.value }))} className="field-input" />
                  </div>
                )}
                {showUnitsAndPrice && (
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">{metalType ? 'Price per gram (₹)' : 'Price / NAV per unit (₹)'}</label>
                    <input type="number" step="0.01" value={txForm.price_per_unit} onChange={(e) => setTxForm((prev) => ({ ...prev, price_per_unit: e.target.value }))} className="field-input" />
                  </div>
                )}
                {showCashAmount && (
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">Dividend amount (₹)</label>
                    <input type="number" step="0.01" value={txForm.cash_amount} onChange={(e) => setTxForm((prev) => ({ ...prev, cash_amount: e.target.value }))} className="field-input" />
                  </div>
                )}
                {!showUnitOnly && (
                  <>
                    {metalBuyType && (
                      <>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-ink-soft mb-1.5">Purchase method</label>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setPurchaseMode('general')} className={`chip ${purchaseMode === 'general' ? 'on' : ''}`}>General purchase</button>
                            <button type="button" onClick={() => setPurchaseMode('scheme')} className={`chip ${purchaseMode === 'scheme' ? 'on' : ''}`}>Scheme purchase</button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-ink-soft mb-1.5">Making input mode</label>
                          <select value={useMakingPercent ? 'percentage' : 'value'} onChange={(e) => { setUseMakingPercent(e.target.value === 'percentage'); setAutoCalcCharges(true); }} className="field-input">
                            <option value="percentage">Use percentages</option>
                            <option value="value">Use direct values</option>
                          </select>
                        </div>
                        {useMakingPercent ? (
                          <>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Actual making (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={purchaseMode === 'scheme' ? schemeActualMakingPct : makingChargePct}
                                onChange={(e) => {
                                  if (purchaseMode === 'scheme') setSchemeActualMakingPct(e.target.value);
                                  else setMakingChargePct(e.target.value);
                                  setAutoCalcCharges(true);
                                }}
                                className="field-input"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Payable making (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={purchaseMode === 'scheme' ? schemeGivenMakingPct : makingChargePct}
                                onChange={(e) => {
                                  if (purchaseMode === 'scheme') setSchemeGivenMakingPct(e.target.value);
                                  else setMakingChargePct(e.target.value);
                                  setAutoCalcCharges(true);
                                }}
                                className="field-input"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Actual making value (₹)</label>
                              <input type="number" step="0.01" value={actualMakingValue} onChange={(e) => { setActualMakingValue(e.target.value); setAutoCalcCharges(true); }} className="field-input" />
                            </div>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Payable making value (₹)</label>
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
                              ? `Converted GST: SGST ${metalPricing.derivedSgstPct.toFixed(2)}% (${inr(metalPricing.sgstAmount)}), CGST ${metalPricing.derivedCgstPct.toFixed(2)}% (${inr(metalPricing.cgstAmount)}), Total ${metalPricing.totalGstPct.toFixed(2)}% (${inr(metalPricing.totalGst)})`
                              : 'Enter weight and price to view GST conversion.'}
                          </div>
                        </div>

                        {purchaseMode === 'scheme' && (
                          <>
                            <div className="md:col-span-2 rounded-xl border border-honey-600/30 bg-honey-50 px-3 py-2.5 text-sm">
                              <p className="font-medium text-honey-700">Scheme details</p>
                              <p className="text-[11px] text-honey-700/80 mt-1">Compare general vs scheme purchase to see savings or loss.</p>
                            </div>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Actual making charge (%)</label>
                              <input type="number" step="0.01" value={schemeActualMakingPct} onChange={(e) => setSchemeActualMakingPct(e.target.value)} className="field-input" />
                            </div>
                            <div>
                              <label className="block text-xs text-ink-soft mb-1.5">Scheme making charge (%)</label>
                              <input type="number" step="0.01" value={schemeGivenMakingPct} onChange={(e) => { setSchemeGivenMakingPct(e.target.value); setMakingChargePct(e.target.value); setAutoCalcCharges(true); }} className="field-input" />
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
                                <option value="closed">Closed / redeemed</option>
                                <option value="active">Active (still paying)</option>
                              </select>
                            </div>

                            {schemeStatus === 'active' && (
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

                              </>
                            )}


                          </>
                        )}
                      </>
                    )}

                    <div>
                      <label className="block text-xs text-ink-soft mb-1.5">{metalBuyType ? 'Making charge amount (₹)' : 'Charges (₹)'}</label>
                      <input type="number" step="0.01" value={txForm.charges} onChange={(e) => { setTxForm((prev) => ({ ...prev, charges: e.target.value })); if (metalBuyType) setAutoCalcCharges(false); }} className="field-input" />
                    </div>
                    {metalBuyType ? (
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">GST total (SGST + CGST) (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={txForm.taxes}
                          onChange={(e) => {
                            setTxForm((prev) => ({ ...prev, taxes: e.target.value }));
                            setGstTotalValue(e.target.value);
                            setUseGstSplit(false);
                            setAutoCalcCharges(false);
                          }}
                          className="field-input"
                        />
                        <button type="button" onClick={() => setAutoCalcCharges(true)} className="mt-1 text-[11px] text-sky-700 hover:underline">Use auto-calculated values</button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs text-ink-soft mb-1.5">Taxes (₹)</label>
                        <input type="number" step="0.01" value={txForm.taxes} onChange={(e) => setTxForm((prev) => ({ ...prev, taxes: e.target.value }))} className="field-input" />
                      </div>
                    )}
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="block text-xs text-ink-soft mb-1.5">Notes <span className="text-[10px] text-ink-mute">optional</span></label>
                  <textarea rows="3" value={txForm.notes} onChange={(e) => setTxForm((prev) => ({ ...prev, notes: e.target.value }))} className="field-input" />
                </div>
                {metalBuyType && (
                  <div className="md:col-span-2 rounded-xl border border-edge bg-paper-tint px-3 py-3 text-sm space-y-2">
                    <p className="text-[11px] tracking-wider text-ink-mute uppercase">Invoice Calculation Details</p>

                    <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-1">With Scheme</p>
                    <div className="flex justify-between"><span className="text-ink-soft">Metal value (grams × rate)</span><span className="font-medium">{inr(metalPricing?.baseValue || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Scheme discount</span><span className="font-medium text-mint-600">- {inr(metalPricing?.totalDiscountAmount || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">GST amount</span><span className="font-medium">{inr(metalPricing?.totalGst || 0)}</span></div>
                    <div className="flex justify-between pt-1 border-t border-edge"><span className="text-ink-soft">Total invoice value (with scheme)</span><span className="font-medium text-mint-600">{inr(metalPricing?.schemeTotal || 0)}</span></div>

                    <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-2 border-t border-dashed border-edge">Without Scheme</p>
                    <div className="flex justify-between"><span className="text-ink-soft">Metal value (grams × rate)</span><span className="font-medium">{inr(metalPricing?.baseValue || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Making charges</span><span className="font-medium">{inr(metalPricing?.generalMakingAmount || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">GST amount</span><span className="font-medium">{inr(metalPricing?.generalGstAmount || 0)}</span></div>
                    <div className="flex justify-between pt-1 border-t border-edge"><span className="text-ink-soft">Total invoice value (without scheme)</span><span className="font-medium">{inr(metalPricing?.generalTotal || 0)}</span></div>

                    <p className="text-[11px] tracking-wider text-ink-mute uppercase pt-2 border-t border-dashed border-edge">Scheme Grams Split</p>
                    <div className="flex justify-between"><span className="text-ink-soft">Scheme accumulated grams</span><span className="font-medium">{(metalPricing?.accumulatedGrams || 0).toFixed(3)} g</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Purchased grams</span><span className="font-medium">{(metalPricing?.purchasedGrams || 0).toFixed(3)} g</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Extra grams</span><span className={`font-medium ${(metalPricing?.gramsDifference || 0) >= 0 ? 'text-mint-600' : 'text-danger'}`}>{(metalPricing?.gramsDifference || 0) >= 0 ? '+' : ''}{(metalPricing?.gramsDifference || 0).toFixed(3)} g</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Scheme accumulated value</span><span className="font-medium">{inr(metalPricing?.schemeAccumulatedValue || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Payable for extra grams</span><span className="font-medium text-honey-600">{inr(metalPricing?.extraGramPayableAmount || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">Balance after scheme credit</span><span className="font-medium text-honey-600">{inr(metalPricing?.payableAfterSchemeCredit || 0)}</span></div>

                    <div className="flex justify-between pt-2 border-t border-edge">
                      <span className="text-ink-soft">Amount payable now</span>
                      <span className="font-medium text-honey-600">{inr(metalPricing?.customerPayNowAmount || 0)}</span>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={savingTransaction} className="btn-primary py-2 px-4 rounded-lg text-sm font-medium">{savingTransaction ? 'Saving…' : 'Save transaction'}</button>
                </div>
              </form>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] tracking-wider text-ink-mute uppercase">Transaction history</p>
                <span className="text-[11px] text-ink-soft">{transactions.length} entries</span>
              </div>
              <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-ink-soft text-center">{metalType ? 'No purchases yet. Record your first purchase above.' : 'No transactions yet. Add your first buy or SIP above.'}</div>
                ) : transactions.map((tx, idx) => (
                  <div key={tx.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-edge' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{getTransactionTypeLabel(tx.transaction_type)}</p>
                        <p className="text-[11px] text-ink-mute mt-0.5">{fmtDate(tx.trade_date)}{Number(tx.units || 0) > 0 && <> · {formatUnits(tx.units)} {metalType ? 'g' : 'units'}</>}{Number(tx.price_per_unit || 0) > 0 && <> · {inr(tx.price_per_unit)} {metalType ? '/ g' : '/ unit'}</>}</p>
                        {tx.notes && <p className="text-[11px] text-ink-soft mt-1">{tx.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{inr(tx.net_amount ?? computeTransactionNetAmount(tx))}</p>
                        {(Number(tx.charges || 0) > 0 || Number(tx.taxes || 0) > 0) && <p className="text-[11px] text-ink-mute mt-0.5">fees {inr((Number(tx.charges || 0) + Number(tx.taxes || 0)))}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {isRecurring && (
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Payment history</p>
              {paymentsLoaded && (
                <span className="text-[11px] text-ink-soft">{paidCount}/{schedule.length} paid · {inr(totalPaid)} of {inr(Number(i.amount) * schedule.length)}{expectedPaid > 0 && paidCount < expectedPaid && <span className="ml-1.5 text-danger font-medium">{expectedPaid - paidCount} overdue</span>}</span>
              )}
            </div>
            {paymentsError && <p role="alert" aria-live="polite" className="text-[11px] text-danger mb-2">{paymentsError}</p>}
            {!paymentsLoaded ? (
              <div className="space-y-1.5">{[0, 1, 2].map((n) => <div key={n} className="h-10 bg-paper-tint rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
                {schedule.map((slot, idx) => {
                  const record = paymentRecords[slot.period_label];
                  const paid = record?.paid;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isDue = new Date(slot.due_date) <= today;
                  const isToggling = togglingPeriod === slot.period_label;
                  const selectedPaidDate = manualPaidDate[slot.period_label] || slot.due_date;
                  return (
                    <div key={slot.period_label} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx > 0 ? 'border-t border-edge' : ''} ${!paid && isDue ? 'bg-danger-soft/30' : ''}`}>
                      <button onClick={() => togglePayment(slot)} disabled={isToggling || !paymentsWritable} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${paid ? 'bg-mint-600 border-mint-600' : 'border-edge hover:border-mint-600'} ${!paymentsWritable ? 'opacity-50 cursor-not-allowed' : ''}`} title={paid ? 'Mark unpaid' : 'Mark paid'}>
                        {paid && <span className="text-white text-[10px] font-bold">✓</span>}
                        {isToggling && <span className="text-ink-mute text-[9px]">…</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{slot.period_label}</p>
                        <p className="text-[11px] text-ink-mute">{fmtDate(slot.due_date)}</p>
                        {!paid && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <label className="text-[10px] text-ink-mute">Paid on</label>
                            <input type="date" value={selectedPaidDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setManualPaidDate((prev) => ({ ...prev, [slot.period_label]: e.target.value }))} disabled={!paymentsWritable || isToggling} className="text-[11px] px-2 py-1 rounded-md border border-edge bg-paper-card" />
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium">{inr(slot.amount)}</p>
                        {paid ? <p className="text-[11px] text-mint-600">Paid{record.paid_at ? ` · ${fmtDate(record.paid_at)}` : ''}</p> : isDue ? <p className="text-[11px] text-danger">Overdue</p> : <p className="text-[11px] text-ink-mute">Upcoming</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {documents.length > 0 && (
          <section className="mb-5">
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Documents</p>
            {documents.map((d) => (
              <button key={d.id} onClick={() => setViewing(d)} className="w-full flex items-center gap-3 p-3 bg-paper-card border border-edge rounded-xl mb-2 hover:border-mint-600 transition text-left">
                <div className="w-7 h-9 bg-danger-soft text-danger rounded text-[10px] font-medium flex items-center justify-center flex-shrink-0">PDF</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-[11px] text-ink-mute">{(d.size_bytes / 1024).toFixed(0)} KB · tap to view</p>
                </div>
                <span className="text-ink-mute text-sm">›</span>
              </button>
            ))}
          </section>
        )}

        <div className="flex items-center gap-3 pt-3 border-t border-edge flex-wrap">
          <Link href={`/investments/${i.id}/edit`} className="btn-ghost py-2 px-4 rounded-lg text-sm">Edit investment</Link>
          {confirmDelete ? (
            <>
              <span className="text-sm text-ink-soft">Delete this investment? This cannot be undone.</span>
              <button onClick={onDelete} disabled={deleting} className="text-sm text-danger font-medium px-3 py-1.5 rounded-lg border border-danger hover:bg-danger-soft transition disabled:opacity-60">{deleting ? 'Deleting…' : 'Yes, delete'}</button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-mute px-3 py-1.5 rounded-lg border border-edge hover:bg-paper-tint transition">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm text-danger px-4 py-2 hover:underline">Delete investment</button>
          )}
        </div>
        {deleteError && <p className="text-xs text-danger mt-2">{deleteError}</p>}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex flex-col anim-fade" onClick={() => setViewing(null)}>
          <div className="bg-paper-card border-b border-edge px-4 py-3 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-medium truncate">{viewing.filename}</span>
            <button onClick={() => setViewing(null)} className="text-2xl leading-none px-2 text-ink-soft">×</button>
          </div>
          <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
            <iframe src={viewing.data_url} className="w-full h-full bg-white rounded" title={viewing.filename} />
          </div>
        </div>
      )}
    </Shell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-dashed border-edge text-sm gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, tone = '' }) {
  return (
    <div className="rounded-xl border border-edge bg-paper-card px-3 py-2.5">
      <p className="text-[11px] text-ink-mute">{label}</p>
      <p className={`text-sm font-medium mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
