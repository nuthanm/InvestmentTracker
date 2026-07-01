'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, addMonths, computeMaturity, computeRecurringMaturity } from '@/lib/format';
import { isMarketInvestment, isMetalInvestment } from '@/lib/investments';

const TYPES = ['FD', 'RD', 'MF', 'ETF', 'ST', 'GD', 'GOLD', 'SILV', 'PPF', 'OT'];
const PRESET_TYPES = ['Chit Fund', 'Crypto', 'Real Estate', 'NSC', 'Sukanya Samriddhi', 'Lent to family'];

const TYPE_CHIP_LABEL = { FD: 'FD', RD: 'RD', MF: 'MF', ETF: 'ETF', ST: 'Shares', GD: 'GD', GOLD: 'Gold', SILV: 'Silver', PPF: 'PPF', OT: 'Other' };
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
  OT: 'Other — chit fund, crypto, real estate, NSC, or any custom investment type',
};

const PERIODIC_TYPES = { RD: 'monthly', PPF: 'yearly' };

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
  const [startDateInput, setStartDateInput] = useState(initialInvestment?.start_date || new Date().toISOString().slice(0, 10));
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
  const [docs, setDocs] = useState(initialDocuments.map((doc) => ({ ...doc, size_bytes: Number(doc.size_bytes || 0), page_count: Number(doc.page_count || 1) })));
  const [initialUnits, setInitialUnits] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [initialCharges, setInitialCharges] = useState('0');
  const [initialTaxes, setInitialTaxes] = useState('0');
  const [initialNotes, setInitialNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isMarketType = isMarketInvestment(typeCode);
  const isMetalType = isMetalInvestment(typeCode);
  const isTransactionType = isMarketType || isMetalType;

  const handleTypeChange = (t) => {
    setTypeCode(t);
    setPaymentFrequency(PERIODIC_TYPES[t] || 'lump_sum');
    if (t === 'PPF') setTenureMode(180);
    else if (tenureMode === 180 || tenureMode === 240 || tenureMode === 300) setTenureMode(12);
  };

  const effectiveFrequency = PERIODIC_TYPES[typeCode] || paymentFrequency;
  const tenurePresets = typeCode === 'PPF' ? PPF_TENURE_PRESETS : TENURE_PRESETS;

  const totalMonths = useMemo(() => {
    if (tenureMode === CUSTOM_TENURE_MODE) return Number(customY) * 12 + Number(customM) + Number(customD) / 30;
    return Number(tenureMode);
  }, [tenureMode, customY, customM, customD]);

  const calc = useMemo(() => {
    if (isMarketType) return null;
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
  }, [amount, ratePct, totalMonths, compounding, effectiveFrequency, startDate, isMarketType]);

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

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (f.type !== 'application/pdf') {
        setError(`${f.name} is not a PDF.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        setError(`${f.name} is too large (max 5 MB for the free tier).`);
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      setDocs((d) => [...d, { filename: f.name, size_bytes: f.size, data_url: dataUrl, page_count: 1 }]);
    }
    e.target.value = '';
  };

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
      const hasAnyInitialInput = [initialUnits, initialPrice, initialNotes].some((value) => String(value || '').trim() !== '')
        || Number(initialCharges || 0) > 0
        || Number(initialTaxes || 0) > 0;
      if (hasAnyInitialInput) {
        const units = Number(initialUnits || 0);
        const price = Number(initialPrice || 0);
        const charges = Number(initialCharges || 0);
        const taxes = Number(initialTaxes || 0);
        if (units <= 0) { setError(isMetalType ? 'Weight (grams) must be greater than zero.' : 'Initial buy units must be greater than zero.'); return; }
        if (price <= 0) { setError(isMetalType ? 'Purchase price per gram must be greater than zero.' : 'Initial buy price must be greater than zero.'); return; }
        if (charges < 0 || taxes < 0) { setError('Charges cannot be negative.'); return; }
        initialTransaction = {
          transaction_type: 'buy',
          trade_date: startDateInput,
          units,
          price_per_unit: price,
          total_amount: units * price,
          charges,
          taxes,
          notes: initialNotes.trim() || null,
        };
      }
    } else {
      if (!totalMonths || totalMonths <= 0) { setError('Pick a valid tenure.'); return; }
      if (!amount || Number(amount) <= 0) { setError('Amount must be greater than zero.'); return; }
      if (!ratePct || Number(ratePct) <= 0) { setError('Interest rate is required.'); return; }
    }

    setSaving(true);
    try {
      const body = isTransactionType
        ? {
            type_code: typeCode,
            custom_type: typeCode === 'OT' ? customType.trim() : null,
            bank: bank.trim(),
            plan_name: planName.trim(),
            goal_id: goalId,
            nominee: nominee.trim(),
            account_holder: accountHolder.trim() || 'Self',
            start_date: startDateInput,
            documents: docs,
            initial_transaction: !isEditing ? initialTransaction : null,
          }
        : {
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
            auto_renew: autoRenew,
            start_date: startDateInput,
            documents: docs,
          };

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
                <input type="text" placeholder="e.g. Chit fund, Crypto..." value={customType} onChange={(e) => setCustomType(e.target.value)} className="field-input" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_TYPES.map((p) => (
                    <button key={p} type="button" onClick={() => setCustomType(p)} className="text-[11px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-mint-600">{p}</button>
                  ))}
                </div>
              </div>
            )}
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

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Plan details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Store / jeweller / source' : 'Bank / platform'}<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder={isMetalType ? 'e.g. Tanishq, Malabar, Family' : 'HDFC Bank, Groww, Zerodha…'} value={bank} onChange={(e) => setBank(e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Item description' : 'Plan name'}<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder={isMetalType ? (typeCode === 'GOLD' ? '22K Gold Bangle, Gold Coin 10g…' : 'Silver Bar 100g, Silver Anklets…') : (isMarketType ? 'Nifty ETF / SIP folio / Company name' : typeCode === 'RD' ? 'Monthly RD - 2Y' : typeCode === 'PPF' ? 'PPF Account 2024' : 'Senior FD - 5Y')} value={planName} onChange={(e) => setPlanName(e.target.value)} className="field-input" />
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
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">{isMetalType ? 'First purchase' : 'Initial buy'} <span className="text-[10px] normal-case ml-1">optional</span></p>
              {isEditing ? (
                <div className="rounded-xl border border-edge bg-paper-tint p-3 text-[12px] text-ink-soft">{isMetalType ? 'Use the investment detail page to add another purchase or record a sale.' : 'Use the investment detail page to add another buy, redeem units, or record dividends.'}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Weight (grams)' : 'Units'}</label>
                    <input type="number" step={isMetalType ? '0.001' : '0.000001'} placeholder={isMetalType ? '10.000' : '12.500000'} value={initialUnits} onChange={(e) => setInitialUnits(e.target.value)} className="field-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Price per gram (₹)' : 'Price / NAV per unit (₹)'}</label>
                    <input type="number" step="0.01" placeholder={isMetalType ? (typeCode === 'GOLD' ? '7200.00' : '95.00') : '112.35'} value={initialPrice} onChange={(e) => setInitialPrice(e.target.value)} className="field-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">{isMetalType ? 'Making charges + GST (₹)' : 'Charges (₹)'}</label>
                    <input type="number" step="0.01" value={initialCharges} onChange={(e) => setInitialCharges(e.target.value)} className="field-input" />
                  </div>
                  {!isMetalType && (
                    <div>
                      <label className="block text-xs text-ink-soft mb-1.5">Taxes (₹)</label>
                      <input type="number" step="0.01" value={initialTaxes} onChange={(e) => setInitialTaxes(e.target.value)} className="field-input" />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-xs text-ink-soft mb-1.5">Notes <span className="text-[10px] text-ink-mute">optional</span></label>
                    <textarea rows="3" value={initialNotes} onChange={(e) => setInitialNotes(e.target.value)} className="field-input" placeholder={isMetalType ? 'e.g. Wedding gift, hallmark BIS 916…' : 'SIP instalment, broker note, folio reference…'} />
                  </div>
                  <div className="md:col-span-2 bg-paper-tint rounded-xl border border-edge px-3 py-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-ink-soft">{isMetalType ? 'Metal value' : 'Purchase value'}</span><span className="font-medium">{inr(marketPreview?.gross || 0)}</span></div>
                    <div className="flex justify-between mt-1"><span className="text-ink-soft">Total cost incl. charges</span><span className="font-medium text-mint-600">{inr(marketPreview?.total || 0)}</span></div>
                  </div>
                </div>
              )}
            </section>
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

          {!isTransactionType && (
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
            <label className="block border border-dashed border-edge rounded-xl p-5 text-center cursor-pointer hover:bg-paper-tint transition">
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={onUpload} />
              <div className="text-sm font-medium">Tap to upload PDF</div>
              <div className="text-[11px] text-ink-soft mt-1">Up to 5 MB · multi-page supported</div>
            </label>
            {docs.map((d, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 bg-paper-tint rounded-lg mt-2">
                <div className="w-7 h-9 bg-danger-soft text-danger rounded text-[10px] font-medium flex items-center justify-center flex-shrink-0">PDF</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{d.filename}</p>
                  <p className="text-[11px] text-ink-mute">{(d.size_bytes / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={() => removeDoc(i)} className="text-ink-mute hover:text-danger px-2">×</button>
              </div>
            ))}
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
