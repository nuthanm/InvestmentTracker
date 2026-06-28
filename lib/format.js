const inrFmt = new Intl.NumberFormat('en-IN');

export const inr = (n) => '₹' + inrFmt.format(Math.round(Number(n) || 0));

export const inrShort = (n) => {
  n = Math.round(Number(n) || 0);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n;
};

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return dt.getDate() + ' ' + mo[dt.getMonth()] + ' ' + dt.getFullYear();
};

export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Math.round(months));
  return d;
};

export const computeMaturity = ({ amount, ratePct, months, compounding }) => {
  const t = months / 12;
  const r = ratePct / 100;
  if (compounding === 'simple') return amount * (1 + r * t);
  const n = compounding === 'monthly' ? 12 : compounding === 'half' ? 2 : compounding === 'yearly' ? 1 : 4;
  return amount * Math.pow(1 + r / n, n * t);
};

// Future value of an annuity (recurring deposits / PPF).
// paymentFrequency: 'monthly' (n=12) or 'yearly' (n=1)
export const computeRecurringMaturity = ({ amountPerPeriod, ratePct, months, paymentFrequency }) => {
  const r = ratePct / 100;
  const n = paymentFrequency === 'yearly' ? 1 : 12;
  const t = months / 12;
  const periods = n * t;
  if (r === 0) return amountPerPeriod * periods;
  const rPerPeriod = r / n;
  // FV of annuity-due (payment at start of each period, matching RD/PPF convention)
  return amountPerPeriod * ((Math.pow(1 + rPerPeriod, periods) - 1) / rPerPeriod) * (1 + rPerPeriod);
};

export const TYPE_META = {
  FD:  { label: 'Fixed Deposit',     short: 'FD',  tone: 'mint' },
  RD:  { label: 'Recurring Deposit', short: 'RD',  tone: 'sky' },
  MF:  { label: 'Mutual Fund',       short: 'MF',  tone: 'sky' },
  ETF: { label: 'ETF',               short: 'ETF', tone: 'ember' },
  ST:  { label: 'Shares',            short: 'ST',  tone: 'ember' },
  GD:  { label: 'Gold / SGB',        short: 'GD',  tone: 'honey' },
  PPF: { label: 'PPF',               short: 'PPF', tone: 'plum' },
  OT:  { label: 'Other',             short: 'OT',  tone: 'rose' },
};

export const toneFor = (typeCode) => TYPE_META[typeCode]?.tone || 'rose';

export const labelFor = (inv) => {
  if (inv.type_code === 'OT' && inv.custom_type) return inv.custom_type;
  return TYPE_META[inv.type_code]?.label || 'Other';
};

// Human-readable frequency suffix for display in lists and details.
export const frequencySuffix = (freq) => {
  if (freq === 'monthly') return '/mo';
  if (freq === 'yearly') return '/yr';
  return '';
};

export const frequencyLabel = (freq) => {
  if (freq === 'monthly') return 'Monthly';
  if (freq === 'yearly') return 'Yearly';
  return 'One-time';
};
