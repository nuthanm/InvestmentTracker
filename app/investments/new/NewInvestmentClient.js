'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, addMonths, computeMaturity } from '@/lib/format';

const TYPES = ['FD', 'MF', 'ST', 'GD', 'PPF', 'OT'];
const PRESET_TYPES = ['Chit Fund', 'Crypto', 'Real Estate', 'NSC', 'Sukanya Samriddhi', 'Lent to family'];

const TYPE_CHIP_LABEL = { FD: 'FD', MF: 'MF', ST: 'ST', GD: 'GD', PPF: 'PPF', OT: 'Other' };
const TYPE_TOOLTIP = {
  FD:  'Fixed Deposit — guaranteed returns at a fixed interest rate (banks / NBFCs)',
  MF:  'Mutual Fund — market-linked pooled investment via SIP or lump sum',
  ST:  'Stocks — direct equity shares in a listed company',
  GD:  'Gold / SGB — physical gold, digital gold, or Sovereign Gold Bonds',
  PPF: 'Public Provident Fund — 15-year government-backed tax-free savings scheme',
  OT:  'Other — chit fund, crypto, real estate, NSC, or any custom investment type',
};
const TENURE_PRESETS = [
  { label: '3 mo', months: 3 },
  { label: '6 mo', months: 6 },
  { label: '12 mo', months: 12 },
  { label: '2 yr', months: 24 },
];

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
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
  const presetTenure = initialInvestment && !Number(initialInvestment.tenure_days)
    ? TENURE_PRESETS.find((preset) => preset.months === Number(initialInvestment.tenure_months))?.months
    : null;
  const startDate = useMemo(
    () => (initialInvestment?.start_date ? new Date(initialInvestment.start_date) : new Date()),
    [initialInvestment?.start_date]
  );

  const [typeCode, setTypeCode] = useState(initialInvestment?.type_code || 'FD');
  const [customType, setCustomType] = useState(initialInvestment?.custom_type || '');
  const [bank, setBank] = useState(initialInvestment?.bank || '');
  const [planName, setPlanName] = useState(initialInvestment?.plan_name || '');
  const [tenureMode, setTenureMode] = useState(presetTenure || (initialInvestment ? 'custom' : 12));
  const [customY, setCustomY] = useState(initialInvestment ? Math.floor(Number(initialInvestment.tenure_months || 0) / 12) : 0);
  const [customM, setCustomM] = useState(initialInvestment ? Number(initialInvestment.tenure_months || 0) % 12 : 9);
  const [customD, setCustomD] = useState(initialInvestment ? Number(initialInvestment.tenure_days || 0) : 0);
  const [amount, setAmount] = useState(initialInvestment ? String(initialInvestment.amount) : '');
  const [ratePct, setRatePct] = useState(initialInvestment ? String(initialInvestment.rate_pct) : '');
  const [compounding, setCompounding] = useState(initialInvestment?.compounding || 'quarterly');
  const [goalId, setGoalId] = useState(initialInvestment?.goal_id || goals[0]?.id || '');
  const [nominee, setNominee] = useState(initialInvestment?.nominee || '');
  const [autoRenew, setAutoRenew] = useState(initialInvestment ? !!initialInvestment.auto_renew : true);
  const [docs, setDocs] = useState(
    initialDocuments.map((doc) => ({
      ...doc,
      size_bytes: Number(doc.size_bytes || 0),
      page_count: Number(doc.page_count || 1),
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalMonths = useMemo(() => {
    if (tenureMode === 'custom') {
      return Number(customY) * 12 + Number(customM) + Number(customD) / 30;
    }
    return Number(tenureMode);
  }, [tenureMode, customY, customM, customD]);

  const calc = useMemo(() => {
    const a = Number(amount) || 0;
    const r = Number(ratePct) || 0;
    if (!a || !r || !totalMonths) return null;
    const matVal = computeMaturity({ amount: a, ratePct: r, months: totalMonths, compounding });
    const monthlyInt = (a * r) / 100 / 12;
    const monthlyPct = r / 12;
    return {
      matVal,
      interest: matVal - a,
      monthlyInt,
      monthlyPct,
      matDate: addMonths(startDate, totalMonths),
    };
  }, [amount, ratePct, totalMonths, compounding, startDate]);

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
    if (!totalMonths || totalMonths <= 0) { setError('Pick a valid tenure.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Amount must be greater than zero.'); return; }
    if (!ratePct || Number(ratePct) <= 0) { setError('Interest rate is required.'); return; }
    if (!goalId) { setError('Link this investment to a goal. Create one first if you have none.'); return; }
    if (!nominee.trim()) { setError('Nominee is required.'); return; }

    setSaving(true);
    try {
      const res = await fetch(isEditing ? `/api/investments/${initialInvestment.id}` : '/api/investments', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_code: typeCode,
          custom_type: typeCode === 'OT' ? customType.trim() : null,
          bank: bank.trim(),
          plan_name: planName.trim(),
          amount: Number(amount),
          rate_pct: Number(ratePct),
          tenure_months: Math.floor(totalMonths),
          tenure_days: Math.round((totalMonths - Math.floor(totalMonths)) * 30),
          compounding,
          goal_id: goalId,
          nominee: nominee.trim(),
          auto_renew: autoRenew,
          start_date: initialInvestment?.start_date || null,
          documents: docs,
        }),
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

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-2xl mx-auto w-full">
        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Cancel</button>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-1">{isEditing ? 'Edit investment' : 'Add investment'}</h1>
        <p className="text-sm text-ink-soft mb-6">{isEditing ? 'Update the details below.' : 'All fields are required.'}</p>

        <form onSubmit={submit} className="space-y-5">

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Type<span className="text-danger ml-0.5">*</span></p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {TYPES.map((t) => (
                <div key={t} className="relative group">
                  <button type="button" onClick={() => setTypeCode(t)}
                    className={`chip w-full ${typeCode === t ? 'on' : ''}`}>
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
                <input type="text" placeholder="e.g. Chit fund, Crypto..."
                  value={customType} onChange={(e) => setCustomType(e.target.value)} className="field-input"/>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_TYPES.map((p) => (
                    <button key={p} type="button" onClick={() => setCustomType(p)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-paper-card border border-edge hover:border-mint-600">{p}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Plan details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">Bank / platform<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder="HDFC Bank, Groww, Zerodha…" value={bank} onChange={(e) => setBank(e.target.value)} className="field-input"/>
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">Plan name<span className="text-danger ml-0.5">*</span></label>
                <input type="text" placeholder="Senior FD - 5Y" value={planName} onChange={(e) => setPlanName(e.target.value)} className="field-input"/>
              </div>
            </div>
          </section>

          <section>
            <label className="block text-xs text-ink-soft mb-2">Tenure<span className="text-danger ml-0.5">*</span></label>
            <div className="flex flex-wrap gap-2">
              {TENURE_PRESETS.map((p) => (
                <button key={p.months} type="button" onClick={() => setTenureMode(p.months)}
                  className={`chip ${tenureMode === p.months ? 'on' : ''}`}>{p.label}</button>
              ))}
              <button type="button" onClick={() => setTenureMode('custom')}
                className={`chip ${tenureMode === 'custom' ? 'on' : ''}`}>Custom</button>
            </div>
            {tenureMode === 'custom' && (
              <div className="grid grid-cols-3 gap-2 mt-3 max-w-sm">
                <div>
                  <label className="block text-[11px] text-ink-mute mb-1">Years</label>
                  <input type="number" min="0" value={customY} onChange={(e) => setCustomY(e.target.value)} className="field-input"/>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-mute mb-1">Months</label>
                  <input type="number" min="0" max="11" value={customM} onChange={(e) => setCustomM(e.target.value)} className="field-input"/>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-mute mb-1">Days</label>
                  <input type="number" min="0" max="30" value={customD} onChange={(e) => setCustomD(e.target.value)} className="field-input"/>
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Amount (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" inputMode="numeric" placeholder="300000" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input"/>
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">Interest rate (% p.a.)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" step="0.05" placeholder="7.25" value={ratePct} onChange={(e) => setRatePct(e.target.value)} className="field-input"/>
              {calc && (
                <div className="mt-2 px-2.5 py-2 bg-paper-tint rounded-lg text-xs">
                  <div className="flex justify-between"><span className="text-ink-soft">Monthly rate</span><span className="font-medium text-mint-600">{calc.monthlyPct.toFixed(3)}%</span></div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-edge"><span className="text-ink-soft">Monthly interest</span><span className="font-medium text-mint-600">{inr(calc.monthlyInt)}</span></div>
                </div>
              )}
            </div>
          </section>

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

          {calc && (
            <div className="bg-paper-tint rounded-xl p-3.5 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Maturity date</span><span className="font-medium">{fmtDate(calc.matDate)}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Total interest</span><span className="font-medium text-mint-600">+ {inr(calc.interest)}</span></div>
              <div className="flex justify-between pt-1.5 mt-1.5 border-t border-edge"><span className="text-ink-soft">Maturity value</span><span className="text-lg font-medium text-mint-600">{inr(calc.matVal)}</span></div>
            </div>
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
              <input type="text" placeholder="Full name" value={nominee} onChange={(e) => setNominee(e.target.value)} className="field-input"/>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between p-3 bg-paper-tint rounded-xl">
              <div>
                <div className="text-sm font-medium">Auto-renew on maturity</div>
                <div className="text-[11px] text-ink-soft mt-0.5">Reminder fires 30 days before</div>
              </div>
              <button type="button" onClick={() => setAutoRenew(!autoRenew)}
                className={`w-9 h-5 rounded-full relative transition ${autoRenew ? 'bg-mint-600' : 'bg-ink-mute'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoRenew ? 'right-0.5' : 'left-0.5'}`}></span>
              </button>
            </div>
          </section>

          <section>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Document <span className="text-[10px] text-ink-mute normal-case ml-1">optional</span></p>
            <label className="block border border-dashed border-edge rounded-xl p-5 text-center cursor-pointer hover:bg-paper-tint transition">
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={onUpload}/>
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
